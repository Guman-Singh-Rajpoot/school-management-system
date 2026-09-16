from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminOrTeacher, IsSelfStudentOrTeacherViaStudentFK
from .models import Attendance
from .serializers import AttendanceSerializer, BulkAttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    Admin/Teacher: manage attendance (mark/edit) for students.
    Student: read-only, and only their OWN attendance -- can never modify
        attendance, and requesting another student's attendance by ID
        returns 403 rather than a silent 404.
    """
    queryset = Attendance.objects.select_related('student__user').all()
    serializer_class = AttendanceSerializer
    filterset_fields = ['student', 'date', 'status']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT' and self.action != 'retrieve':
            # Covers list/summary/etc -- a student's aggregate views (e.g.
            # attendance percentage) must only ever reflect their own record.
            return qs.filter(student__user=user)
        # retrieve (and admin/teacher access): unfiltered -- object-level
        # permission enforces ownership so a foreign ID returns 403, not 404.
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'bulk_mark'):
            return [IsAdminOrTeacher()]
        if self.action == 'retrieve':
            return [IsSelfStudentOrTeacherViaStudentFK()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        teacher = getattr(self.request.user, 'teacher_profile', None)
        serializer.save(marked_by=teacher)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrTeacher])
    def bulk_mark(self, request):
        """Mark attendance for an entire class/section in one call."""
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        date = serializer.validated_data['date']
        teacher = getattr(request.user, 'teacher_profile', None)
        created = []
        for record in serializer.validated_data['records']:
            obj, _ = Attendance.objects.update_or_create(
                student_id=record['student'], date=date,
                defaults={'status': record['status'], 'remarks': record.get('remarks', ''), 'marked_by': teacher},
            )
            created.append(obj.id)
        return Response({'updated_ids': created}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Attendance percentage summary, optionally filtered by student/date range."""
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
