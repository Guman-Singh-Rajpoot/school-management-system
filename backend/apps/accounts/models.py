from django.contrib.auth.models import AbstractUser
from django.db import models


class School(models.Model):
    """Represents a registered school entity in the system."""
    name = models.CharField(max_length=255)
    registration_number = models.CharField(
        max_length=100,
        unique=True,
        blank=True,
        null=True,
        help_text="Official school registration or affiliation number"
    )
    affiliation_number = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pin_code = models.CharField(max_length=10, blank=True)
    email = models.EmailField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    owner = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_schools'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom user with a role field driving role-based permissions."""

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        OWNER = 'OWNER', 'School Owner'
        TEACHER = 'TEACHER', 'Teacher'
        STUDENT = 'STUDENT', 'Student'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    school = models.ForeignKey(
        School,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    phone = models.CharField(max_length=15, blank=True)
    school_name = models.CharField(max_length=255, blank=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    is_active_session = models.BooleanField(default=True)  # multi-session support flag
    # When True the user MUST change their password before accessing any page.
    # Set to True when the admin creates an account with a temporary password.
    must_change_password = models.BooleanField(default=False)
    whatsapp_number = models.CharField(max_length=20, blank=True, help_text="WhatsApp number with country code, e.g. +919876543210")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_admin(self):
        return self.role in [self.Role.ADMIN, self.Role.OWNER] or self.is_superuser or self.is_staff

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER or (self.role == self.Role.ADMIN and self.owned_schools.exists())

    def save(self, *args, **kwargs):
        if (self.is_superuser or self.is_staff) and self.role not in [self.Role.ADMIN, self.Role.OWNER]:
            self.role = self.Role.ADMIN
        if self.school and not self.school_name:
            self.school_name = self.school.name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


class AuditLog(models.Model):
    """Tracks sensitive actions across the system for security/compliance."""

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=255)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(blank=True, default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} - {self.timestamp}"


class PasswordResetToken(models.Model):
    """
    Secure single-use password reset token.
    Stores a cryptographic SHA-256 hash of the token so plaintext tokens
    are never stored in the database.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def hash_token(cls, raw_token):
        import hashlib
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def create_token(cls, user, ip_address=None, lifetime_hours=1):
        import secrets
        from datetime import timedelta
        from django.utils import timezone

        raw_token = secrets.token_urlsafe(32)
        token_hash = cls.hash_token(raw_token)
        expires_at = timezone.now() + timedelta(hours=lifetime_hours)
        # Invalidate any previous unexpired unused tokens for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True, used_at=timezone.now())
        cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
        )
        return raw_token

    @classmethod
    def verify_token(cls, raw_token):
        from django.utils import timezone

        if not raw_token or not isinstance(raw_token, str):
            return None, "Reset token is required."

        token_hash = cls.hash_token(raw_token.strip())
        try:
            record = cls.objects.select_related('user').get(token_hash=token_hash)
        except cls.DoesNotExist:
            return None, "Invalid or unrecognized reset token."

        if record.is_used:
            return None, "This password reset token has already been used."

        if timezone.now() > record.expires_at:
            return None, "This password reset token has expired. Please request a new one."

        return record, None

    def mark_used(self):
        from django.utils import timezone
        self.is_used = True
        self.used_at = timezone.now()
        self.save(update_fields=['is_used', 'used_at'])

