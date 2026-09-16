from django.db.models import Sum, F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsAdmin, IsAdminOrTeacher
from .models import Exam, ExamSubject, Grade, Mark
from .serializers import ExamSerializer, ExamSubjectSerializer, GradeSerializer, MarkSerializer


class ExamViewSet(viewsets.ModelViewSet):
    """Exam calendar. Only Admin creates/edits/deletes; everyone
    authenticated (Admin, Teacher, Student) can view it."""
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    filterset_fields = ['school_class', 'session', 'exam_type']

    def get_permissions(self):
        return [IsAuthenticated()] if self.action in ('list', 'retrieve') else [IsAuthenticated(), IsAdmin()]


class ExamSubjectViewSet(viewsets.ModelViewSet):
    queryset = ExamSubject.objects.all()
    serializer_class = ExamSubjectSerializer
    filterset_fields = ['exam', 'subject']
    permission_classes = [IsAdmin]


class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    permission_classes = [IsAdmin]


class MarkViewSet(viewsets.ModelViewSet):
    """Admin/Teacher enter marks. A student may only view their own marks."""
    queryset = Mark.objects.select_related('student__user', 'exam_subject__subject').all()
    serializer_class = MarkSerializer
    filterset_fields = ['student', 'exam_subject', 'exam_subject__exam']

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == 'STUDENT':
            return qs.filter(student__user=self.request.user)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'report_card'):
            return [IsAuthenticated()]
        return [IsAdminOrTeacher()]

    def perform_create(self, serializer):
        teacher = getattr(self.request.user, 'teacher_profile', None)
        serializer.save(entered_by=teacher)

    @action(detail=False, methods=['get'])
    def report_card(self, request):
        """?student=<id>&exam=<id> -> aggregated report card with total/percentage/rank."""
        student_id = request.query_params.get('student')
        exam_id = request.query_params.get('exam')
        if not student_id or not exam_id:
            return Response({'detail': 'student and exam query params are required.'}, status=400)

        if request.user.role == 'STUDENT':
            own_student = getattr(request.user, 'student_profile', None)
            if not own_student or str(own_student.id) != str(student_id):
                return Response({'detail': 'You may only view your own report card.'}, status=403)

        marks = Mark.objects.filter(student_id=student_id, exam_subject__exam_id=exam_id)
        total_obtained = marks.aggregate(t=Sum('marks_obtained'))['t'] or 0
        total_max = marks.aggregate(t=Sum('exam_subject__max_marks'))['t'] or 0
        percentage = round((float(total_obtained) / float(total_max)) * 100, 2) if total_max else 0

        # Rank within class for this exam
        class_totals = (
            Mark.objects.filter(exam_subject__exam_id=exam_id)
            .values('student')
            .annotate(total=Sum('marks_obtained'))
            .order_by('-total')
        )
        rank = next((i + 1 for i, row in enumerate(class_totals) if str(row['student']) == str(student_id)), None)

        return Response({
            'student_id': int(student_id),
            'exam_id': int(exam_id),
            'subjects': MarkSerializer(marks, many=True).data,
            'total_marks_obtained': float(total_obtained),
            'total_max_marks': float(total_max),
            'percentage': percentage,
            'rank': rank,
        })
