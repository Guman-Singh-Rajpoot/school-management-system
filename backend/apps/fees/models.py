import uuid

from django.db import models
from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db.models import Sum

from apps.accounts.models import User
from apps.students.models import Student


class FeeStructure(models.Model):
    """
    Defines the fee applicable to a particular class and academic session.
    """

    school_class = models.ForeignKey(
        'academics.SchoolClass',
        on_delete=models.CASCADE,
        related_name='fee_structures'
    )

    session = models.ForeignKey(
        'academics.Session',
        on_delete=models.CASCADE,
        related_name='fee_structures'
    )

    fee_type = models.CharField(
        max_length=100
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )

    due_date = models.DateField()

    class Meta:
        ordering = ['school_class', 'fee_type']

    def __str__(self):
        return (
            f'{self.school_class} - '
            f'{self.fee_type} - '
            f'{self.amount}'
        )


class StudentFee(models.Model):
    """
    A FeeStructure assigned to an individual student, with any
    per-student discount/scholarship applied.
    """

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='fees'
    )

    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name='student_fees'
    )

    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    scholarship_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    @property
    def net_payable(self):
        """What this student actually owes after discount/scholarship."""
        payable = self.fee_structure.amount - self.discount_amount - self.scholarship_amount
        return max(payable, 0)

    @property
    def paid_amount(self):
        total = self.payments.aggregate(total=Sum('amount'))['total']
        return total or 0

    @property
    def remaining_amount(self):
        return max(self.net_payable - self.paid_amount, 0)

    # Kept as an alias for readability elsewhere in the codebase.
    @property
    def pending_amount(self):
        return self.remaining_amount

    @property
    def payment_status(self):
        if self.remaining_amount <= 0:
            return 'PAID'
        if self.paid_amount > 0:
            return 'PARTIAL'
        return 'UNPAID'

    def __str__(self):
        return (
            f'{self.student} - '
            f'{self.fee_structure.fee_type} - '
            f'{self.net_payable}'
        )


class Payment(models.Model):
    """
    Individual student fee payment.

    created_at (date + time) automatically stores when the admin recorded
    the payment; paid_on/created_by are likewise always backend-set.
    """

    class Method(models.TextChoices):
        CASH = 'CASH', 'Cash'
        CARD = 'CARD', 'Card'
        UPI = 'UPI', 'UPI'
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        CHEQUE = 'CHEQUE', 'Cheque'

    receipt_number = models.CharField(max_length=30, unique=True, default=uuid.uuid4)

    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.CASCADE,
        related_name='payments'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )

    method = models.CharField(
        max_length=20,
        choices=Method.choices,
    )

    paid_on = models.DateField(auto_now_add=True)
    remarks = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_payments_recorded'
    )

    class Meta:
        ordering = ['-created_at']

    @property
    def student(self):
        return self.student_fee.student

    @property
    def remaining_fee(self):
        return self.student_fee.remaining_amount

    def __str__(self):
        return (
            f'Fee Payment #{self.pk} - '
            f'{self.student_fee.student} - '
            f'{self.amount}'
        )
