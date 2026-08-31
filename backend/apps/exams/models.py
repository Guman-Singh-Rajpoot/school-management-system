
# apps/exams/models.py

from django.db import models


class Exam(models.Model):
    class ExamType(models.TextChoices):
        UNIT_TEST = 'UNIT_TEST', 'Unit Test'
        MIDTERM = 'MIDTERM', 'Midterm'
        FINAL = 'FINAL', 'Final'
        OTHER = 'OTHER', 'Other'

    name = models.CharField(max_length=150)

    exam_type = models.CharField(
        max_length=15,
        choices=ExamType.choices
    )

    school_class = models.ForeignKey(
        'academics.SchoolClass',
        on_delete=models.CASCADE,
        related_name='exams'
    )

    session = models.ForeignKey(
        'academics.Session',
        on_delete=models.CASCADE,
        related_name='exams'
    )

    start_date = models.DateField()
    end_date = models.DateField()

    room = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Exam room/hall, if applicable.'
    )

    calendar_file = models.FileField(
        upload_to='exam_calendars/',
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class ExamSubject(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='exam_subjects'
    )

    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='exam_subjects'
    )

    date = models.DateField(
        null=True,
        blank=True
    )

    max_marks = models.PositiveIntegerField(
        default=100
    )

    passing_marks = models.PositiveIntegerField(
        default=33
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['exam', 'subject'],
                name='unique_exam_subject'
            )
        ]

    def __str__(self):
        return f"{self.exam.name} - {self.subject.name}"


class Grade(models.Model):
    name = models.CharField(
        max_length=5
    )

    min_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )

    max_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )

    grade_point = models.DecimalField(
        max_digits=4,
        decimal_places=2
    )

    class Meta:
        ordering = ['-min_percentage']

    def __str__(self):
        return self.name


class Mark(models.Model):
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='marks'
    )

    exam_subject = models.ForeignKey(
        ExamSubject,
        on_delete=models.CASCADE,
        related_name='marks'
    )

    marks_obtained = models.DecimalField(
        max_digits=6,
        decimal_places=2
    )

    grade = models.ForeignKey(
        Grade,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marks'
    )

    entered_by = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marks_entered'
    )

    remarks = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'exam_subject'],
                name='unique_student_exam_subject_mark'
            )
        ]

    def __str__(self):
        return (
            f"{self.student} - "
            f"{self.exam_subject} - "
            f"{self.marks_obtained}"
        )

