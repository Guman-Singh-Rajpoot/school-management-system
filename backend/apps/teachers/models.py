from django.db import models
from apps.accounts.models import User


class Teacher(models.Model):
    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'
        OTHER = 'O', 'Other'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')

    employee_id = models.CharField(max_length=30, unique=True)
    gender = models.CharField(max_length=1, choices=Gender.choices)
    date_of_birth = models.DateField()
    qualification = models.CharField(max_length=255)
    experience_years = models.PositiveIntegerField(default=0)
    department = models.CharField(max_length=100)
    subjects = models.ManyToManyField('academics.Subject', related_name='teachers', blank=True)
    classes = models.ManyToManyField('academics.SchoolClass', related_name='teachers', blank=True)

    aadhaar_number = models.CharField(max_length=12, blank=True)
    pan_number = models.CharField(max_length=10, blank=True)

    bank_account_number = models.CharField(max_length=30, blank=True)
    bank_ifsc = models.CharField(max_length=15, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    joining_date = models.DateField()
    address = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name()}"


class TeacherDocument(models.Model):
    class DocType(models.TextChoices):
        AADHAAR = 'AADHAAR', 'Aadhaar'
        RESUME = 'RESUME', 'Resume/CV'
        DEGREE = 'DEGREE', 'Degree Certificate'
        OTHER = 'OTHER', 'Other'

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=20, choices=DocType.choices)
    file = models.FileField(upload_to='teacher_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='teacher_documents_uploaded'
    )
    verified = models.BooleanField(default=False)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.teacher.employee_id} - {self.doc_type}"


class TeacherSalary(models.Model):
    """The salary due for one teacher for one calendar month (the 'structure' row)."""

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='salaries')
    # Always normalized to the 1st of the month, e.g. 2026-08-01 for August 2026.
    salary_month = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='teacher_salaries_created'
    )

    class Meta:
        unique_together = ('teacher', 'salary_month')
        ordering = ['-salary_month']

    @property
    def paid_amount(self):
        return sum(p.amount for p in self.payments.all())

    @property
    def remaining_amount(self):
        return self.amount - self.paid_amount

    def __str__(self):
        return f"{self.teacher.employee_id} - {self.salary_month:%b %Y}"


class SalaryPayment(models.Model):
    """An individual instalment paid against a teacher's monthly TeacherSalary."""

    class Method(models.TextChoices):
        CASH = 'CASH', 'Cash'
        CARD = 'CARD', 'Card'
        UPI = 'UPI', 'UPI'
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        CHEQUE = 'CHEQUE', 'Cheque'

    teacher_salary = models.ForeignKey(
        TeacherSalary, on_delete=models.CASCADE, related_name='payments'
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=Method.choices)
    reference_number = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='salary_payments_recorded'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.teacher_salary.teacher.employee_id} - {self.amount} on {self.created_at:%Y-%m-%d}"
class TeacherAttendance(models.Model):

    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        LEAVE = "LEAVE", "Leave"

    teacher = models.ForeignKey(
        "teachers.Teacher",
        on_delete=models.CASCADE,
        related_name="attendance_records"
    )

    date = models.DateField()

    status = models.CharField(
        max_length=10,
        choices=Status.choices
    )

    marked_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teacher_attendance_marked"
    )

    remarks = models.CharField(
        max_length=255,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        unique_together = ("teacher", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"{self.teacher} - {self.date} - {self.status}"    
