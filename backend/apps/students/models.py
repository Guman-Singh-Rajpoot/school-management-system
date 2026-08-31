from django.db import models
from apps.accounts.models import User


class Student(models.Model):
    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'
        OTHER = 'O', 'Other'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        GRADUATED = 'GRADUATED', 'Graduated'
        TRANSFERRED = 'TRANSFERRED', 'Transferred'

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )

    # Personal information
    admission_number = models.CharField(
        max_length=30,
        unique=True
    )
    roll_number = models.CharField(
        max_length=30,
        blank=True
    )
    middle_name = models.CharField(
        max_length=100,
        blank=True
    )
    gender = models.CharField(
        max_length=1,
        choices=Gender.choices
    )
    date_of_birth = models.DateField()
    blood_group = models.CharField(
        max_length=5,
        blank=True
    )
    category = models.CharField(
        max_length=50,
        blank=True
    )
    religion = models.CharField(
        max_length=50,
        blank=True
    )
    nationality = models.CharField(
        max_length=50,
        default='Indian'
    )
    aadhaar_number = models.CharField(
        max_length=12,
        blank=True
    )
    pan_number = models.CharField(
        max_length=10,
        blank=True
    )
    mobile_number = models.CharField(
        max_length=15,
        blank=True
    )

    # Parent / guardian
    father_name = models.CharField(
        max_length=150,
        blank=True
    )
    father_mobile = models.CharField(
        max_length=15,
        blank=True
    )
    father_occupation = models.CharField(
        max_length=100,
        blank=True
    )
    mother_name = models.CharField(
        max_length=150,
        blank=True
    )
    mother_mobile = models.CharField(
        max_length=15,
        blank=True
    )
    mother_occupation = models.CharField(
        max_length=100,
        blank=True
    )
    guardian_name = models.CharField(
        max_length=150,
        blank=True
    )
    guardian_mobile = models.CharField(
        max_length=15,
        blank=True
    )
    guardian_relation = models.CharField(
        max_length=50,
        blank=True
    )

    # Address
    current_address = models.TextField(
        blank=True
    )
    permanent_address = models.TextField(
        blank=True
    )
    city = models.CharField(
        max_length=100,
        blank=True
    )
    district = models.CharField(
        max_length=100,
        blank=True
    )
    state = models.CharField(
        max_length=100,
        blank=True
    )
    country = models.CharField(
        max_length=100,
        default='India'
    )
    pin_code = models.CharField(
        max_length=10,
        blank=True
    )

    # Academic
    admission_date = models.DateField()

    session = models.ForeignKey(
        'academics.Session',
        on_delete=models.SET_NULL,
        null=True,
        related_name='students'
    )

    school_class = models.ForeignKey(
        'academics.SchoolClass',
        on_delete=models.SET_NULL,
        null=True,
        related_name='students'
    )

    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )

    batch = models.CharField(
        max_length=50,
        blank=True
    )

    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.ACTIVE
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"{self.admission_number} - "
            f"{self.user.get_full_name()}"
        )
class StudentDocument(models.Model):
    class DocType(models.TextChoices):
        AADHAAR = 'AADHAAR', 'Aadhaar'
        BIRTH_CERT = 'BIRTH_CERT', 'Birth Certificate'
        TRANSFER_CERT = 'TRANSFER_CERT', 'Transfer Certificate'
        MIGRATION_CERT = 'MIGRATION_CERT', 'Migration Certificate'
        MARKSHEET = 'MARKSHEET', 'Marksheet'
        CHARACTER_CERT = 'CHARACTER_CERT', 'Character Certificate'
        INCOME_CERT = 'INCOME_CERT', 'Income Certificate'
        CASTE_CERT = 'CASTE_CERT', 'Caste Certificate'
        PASSPORT_PHOTO = 'PASSPORT_PHOTO', 'Passport Photo'
        OTHER = 'OTHER', 'Other'

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='documents'
    )

    doc_type = models.CharField(
        max_length=20,
        choices=DocType.choices
    )

    file = models.FileField(
        upload_to='student_documents/'
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True
    )

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_documents_uploaded'
    )

    verified = models.BooleanField(
        default=False
    )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.student.admission_number} - {self.doc_type}"    