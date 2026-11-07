from django.db import transaction
from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminOrTeacher, IsSelfStudentOrTeacherViaStudentFK
from apps.students.models import Student
from apps.announcements.whatsapp import send_student_absence_notification
from .models import Attendance
from .serializers import AttendanceSerializer, BulkAttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    Admin: manage attendance for any student.
    Teacher: manage attendance only for students in assigned classes/sections.
    Student: read-only access to their own attendance records.
    """
    queryset = Attendance.objects.select_related('student__user', 'student__school_class', 'student__section').all()
    serializer_class = AttendanceSerializer
    filterset_fields = ['student', 'date', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return Attendance.objects.none()

        if user.role == 'STUDENT':
            return qs.filter(student__user=user)

        if user.role == 'TEACHER':
            teacher = getattr(user, 'teacher_profile', None)
            if not teacher:
                return Attendance.objects.none()
            qs = qs.filter(
                Q(student__school_class__in=teacher.classes.all())
                | Q(student__section__in=teacher.sections.all())
            ).distinct()

        school_class_id = self.request.query_params.get('school_class')
        if school_class_id:
            qs = qs.filter(student__school_class_id=school_class_id)

        section_id = self.request.query_params.get('section')
        if section_id:
            qs = qs.filter(student__section_id=section_id)

        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'bulk_mark'):
            return [IsAdminOrTeacher()]
        if self.action == 'retrieve':
            return [IsSelfStudentOrTeacherViaStudentFK()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        teacher = getattr(self.request.user, 'teacher_profile', None)
        attendance = serializer.save(marked_by=teacher)

        # Send WhatsApp absence notification for students when marked ABSENT
        # Both Admin and Teacher can trigger this
        if attendance.status == Attendance.Status.ABSENT:
            student = attendance.student
            send_student_absence_notification(
                student,
                str(attendance.date),
                attendance.status,
            )

        return attendance

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrTeacher])
    def bulk_mark(self, request):
        """Mark class-wise attendance with transaction integrity and teacher assignment validation."""
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        date = serializer.validated_data['date']
        records = serializer.validated_data['records']
        school_class_id = serializer.validated_data.get('school_class')
        section_id = serializer.validated_data.get('section')

        user = request.user
        teacher = getattr(user, 'teacher_profile', None)

        if user.role == 'TEACHER':
            if not teacher:
                return Response({'detail': 'Teacher profile not found.'}, status=status.HTTP_403_FORBIDDEN)
            if school_class_id and not teacher.classes.filter(id=school_class_id).exists():
                return Response(
                    {'detail': 'You are not assigned to this class.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if section_id and not (teacher.sections.filter(id=section_id).exists() or teacher.classes.filter(sections__id=section_id).exists()):
                return Response(
                    {'detail': 'You are not assigned to this section.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Check for duplicate student IDs in submission
        student_ids = [r['student'] for r in records]
        if len(student_ids) != len(set(student_ids)):
            return Response(
                {'detail': 'Duplicate student IDs found in attendance submission.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch students and validate ownership
        students_qs = Student.objects.filter(id__in=student_ids)
        if school_class_id:
            students_qs = students_qs.filter(school_class_id=school_class_id)
        if section_id:
            students_qs = students_qs.filter(section_id=section_id)

        found_student_ids = set(students_qs.values_list('id', flat=True))
        invalid_ids = set(student_ids) - found_student_ids
        if invalid_ids:
            return Response(
                {'detail': f'Students {list(invalid_ids)} do not belong to the selected class/section.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.role == 'TEACHER':
            unauthorized_students = students_qs.exclude(
                Q(school_class__in=teacher.classes.all()) | Q(section__in=teacher.sections.all())
            )
            if unauthorized_students.exists():
                return Response(
                    {'detail': 'You do not have permission to mark attendance for some of these students.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        updated_ids = []
        with transaction.atomic():
            for record in records:
                s_id = record['student']
                st = record.get('status')
                remarks = record.get('remarks', '')
                if st in ('NOT_MARKED', '', None):
                    Attendance.objects.filter(student_id=s_id, date=date).delete()
                else:
                    obj, _ = Attendance.objects.update_or_create(
                        student_id=s_id,
                        date=date,
                        defaults={
                            'status': st,
                            'remarks': remarks,
                            'marked_by': teacher,
                        },
                    )
                    updated_ids.append(obj.id)

                    # Send WhatsApp absence notification for students marked ABSENT
                    if st == Attendance.Status.ABSENT:
                        student = obj.student
                        send_student_absence_notification(
                            student,
                            str(date),
                            st,
                        )

        return Response(
            {
                'detail': f'Attendance successfully saved for {len(records)} students.',
                'updated_count': len(updated_ids),
                'date': str(date),
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Attendance percentage summary, scoped strictly by role."""
        qs = self.filter_queryset(self.get_queryset())
        total = qs.count()
        present = qs.filter(status=Attendance.Status.PRESENT).count()
        percentage = round((present / total) * 100, 2) if total else 0
        breakdown = qs.values('status').annotate(count=Count('id'))
        return Response({
            'total_days': total,
            'present_days': present,
            'attendance_percentage': percentage,
            'breakdown': breakdown,
        })
