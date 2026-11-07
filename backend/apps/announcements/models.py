
from django.db import models
from apps.accounts.models import User


class Announcement(models.Model):

    class Audience(models.TextChoices):
        ALL = 'ALL', 'Everyone'
        STUDENTS = 'STUDENTS', 'Students'
        TEACHERS = 'TEACHERS', 'Teachers'
        CLASS = 'CLASS', 'Specific Class'
        SECTION = 'SECTION', 'Specific Section'

    title = models.CharField(
        max_length=255
    )

    message = models.TextField()

    audience = models.CharField(
        max_length=20,
        choices=Audience.choices,
        default=Audience.ALL
    )

    # Required only when audience = CLASS
    class_room = models.ForeignKey(
        'academics.SchoolClass',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcements'
    )

    # Required only when audience = SECTION
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcements'
    )

    # Draft / published workflow
    is_published = models.BooleanField(
        default=False,
        help_text="Only published announcements are visible to teachers and students."
    )

    # Optional schedule window
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date from which this announcement becomes visible (inclusive)."
    )

    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date after which this announcement is no longer visible (inclusive)."
    )

    # WhatsApp notification was dispatched for this announcement
    whatsapp_sent = models.BooleanField(default=False)
    whatsapp_sent_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_announcements'
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
        return self.title


class Message(models.Model):
    """
    Direct message between users.
    """

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_messages'
    )

    body = models.TextField()

    sent_at = models.DateTimeField(
        auto_now_add=True
    )

    read = models.BooleanField(
        default=False
    )

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f'{self.sender} → {self.recipient}'


class Notification(models.Model):
    """
    Individual in-app notification delivered to a user.

    Notifications are normally created automatically when an
    announcement is created.
    """

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )

    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )

    title = models.CharField(
        max_length=255
    )

    message = models.TextField()

    is_read = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class DeliveryStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'
        NOT_CONFIGURED = 'NOT_CONFIGURED', 'Push Not Configured'

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.NOT_CONFIGURED
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.recipient} - {self.title}'


class WhatsAppConfig(models.Model):
    """Single-row table holding the school's WhatsApp Business API configuration."""
    access_token = models.CharField(max_length=512, blank=True)
    phone_number_id = models.CharField(max_length=100, blank=True)
    api_version = models.CharField(max_length=20, default='v18.0')
    enabled = models.BooleanField(default=False)
    notify_announcements = models.BooleanField(default=True)
    notify_fee_reminder = models.BooleanField(default=True)
    notify_fee_paid = models.BooleanField(default=True)
    notify_salary_paid = models.BooleanField(default=True)
    notify_account_created = models.BooleanField(default=True)
    notify_attendance = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "WhatsApp Configuration"

    def __str__(self):
        return f"WhatsApp Config (enabled={self.enabled})"


class WhatsAppNotification(models.Model):
    """Audit log for every WhatsApp message the system attempts to send."""

    class Category(models.TextChoices):
        ANNOUNCEMENT = 'ANNOUNCEMENT', 'Announcement'
        FEE_REMINDER = 'FEE_REMINDER', 'Fee Reminder'
        FEE_PAID = 'FEE_PAID', 'Fee Payment Confirmation'
        SALARY_PAID = 'SALARY_PAID', 'Salary Payment'
        ACCOUNT_CREATED = 'ACCOUNT_CREATED', 'Account Created'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password Reset'
        ATTENDANCE_ALERT = 'ATTENDANCE_ALERT', 'Attendance Alert'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'
        NOT_CONFIGURED = 'NOT_CONFIGURED', 'Not Configured'

    recipient = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='whatsapp_notifications'
    )
    recipient_number = models.CharField(max_length=20)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    message_body = models.TextField()
    template_name = models.CharField(max_length=100, blank=True)
    announcement = models.ForeignKey(
        'Announcement', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='whatsapp_notifications'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    provider_message_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"WA/{self.category} to {self.recipient_number} [{self.status}]"
