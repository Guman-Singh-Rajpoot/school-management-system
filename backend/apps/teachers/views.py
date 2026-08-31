from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import (
    IsAdmin, IsAdminOrTeacher, IsSelfTeacher, IsSelfTeacherViaTeacherFK,
    IsSelfTeacherViaTeacherSalaryFK,
)
from .models import Teacher, TeacherDocument, TeacherSalary, SalaryPayment, TeacherAttendance
from .serializers import (
    TeacherSerializer, TeacherCreateSerializer, TeacherDocumentSerializer,
    TeacherSalarySerializer, SalaryPaymentSerializer, TeacherAttendanceSerializer,
)


class TeacherViewSet(viewsets.ModelViewSet):
    """
    Admin: full access to every teacher.
    Teacher: may only list/retrieve/update their OWN record. Requesting
        another teacher's record (e.g. GET /api/teachers/5/ as teacher #2)
        returns 403, enforced via object-level permission -- not just by
        hiding the row from a list.
    Student: no access to the teacher roster via this endpoint.
    """
    queryset = Teacher.objects.select_related('user').prefetch_related('subjects', 'classes').all()
    filterset_fields = ['department', 'gender']
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'user__email']

    def get_serializer_class(self):
        if self.action == 'create':
            return TeacherCreateSerializer
        return TeacherSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.role == 'STUDENT':
            # Students have no legitimate use for the teacher roster.
            return qs.none()
        if user.role == 'TEACHER' and self.action == 'list':
            # A teacher's own "list" is just themself.
            return qs.filter(user=user)
        # For retrieve/update/destroy we deliberately do NOT pre-filter to
        # "own record" here -- object-level permission (IsSelfTeacher) is
        # what turns a foreign-ID lookup into a 403 rather than a 404.
        return qs

    def get_permissions(self):
        if self.action in ('create', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ('update', 'partial_update'):
            # Only Admin may edit teacher records (salary, employment info, etc).
            return [IsAuthenticated(), IsAdmin()]
        # list / retrieve
        return [IsAuthenticated(), IsSelfTeacher()]


class TeacherDocumentViewSet(viewsets.ModelViewSet):
    """Only Admin uploads/edits/deletes. A teacher may view only their own documents."""
    queryset = TeacherDocument.objects.select_related('teacher__user').all()
    serializer_class = TeacherDocumentSerializer
    filterset_fields = ['teacher', 'doc_type', 'verified']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'ADMIN':
            return qs
        if user.role == 'TEACHER' and self.action == 'list':
            return qs.filter(teacher__user=user)
        if user.role == 'TEACHER':
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsSelfTeacherViaTeacherFK()]
        return [IsAuthenticated(), IsAdmin()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class TeacherSalaryViewSet(viewsets.ModelViewSet):
    """Monthly salary structure per teacher. Admin-managed; teacher reads own."""
    queryset = TeacherSalary.objects.select_related('teacher__user').prefetch_related('payments').all()
    serializer_class = TeacherSalarySerializer
    filterset_fields = ['teacher', 'salary_month']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'ADMIN':
            return qs
        if user.role == 'TEACHER' and self.action == 'list':
            return qs.filter(teacher__user=user)
        if user.role == 'TEACHER':
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsSelfTeacherViaTeacherFK()]
        return [IsAuthenticated(), IsAdmin()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SalaryPaymentViewSet(viewsets.ModelViewSet):
    """
    Records an actual salary payment/instalment. Only Admin can create,
    edit, or delete. A teacher may only read their own payment history.
    created_at / created_by are always set server-side.
    """
    queryset = SalaryPayment.objects.select_related('teacher_salary__teacher__user').all()
    serializer_class = SalaryPaymentSerializer
    filterset_fields = ['teacher_salary', 'payment_method']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'ADMIN':
            return qs
        if user.role == 'TEACHER' and self.action == 'list':
            return qs.filter(teacher_salary__teacher__user=user)
        if user.role == 'TEACHER':
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsSelfTeacherViaTeacherSalaryFK()]
        # create/update/partial_update/destroy: Admin only. Editing/deleting
        # historical payments is intentionally still Admin-gated (for
        # genuine correction/audit) -- financial history is never silently
        # overwritten by a non-admin.
        return [IsAuthenticated(), IsAdmin()]

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TeacherAttendanceViewSet(viewsets.ModelViewSet):
    """
    Admin: manage attendance for every teacher.
    Teacher: read-only, and only ever sees their own attendance records
        (list is scoped; retrieving another teacher's record is 403).
    """
    queryset = TeacherAttendance.objects.select_related('teacher__user', 'marked_by').all()
    serializer_class = TeacherAttendanceSerializer
    filterset_fields = ['teacher', 'date', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'TEACHER' and self.action == 'list':
            return qs.filter(teacher__user=user)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsSelfTeacherViaTeacherFK()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(marked_by=self.request.user)
