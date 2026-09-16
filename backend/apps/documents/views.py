from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdmin, IsAdminOrTeacher
from .models import GeneratedDocument, BackupRecord
from .serializers import GeneratedDocumentSerializer, BackupRecordSerializer


class GeneratedDocumentViewSet(viewsets.ModelViewSet):
    """Admin/Teacher generate documents (ID cards, report cards, receipts).
    A student may only view (never create/edit/delete) their own."""
    queryset = GeneratedDocument.objects.all()
    serializer_class = GeneratedDocumentSerializer
    filterset_fields = ['document_type', 'student']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT' and self.action == 'list':
            return qs.filter(student__user=user)
        return qs

    def get_permissions(self):
        if self.action in ('list',):
            return [IsAuthenticated()]
        if self.action == 'retrieve':
            return [_GeneratedDocDetailPermission()]
        return [IsAdminOrTeacher()]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class _GeneratedDocDetailPermission(IsAuthenticated):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ('ADMIN', 'TEACHER'):
            return True
        if user.role == 'STUDENT':
            return obj.student and obj.student.user == user
        return False


class BackupViewSet(viewsets.ModelViewSet):
    """Admin-only. Records metadata for a database backup/restore operation.

    Recording a BackupRecord here does not itself run `pg_dump` -- see
    docs/DEPLOYMENT.md for the recommended backup command/cron setup. This
    endpoint exists so the admin dashboard can show backup history
    regardless of how the underlying dump was produced.
    """
    queryset = BackupRecord.objects.all()
    serializer_class = BackupRecordSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save(triggered_by=self.request.user, status=BackupRecord.Status.SUCCESS)
