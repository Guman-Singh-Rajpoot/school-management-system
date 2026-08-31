
from django.db import models
from apps.accounts.models import User


class Announcement(models.Model):

    class Audience(models.TextChoices):
        ALL = 'ALL', 'Everyone'
        STUDENTS = 'STUDENTS', 'Students'
        TEACHERS = 'TEACHERS', 'Teachers'
        CLASS = 'CLASS', 'Specific Class'

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

