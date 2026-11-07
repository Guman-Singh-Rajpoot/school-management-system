import calendar
from datetime import date

from django.db import transaction
from django.utils.timezone import now

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsSelfStudentViaStudentFeeFK
from apps.students.models import Student
from apps.announcements.whatsapp import send_fee_paid_confirmation

from .models import FeeStructure, StudentFee, StudentFeeAdjustment, Payment
from .serializers import (
    FeeStructureSerializer,
    StudentFeeSerializer,
    FeePaymentSerializer,
    StudentFeeAdjustmentSerializer,
)


def _user_school(user):
    """
    school_id of the caller. Superusers (and legacy users with no school
    row) return None, meaning "not school-restricted".
    """
    if user is None or not user.is_authenticated:
        return None
    if user.is_superuser:
        return None
    return user.school_id


def _month_end(year, month):
    return date(year, month, calendar.monthrange(year, month)[1])


def _adjustment_map(student_ids, fee_types):
    """
    Active StudentFeeAdjustment rows keyed by (student_id, lower fee_type).
    """
    rows = StudentFeeAdjustment.objects.filter(
        active=True, student_id__in=student_ids,
    )
    result = {}
    for adj in rows:
        key = (adj.student_id, adj.fee_type.strip().lower())
        if key not in result:
            result[key] = adj
    return result


