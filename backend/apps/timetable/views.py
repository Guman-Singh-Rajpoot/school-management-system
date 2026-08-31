from rest_framework import viewsets
from apps.accounts.permissions import IsAdmin
from .models import TimetableSlot
from .serializers import TimetableSlotSerializer


class TimetableSlotViewSet(viewsets.ModelViewSet):
    queryset = TimetableSlot.objects.select_related('subject', 'teacher__user', 'section').all()
    serializer_class = TimetableSlotSerializer
    filterset_fields = ['section', 'teacher', 'day_of_week']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'TEACHER':
            teacher = getattr(user, 'teacher_profile', None)
            class_only = self.request.query_params.get('mine')
            if class_only:
                return qs.filter(teacher=teacher)
        if user.role == 'STUDENT':
            student = getattr(user, 'student_profile', None)
            if student and student.section:
                return qs.filter(section=student.section)
        return qs

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAdmin()] if self.action in ('create', 'update', 'partial_update', 'destroy') else [IsAuthenticated()]
