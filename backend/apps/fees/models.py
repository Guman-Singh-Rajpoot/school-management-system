
import uuid

from datetime import date

from django.db import models
from decimal import Decimal
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db.models import Sum

from apps.accounts.models import User
from apps.students.models import Student


class FeeStructure(models.Model):
    """
    Defines one fee category's charge for a particular class and session.

    Examples: Tuition, Transport, Examination Fee, Computer Fee,
    Activity Fee, or any custom category the school admin creates.

    The admin's shown monthly total is the sum of the active rows for a
    class.

    Due/portfolio rules:
    - ``due_day`` (1-28) is when each monthly bill falls due.
    - ``late_fee_amount`` is applied when generating overdue months.
    - Editing ``amount`` only affects billing periods generated AFTER the
      edit; existing StudentFee rows store their own captured amount so
      historical invoices and payments never silently change.
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

    # Legacy single due date; kept for ad-hoc/one-off structures. Monthly
    # billing uses due_day instead.
    due_date = models.DateField(
        null=True,
        blank=True,
    )

    # Day of the month (1-28) on which each generated monthly bill is due.
    due_day = models.PositiveSmallIntegerField(
        default=10,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
        help_text="Day of month the generated bill is due (1-28).",
    )

    late_fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        help_text="Extra charge applied to overdue monthly bills.",
    )

    active = models.BooleanField(
        default=True,
        help_text="Inactive categories are excluded from monthly generation.",
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ['school_class', 'fee_type']
        constraints = [
            models.UniqueConstraint(
                fields=['school_class', 'session', 'fee_type'],
                name='unique_fee_category_per_class_session',
            ),
        ]

    def __str__(self):
        return (
            f'{self.school_class} - '
            f'{self.fee_type} - '
            f'{self.amount}'
        )


class StudentFee(models.Model):
    """
    A generated monthly bill for one student and one fee category.

    ``gross_amount`` is captured from the FeeStructure at generation time.
    When the admin later edits the structure, historical bills keep their
    captured amount; only new billing periods use the new amount. Paid
    invoices are never silently altered.
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

    # Amount captured from the fee structure when the bill was generated.
    gross_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
    )

    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0')
    )

    scholarship_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0')
    )

    # Month-wise tracking: which month/year this fee applies to.
    month = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text="Month (1-12) for monthly fee tracking",
    )
    year = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Year for monthly fee tracking",
    )

    # Due date captured at generation time (from the structure's due_day
    # for the bill's month). Kept per-row so overdue logic and receipts
    # never depend on later structure edits.
    due_date = models.DateField(
        null=True,
        blank=True,
    )

    # Stored payment status: PENDING / PARTIALLY_PAID / PAID / OVERDUE.
    # Computed from payments but stored for efficient querying.
    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        OVERDUE = 'OVERDUE', 'Overdue'

    payment_status_field = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    @property
    def net_payable(self):
        """What this student actually owes after discount/scholarship."""
        payable = self.gross_amount - self.discount_amount - self.scholarship_amount
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
    def calculated_due_date(self):
        if self.due_date:
            return self.due_date
        if self.month and self.year:
            import calendar
            try:
                days = calendar.monthrange(self.year, self.month)[1]
                return date(self.year, self.month, min(self.fee_structure.due_day, days))
            except (TypeError, ValueError):
                return None
        return self.fee_structure.due_date

    @property
    def payment_status(self):
        """Computed payment status reflecting actual payments made."""
        if self.net_payable <= 0:
            return 'PAID'
        if self.remaining_amount <= 0:
            return 'PAID'
        due = self.calculated_due_date
        if due is not None:
            from django.utils.timezone import now
            if now().date() > due:
                return 'OVERDUE'
        if self.paid_amount > 0:
            return 'PARTIALLY_PAID'
        return 'PENDING'

    def save(self, *args, **kwargs):
        # Capture the structure's amount on first save so later structure
        # edits cannot rewrite history.
        if self.pk is None:
            if not self.gross_amount:
                self.gross_amount = self.fee_structure.amount
            if self.due_date is None and self.month and self.year:
                import calendar
                from datetime import date
                try:
                    days = calendar.monthrange(self.year, self.month)[1]
                    self.due_date = date(self.year, self.month, min(self.fee_structure.due_day, days))
                except (TypeError, ValueError):
                    pass
            self.payment_status_field = 'PENDING'
        else:
            self.payment_status_field = self.payment_status
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-year', '-month', 'student']
        constraints = [
            # One bill per student, billing period and fee category.
            models.UniqueConstraint(
                fields=['student', 'fee_structure', 'month', 'year'],
                name='unique_student_fee_per_period_category',
                condition=models.Q(month__isnull=False) & models.Q(year__isnull=False),
            ),
        ]

    def __str__(self):
        return (
            f'{self.student} - '
            f'{self.fee_structure.fee_type} - '
            f'{self.net_payable}'
        )


class StudentFeeAdjustment(models.Model):
    """
    A recurring, student-specific fee adjustment for one fee category.

    Applied automatically each time monthly bills are generated: any
    active adjustment matching the generated category reduces that
    student's bill by the configured discount/scholarship amount.

    Admin-created only; individual generated bills may still be edited
    directly for a one-off change.
    """

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='fee_adjustments'
    )

    # Matches FeeStructure.fee_type (case-insensitive) at generation time,
    # e.g. "Tuition" or "Transport". Survives class transfers (unlike an
    # FK to a class-specific structure).
    fee_type = models.CharField(max_length=100)

    discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0')
    )

    scholarship_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0')
    )

    # Human explanation: "Save the Girl Child scholarship", "Staff ward
    # concession", "Sibling discount" etc.
    concession_reason = models.CharField(max_length=255, blank=True)

    active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fee_adjustments_created',
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'fee_type'],
                condition=models.Q(active=True),
                name='unique_active_adjustment_per_category',
            ),
        ]

    def __str__(self):
        return (
            f'{self.student} - {self.fee_type} - '
            f'discount {self.discount_amount} / scholarship {self.scholarship_amount}'
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

    receipt_number = models.CharField(max_length=36, unique=True, default=uuid.uuid4)

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

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_payments_recorded'
    )

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Keep the parent StudentFee's stored status in sync.
        self.student_fee.save(update_fields=['payment_status_field'])

    def delete(self, *args, **kwargs):
        student_fee = self.student_fee
        super().delete(*args, **kwargs)
        student_fee.save(update_fields=['payment_status_field'])

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
