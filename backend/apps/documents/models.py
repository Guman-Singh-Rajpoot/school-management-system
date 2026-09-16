
from django.db import models

from apps.accounts.models import User
from apps.students.models import Student
from apps.teachers.models import Teacher


class GeneratedDocument(models.Model):
    """
    Tracks generated documents such as:
    - ID cards
    - Report cards
    - Fee receipts
    - Salary receipts
    """

    class DocumentType(models.TextChoices):
        ID_CARD = 'ID_CARD', 'ID Card'
        REPORT_CARD = 'REPORT_CARD', 'Report Card'
        FEE_RECEIPT = 'FEE_RECEIPT', 'Fee Receipt'
        SALARY_RECEIPT = 'SALARY_RECEIPT', 'Salary Receipt'
        OTHER = 'OTHER', 'Other'

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='generated_documents'
    )

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='generated_documents'
    )

    document_type = models.CharField(
        max_length=100,
        choices=DocumentType.choices
    )

    file = models.FileField(
        upload_to='documents/'
    )

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='generated_documents_uploaded'
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        owner = self.student or self.teacher

        return f'{self.document_type} - {owner}'


class BackupRecord(models.Model):
    """
    Metadata for database backup/restore operations.
    """

    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'

    file = models.FileField(
        upload_to='backups/',
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices
    )

    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='backup_records'
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    notes = models.TextField(
        blank=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Backup - {self.status} - {self.created_at}'

