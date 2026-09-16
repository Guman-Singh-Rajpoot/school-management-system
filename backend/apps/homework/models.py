from django.db import models


class Homework(models.Model):
    section = models.ForeignKey('academics.Section', on_delete=models.CASCADE, related_name='homework')
    subject = models.ForeignKey('academics.Subject', on_delete=models.CASCADE, related_name='homework')
    teacher = models.ForeignKey('teachers.Teacher', on_delete=models.CASCADE, related_name='homework_created')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    attachment = models.FileField(upload_to='homework/', blank=True, null=True)
    assigned_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    class Meta:
        ordering = ['-assigned_date']

    def __str__(self):
        return self.title


class HomeworkSubmission(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        LATE = 'LATE', 'Late'
        GRADED = 'GRADED', 'Graded'

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='homework_submissions')
    attachment = models.FileField(upload_to='homework_submissions/')
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.SUBMITTED)
    grade_remarks = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('homework', 'student')

    def __str__(self):
        return f"{self.student} - {self.homework}"