def generate_monthly_bills(fee_structures, students, month, year):
    """
    Generate one StudentFee bill per (student, active fee category) for a
    billing period. Idempotent: an existing bill for the same
    student + category + period is never duplicated or altered.

    Per-student active adjustments for the category are applied to newly
    generated bills. Bill amounts are captured from the structure at
    generation time, so later structure edits only affect future periods
    and historical bills/payments are preserved untouched.
    """
    created = 0
    skipped = 0

    structures = list(fee_structures)
    student_ids = list(students.values_list('id', flat=True))
    adjustments = _adjustment_map(student_ids, [s.fee_type for s in structures])

    period_end = _month_end(year, month)

    with transaction.atomic():
        for structure in structures:
            structure_students = [s for s in students if s.school_class_id == structure.school_class_id]
            label = structure.fee_type.strip().lower()
            for student in structure_students:
                # Only students enrolled on or before the billing month.
                if student.admission_date and student.admission_date > period_end:
                    skipped += 1
                    continue

                adjustment = adjustments.get((student.id, label))
                defaults = {
                    'gross_amount': structure.amount,
                    'discount_amount': adjustment.discount_amount if adjustment else 0,
                    'scholarship_amount': adjustment.scholarship_amount if adjustment else 0,
                }
                obj, was_created = StudentFee.objects.get_or_create(
                    student=student,
                    fee_structure=structure,
                    month=month,
                    year=year,
                    defaults=defaults,
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

    due_day = structures[0].due_day if structures else 10
    due_date = date(year, month, min(due_day, calendar.monthrange(year, month)[1]))

    return {
        'detail': f'Monthly bills generated for {created} student fees.',
        'created': created,
        'skipped': skipped,
        'month': month,
        'year': year,
        'due_date': due_date.isoformat(),
        'categories': [
            {
                'fee_structure': s.id,
                'fee_type': s.fee_type,
                'amount': str(s.amount),
                'due_day': s.due_day,
                'late_fee_amount': str(s.late_fee_amount),
            }
            for s in structures
        ],
    }


class FeeStructureViewSet(viewsets.ModelViewSet):
    """
    Fee structure master data per class + session (each school's own).

    Admin-only. Use ``generate-schedule`` to create monthly bills for a
    whole class at once, or ``generate_monthly`` (on a single row) for
    single-category generation.
    """
    queryset = FeeStructure.objects.select_related(
        'school_class', 'session', 'session__school'
    ).all()
    serializer_class = FeeStructureSerializer
    filterset_fields = ['school_class', 'session', 'fee_type', 'active']
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        school_id = _user_school(self.request.user)
        if school_id is not None:
            qs = qs.filter(school_class__session__school_id=school_id)
        return qs

    def _in_scope(self, obj):
        """True when the object belongs to the caller's school."""
        school_id = _user_school(self.request.user)
        if school_id is None:
            return True
        return obj.school_class.session.school_id == school_id

    def get_object(self):
        obj = super().get_object()
        if not self._in_scope(obj):
            # A foreign-school ID must fail with 403, never 404.
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Not allowed to access fee structures of another school.')
        return obj

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    def _class_structures(self, request, school_class_id):
        return list(self.get_queryset().filter(
            school_class_id=school_class_id, active=True,
        ).order_by('fee_type'))

    @action(detail=False, methods=['post'], url_path='preview-schedule')
    def preview_schedule(self, request):
        """
        POST /api/fees/fee-structures/preview-schedule/
        Body: {"school_class": <id>, "month": <1-12>, "year": <yyyy>}

        Read-only preview: eligible student count, per-category amounts
        and the per-student monthly total. NO bills are written; the
        admin confirms the amounts by calling generate-schedule.
        """
        school_class = request.data.get('school_class')
        month, year = request.data.get('month'), request.data.get('year')
        try:
            month, year = int(month), int(year)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'month and year are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= month <= 12):
            return Response(
                {'detail': 'month must be between 1 and 12.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        structures = self._class_structures(request, school_class)
        if not structures:
            return Response(
                {'detail': 'No active fee category exists for this class.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_id = _user_school(request.user)
        students = Student.objects.filter(
            school_class=structures[0].school_class,
            status=Student.Status.ACTIVE,
        )
        if school_id is not None:
            students = students.filter(user__school_id=school_id)

        period_end = _month_end(year, month)
        all_students = list(students)
        eligible = [s for s in all_students if s.admission_date and s.admission_date <= period_end]

        student_ids = [s.id for s in eligible]
        adjustments = _adjustment_map(student_ids, [s.fee_type for s in structures])

        return Response({
            'school_class': school_class,
            'month': month,
            'year': year,
            'eligible_students': len(eligible),
            'excluded_students': len(all_students) - len(eligible),
            'categories': [
                {
                    'fee_structure': s.id,
                    'fee_type': s.fee_type,
                    'amount': str(s.amount),
                    'due_day': s.due_day,
                    'late_fee_amount': str(s.late_fee_amount),
                    'students_with_adjustment': sum(
                        1 for sid in student_ids
                        if (sid, s.fee_type.strip().lower()) in adjustments
                    ),
                }
                for s in structures
            ],
            'monthly_total_per_student': str(sum(s.amount for s in structures)),
            'note': 'Confirm the amounts before generating actual student dues.',
        })

    @action(detail=False, methods=['post'], url_path='generate-schedule')
    def generate_schedule(self, request):
        """
        POST /api/fees/fee-structures/generate-schedule/
        Body: {"school_class": <id>, "month": <1-12>, "year": <yyyy>}

        Generates monthly bills for ALL ACTIVE fee categories of the
        class for the billing month, for every ACTIVE student enrolled
        by month end. Safe to re-run: existing bills for the same
        student/category/period are skipped, never duplicated or altered.
        """
        school_class = request.data.get('school_class')
        month, year = request.data.get('month'), request.data.get('year')
        try:
            month, year = int(month), int(year)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'month and year are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= month <= 12):
            return Response(
                {'detail': 'month must be between 1 and 12.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        structures = self._class_structures(request, school_class)
        if not structures:
            return Response(
                {'detail': 'No active fee category exists for this class.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_id = _user_school(request.user)
        students = Student.objects.filter(
            school_class=structures[0].school_class,
            status=Student.Status.ACTIVE,
        )
        if school_id is not None:
            students = students.filter(user__school_id=school_id)

        summary = generate_monthly_bills(structures, students, month, year)
        summary['school_class'] = school_class
        return Response(summary, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='class-overview')
    def class_overview(self, request):
        """
        GET /api/fees/fee-structures/class-overview/?session=<id>

        Class-wise comparison for a session: active categories per class
        and the monthly total charged per student in the class.
        """
        session = request.query_params.get('session')
        qs = self.get_queryset().filter(active=True).order_by('school_class__name', 'fee_type')
        if session:
            try:
                qs = qs.filter(session_id=int(session))
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'session must be a valid id.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        overview = {}
        for row in qs:
            class_id = row.school_class.id
            entry = overview.setdefault(class_id, {
                'school_class': class_id,
                'class_name': row.school_class.name,
                'session': row.session.id,
                'session_name': row.session.name,
                'categories': [],
                'monthly_total': 0,
            })
            entry['categories'].append({
                'id': row.id,
                'fee_type': row.fee_type,
                'amount': str(row.amount),
                'due_day': row.due_day,
                'late_fee_amount': str(row.late_fee_amount),
            })
            entry['monthly_total'] += row.amount
        data = sorted(overview.values(), key=lambda item: item['class_name'])
        for entry in data:
            entry['monthly_total'] = str(entry['monthly_total'])
        return Response(data)

    @action(detail=True, methods=['post'])
    def generate_monthly(self, request, pk=None):
        """
        Legacy single-category generation:
        POST /api/fees/fee-structures/<id>/generate_monthly/
        Body: {"month": 1, "year": 2026}
        """
        fee_structure = self.get_object()
        month, year = request.data.get('month'), request.data.get('year')
        try:
            month, year = int(month), int(year)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'month and year are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= month <= 12):
            return Response(
                {'detail': 'month must be between 1 and 12.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_id = _user_school(request.user)
        students = Student.objects.filter(
            school_class=fee_structure.school_class,
            status=Student.Status.ACTIVE,
        )
        if school_id is not None:
            students = students.filter(user__school_id=school_id)

        summary = generate_monthly_bills([fee_structure], students, month, year)
        summary['fee_structure'] = fee_structure.id
        return Response(summary, status=status.HTTP_201_CREATED)


class _StudentFeeDetailPermission(IsAuthenticated):
    """Admin, or the owning Student, may retrieve a single StudentFee row."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ('ADMIN', 'OWNER') or user.is_staff:
            school_id = _user_school(user)
            if school_id is None:
                return True
            return obj.student.user.school_id == school_id
        if user.role == 'STUDENT':
            return obj.student.user == user
        return False


class StudentFeeViewSet(viewsets.ModelViewSet):
    """
    Admin: full access (view/edit all students' bills for their school).
    Student: may only view their OWN fee record (nested payments).
    Teacher: no access -- financial records are Admin/Student only.
    """
    queryset = StudentFee.objects.select_related(
        'student__user', 'fee_structure__school_class', 'fee_structure__session'
    ).prefetch_related('payments').all()
    serializer_class = StudentFeeSerializer
    filterset_fields = ['student', 'fee_structure', 'student__school_class', 'month', 'year']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT':
            # Own records only (list); retrieve relies on the object
            # permission so a foreign ID stays a 403.
            if self.action == 'list':
                return qs.filter(student__user=user)
            return qs
        if user.role not in ('ADMIN', 'OWNER'):
            return qs.none()
        school_id = _user_school(user)
        if school_id is not None:
            qs = qs.filter(student__user__school_id=school_id)
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'dashboard_summary') or \
                self.action.startswith('reports_') or self.action == 'summary':
            return [IsAuthenticated(), IsAdmin()]
        if self.action == 'list':
            return [IsAuthenticated()]
        return [_StudentFeeDetailPermission()]

    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        """Admin dashboard: total billed, collected and pending for the school."""
        qs = list(self.get_queryset())
        total_billed = sum(float(row.net_payable) for row in qs)
        total_collected = sum(float(row.paid_amount) for row in qs)
        overdue = sum(1 for row in qs if row.payment_status == 'OVERDUE')
        return Response({
            'total_billed': total_billed,
            'total_collected': total_collected,
            'total_pending': round(total_billed - total_collected, 2),
            'overdue_bills': overdue,
        })

    @action(detail=False, methods=['get'], url_path='reports/by-month')
    def reports_by_month(self, request):
        """
        GET /api/fees/student-fees/reports/by-month/?year=<yyyy>

        Month-wise billing summary across the chosen year.
        """
        year = request.query_params.get('year')
        if not year:
            return Response(
                {'detail': 'year query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            year = int(year)
        except ValueError:
            return Response(
                {'detail': 'year must be a valid year.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report = {}
        for row in self.get_queryset().filter(year=year, month__isnull=False):
            entry = report.setdefault(row.month, {
                'month': row.month,
                'year': year,
                'billed': 0.0,
                'collected': 0.0,
                'status_counts': {},
            })
            entry['billed'] += float(row.net_payable)
            entry['collected'] += float(row.paid_amount)
            entry['status_counts'][row.payment_status] = (
                entry['status_counts'].get(row.payment_status, 0) + 1
            )
        months = sorted(report.values(), key=lambda item: item['month'])
        for item in months:
            item['billed'] = round(item['billed'], 2)
            item['collected'] = round(item['collected'], 2)
            item['pending'] = round(item['billed'] - item['collected'], 2)
        return Response({'year': year, 'months': months})

    @action(detail=False, methods=['get'], url_path='reports/by-class')
    def reports_by_class(self, request):
        """
        GET /api/fees/student-fees/reports/by-class/?month=<m>&year=<y>

        Class-wise billing summary: billed, collected, pending per class.
        """
        qs = self.get_queryset()
        month, year = request.query_params.get('month'), request.query_params.get('year')
        if month:
            try:
                qs = qs.filter(month=int(month))
            except ValueError:
                return Response(
                    {'detail': 'month must be an integer.'}, status=status.HTTP_400_BAD_REQUEST
                )
        if year:
            try:
                qs = qs.filter(year=int(year))
            except ValueError:
                return Response(
                    {'detail': 'year must be an integer.'}, status=status.HTTP_400_BAD_REQUEST
                )

        report = {}
        for row in qs:
            class_id = row.fee_structure.school_class_id
            entry = report.setdefault(class_id, {
                'class_name': row.fee_structure.school_class.name,
                'billed': 0.0,
                'collected': 0.0,
                'status_counts': {},
            })
            entry['billed'] += float(row.net_payable)
            entry['collected'] += float(row.paid_amount)
            entry['status_counts'][row.payment_status] = (
                entry['status_counts'].get(row.payment_status, 0) + 1
            )
        classes = sorted(report.values(), key=lambda item: item['class_name'])
        for item in classes:
            item['billed'] = round(item['billed'], 2)
            item['collected'] = round(item['collected'], 2)
            item['pending'] = round(item['billed'] - item['collected'], 2)
        return Response({'classes': classes})


class PaymentViewSet(viewsets.ModelViewSet):
    """
    Records an individual fee payment. Only Admin can create/edit/delete.
    A student may view (list/retrieve) only their own payments/receipts.
    created_at (date + time) and created_by are always generated by the
    backend -- the client can never set or edit them.
    """
    queryset = Payment.objects.select_related(
        'student_fee__student__user', 'student_fee__fee_structure__school_class'
    ).all()
    serializer_class = FeePaymentSerializer
    filterset_fields = ['student_fee', 'method']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if is_school_admin(user):
            school_id = _user_school(user)
            if school_id is not None:
                qs = qs.filter(student_fee__student__user__school_id=school_id)
            return qs
        if user.role == 'STUDENT' and self.action == 'list':
            return qs.filter(student_fee__student__user=user)
        if user.role == 'STUDENT':
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsSelfStudentViaStudentFeeFK()]
        return [IsAuthenticated(), IsAdmin()]

    @transaction.atomic
    def perform_create(self, serializer):
        payment = serializer.save(created_by=self.request.user)
        try:
            send_fee_paid_confirmation(payment)
        except Exception:
            pass


class StudentFeeAdjustmentViewSet(viewsets.ModelViewSet):
    """
    Student-specific recurring fee adjustments (discounts/scholarships/
    concessions). Admin-only. Applied automatically when monthly bills
    for the matching fee category are generated.
    """
    queryset = StudentFeeAdjustment.objects.select_related('student__user').all()
    serializer_class = StudentFeeAdjustmentSerializer
    filterset_fields = ['student', 'active', 'fee_type']
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        school_id = _user_school(self.request.user)
        if school_id is not None:
            qs = qs.filter(student__user__school_id=school_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
