from rest_framework import viewsets
from apps.accounts.permissions import IsAdminOrTeacher
from .models import Homework, HomeworkSubmission
from .serializers import HomeworkSerializer, HomeworkSubmissionSerializer


class HomeworkViewSet(viewsets.ModelViewSet):
    queryset = Homework.objects.select_related('subject', 'teacher__user', 'section').all()
    serializer_class = HomeworkSerializer
    filterset_fields = ['section', 'subject', 'teacher']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT':
            student = getattr(user, 'student_profile', None)
            if student and student.section:
                return qs.filter(section=student.section)
        return qs

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAdminOrTeacher()] if self.action in ('create', 'update', 'partial_update', 'destroy') else [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'TEACHER':
            # A teacher can only ever create homework attributed to
            # themselves -- ignore/override any 'teacher' the client sent
            # so one teacher can't post homework under another's name.
            serializer.save(teacher=getattr(user, 'teacher_profile', None))
        else:
            # Admin explicitly picks which teacher the homework belongs
            # to; that value from the payload is what gets used.
            serializer.save()


class HomeworkSubmissionViewSet(viewsets.ModelViewSet):
    queryset = HomeworkSubmission.objects.select_related('student__user', 'homework').all()
    serializer_class = HomeworkSubmissionSerializer
    filterset_fields = ['homework', 'student', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT':
            return qs.filter(student__user=user)
        return qs

    def perform_create(self, serializer):
        student = getattr(self.request.user, 'student_profile', None)
        serializer.save(student=student)
