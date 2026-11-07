"""
WhatsApp Business Cloud API notification service.

Credentials priority (highest → lowest):
  1. Environment variables (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
  2. WhatsAppConfig DB row

If neither is configured the system keeps working normally -- every
attempted dispatch is logged as NOT_CONFIGURED, and a clear warning banner
is shown in the admin dashboard.

Usage:
    from apps.announcements.whatsapp import send_whatsapp, send_announcement_notifications

    # Low-level send (returns WhatsAppNotification instance)
    notif = send_whatsapp(
        to="+919876543210",
        message="Hello!",
        category=WhatsAppNotification.Category.OTHER,
        user=user_instance,  # optional
    )

    # High-level: send announcement to all relevant recipients
    send_announcement_notifications(announcement)
"""

import logging
from datetime import datetime, timezone as tz

from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_config():
    """
    Return (access_token, phone_number_id, api_version) from env or DB.
    Returns (None, None, None) if not configured.
    """
    # Env vars take priority
    token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
    pid = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None)
    version = getattr(settings, 'WHATSAPP_API_VERSION', 'v18.0')

    if token and pid:
        return token, pid, version

    # Fall back to DB config
    try:
        from .models import WhatsAppConfig
        cfg = WhatsAppConfig.objects.first()
        if cfg and cfg.enabled and cfg.access_token and cfg.phone_number_id:
            return cfg.access_token, cfg.phone_number_id, cfg.api_version
    except Exception:
        pass

    return None, None, None


def _is_feature_enabled(feature_flag: str) -> bool:
    """Check a per-feature toggle from the DB config row."""
    try:
        from .models import WhatsAppConfig
        cfg = WhatsAppConfig.objects.first()
        if cfg and cfg.enabled:
            return bool(getattr(cfg, feature_flag, True))
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# Core send function
# ---------------------------------------------------------------------------

def send_whatsapp(
    to: str,
    message: str,
    category: str = 'OTHER',
    template_name: str = '',
    user=None,
    announcement=None,
) -> 'WhatsAppNotification':
    """
    Attempt to send a WhatsApp message.  Always creates and returns a
    WhatsAppNotification audit-log row, even on failure.

    Never raises -- delivery problems must never break the caller.
    """
    from .models import WhatsAppNotification

    # Clean phone number (must start with +)
    clean_to = to.strip()
    if not clean_to:
        logger.warning("send_whatsapp: empty recipient number, skipping.")
        return None

    log = WhatsAppNotification(
        recipient=user,
        recipient_number=clean_to,
        category=category,
        message_body=message,
        template_name=template_name,
        announcement=announcement,
        status=WhatsAppNotification.Status.PENDING,
    )

    access_token, phone_number_id, api_version = _get_config()

    if not access_token or not phone_number_id:
        log.status = WhatsAppNotification.Status.NOT_CONFIGURED
        log.error_message = (
            "WhatsApp credentials not configured. "
            "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your environment or admin config."
        )
        log.save()
        logger.warning("WhatsApp not configured -- notification logged as NOT_CONFIGURED for %s", clean_to)
        return log

    try:
        import urllib.request
        import json as _json

        url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"

        # Use text message type for non-template messages.
        # For production, switch to template messages to avoid 24-hour window restriction.
        if template_name:
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "en"},
                },
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_to,
                "type": "text",
                "text": {"body": message},
            }

        data = _json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            response_data = _json.loads(resp.read())

        msg_id = (
            response_data.get("messages", [{}])[0].get("id", "")
            if isinstance(response_data.get("messages"), list)
            else ""
        )
        log.status = WhatsAppNotification.Status.SENT
        log.provider_message_id = msg_id
        log.sent_at = datetime.now(tz.utc)

    except Exception as exc:
        log.status = WhatsAppNotification.Status.FAILED
        log.error_message = str(exc)[:1000]
        logger.error("WhatsApp send failed to %s: %s", clean_to, exc)

    log.save()
    return log


# ---------------------------------------------------------------------------
# High-level helpers
# ---------------------------------------------------------------------------

def send_announcement_notifications(announcement):
    """
    Send WhatsApp notifications to all users targeted by this announcement.
    Only fires if the feature is enabled in config.
    """
    if not _is_feature_enabled('notify_announcements'):
        return

    recipients = _get_announcement_recipients(announcement)
    for user in recipients:
        number = getattr(user, 'whatsapp_number', '').strip()
        if not number:
            continue
        send_whatsapp(
            to=number,
            message=f"📢 *{announcement.title}*\n\n{announcement.message}",
            category='ANNOUNCEMENT',
            user=user,
            announcement=announcement,
        )

    # Also notify parent WhatsApp numbers for student recipients
    from apps.students.models import Student
    student_users = [u for u in recipients if u.role == 'STUDENT']
    for user in student_users:
        try:
            student = user.student_profile
            parent_number = (student.father_mobile or student.mother_mobile or student.guardian_mobile or '').strip()
            if parent_number and parent_number != getattr(user, 'whatsapp_number', ''):
                send_whatsapp(
                    to=parent_number,
                    message=f"📢 *{announcement.title}*\n\n{announcement.message}",
                    category='ANNOUNCEMENT',
                    user=user,
                    announcement=announcement,
                )
        except Exception:
            pass


def _get_announcement_recipients(announcement):
    from apps.accounts.models import User
    from .models import Announcement

    audience = announcement.audience
    if audience == Announcement.Audience.ALL:
        return list(User.objects.filter(role__in=[User.Role.TEACHER, User.Role.STUDENT], is_active=True))
    elif audience == Announcement.Audience.TEACHERS:
        return list(User.objects.filter(role=User.Role.TEACHER, is_active=True))
    elif audience == Announcement.Audience.STUDENTS:
        return list(User.objects.filter(role=User.Role.STUDENT, is_active=True))
    elif audience == Announcement.Audience.CLASS and announcement.class_room:
        return list(User.objects.filter(
            role=User.Role.STUDENT, is_active=True,
            student_profile__school_class=announcement.class_room
        ))
    elif audience == Announcement.Audience.SECTION and announcement.section:
        return list(User.objects.filter(
            role=User.Role.STUDENT, is_active=True,
            student_profile__section=announcement.section
        ))
    return []


def send_fee_reminder(student_fee):
    """Send a fee due reminder to a student's WhatsApp."""
    if not _is_feature_enabled('notify_fee_reminder'):
        return
    user = student_fee.student.user
    number = getattr(user, 'whatsapp_number', '').strip()
    if not number:
        return
    msg = (
        f"Dear {user.get_full_name()},\n\n"
        f"Fee Reminder: ₹{student_fee.remaining_amount} is due for "
        f"{student_fee.fee_structure.fee_type}.\n"
        "Please make the payment at the earliest.\n\n"
        "— School Management"
    )
    send_whatsapp(to=number, message=msg, category='FEE_REMINDER', user=user)


def send_fee_paid_confirmation(payment):
    """Confirm fee payment to the student/parent."""
    if not _is_feature_enabled('notify_fee_paid'):
        return
    user = payment.student_fee.student.user
    number = getattr(user, 'whatsapp_number', '').strip()
    if not number:
        return
    msg = (
        f"Dear {user.get_full_name()},\n\n"
        f"✅ Payment Received: ₹{payment.amount} for "
        f"{payment.student_fee.fee_structure.fee_type}.\n"
        f"Receipt #: {payment.receipt_number}\n\n"
        "— School Management"
    )
    send_whatsapp(to=number, message=msg, category='FEE_PAID', user=user)


def send_salary_paid_notification(salary_payment):
    """Notify teacher that their salary instalment has been processed."""
    if not _is_feature_enabled('notify_salary_paid'):
        return
    user = salary_payment.teacher_salary.teacher.user
    number = getattr(user, 'whatsapp_number', '').strip()
    if not number:
        return
    month = salary_payment.teacher_salary.salary_month.strftime('%B %Y')
    msg = (
        f"Dear {user.get_full_name()},\n\n"
        f"✅ Salary Payment: ₹{salary_payment.amount} for {month} has been processed "
        f"via {salary_payment.payment_method}.\n\n"
        "— School Management"
    )
    send_whatsapp(to=number, message=msg, category='SALARY_PAID', user=user)


def send_account_created_notification(user, raw_password: str):
    """Send login credentials to a newly created teacher/student."""
    if not _is_feature_enabled('notify_account_created'):
        return
    number = getattr(user, 'whatsapp_number', '').strip()
    if not number:
        return
    msg = (
        f"Welcome, {user.get_full_name()}!\n\n"
        f"Your school account has been created.\n"
        f"Username: {user.username}\n"
        f"Password: {raw_password}\n\n"
        "Please log in and change your password immediately.\n"
        "— School Management"
    )
    send_whatsapp(to=number, message=msg, category='ACCOUNT_CREATED', user=user)


def send_student_absence_notification(student, attendance_date, status='ABSENT'):
    """Send WhatsApp absence notification to a student's parent/guardian.

    Must be called after the attendance record is successfully saved.
    Looks up the parent/guardian contact number from the student record
    and sends a message with the student's name, class, section, and date.

    Duplicate prevention: checks recent notification history to avoid
    sending duplicate messages for the same absence.

    Returns the WhatsAppNotification instance (may be None if not configured).
    """
    from apps.students.models import Student as StudentModel
    from django.utils import timezone

    # Ensure we're working with a Student instance
    if not isinstance(student, StudentModel):
        student = StudentModel.objects.get(user=student)

    number = None
    # Prefer father's mobile, then mother's, then guardian's
    if student.father_mobile:
        number = student.father_mobile.strip()
    elif student.mother_mobile:
        number = student.mother_mobile.strip()
    elif student.guardian_mobile:
        number = student.guardian_mobile.strip()

    if not number:
        logger.warning(
            "send_student_absence_notification: no parent/guardian mobile "
            "number for student %s (%s)",
            student.id,
            student.user.username if student.user else "unknown",
        )
        return None

    # Validate phone number starts with +
    if not number.startswith("+"):
        number = f"+{number}"

    # Duplicate prevention: check last 24 hours for same student + status
    from datetime import timedelta
    from apps.announcements.models import WhatsAppNotification
    recent_cutoff = timezone.now() - timedelta(hours=24)
    recent = WhatsAppNotification.objects.filter(
        recipient_number=number,
        category='STUDENT_ABSENCE',
        created_at__gte=recent_cutoff,
    )
    # Note: exact duplicate prevention would need the model to store
    # student_id; for now we check by recipient number only as a basic guard.
    if recent.exists():
        logger.info(
            "Skipping duplicate absence notification for %s (number %s)",
            student.id,
            number,
        )
        return recent.first()

    # Build message
    class_name = student.school_class.name if student.school_class else ""
    section_name = student.section.name if student.section else ""
    message = (
        f"Dear Parent/Guardian,\n\n"
        f"This is to inform you that your child {student.user.get_full_name() or student.user.username} "
        f"of Class {class_name} Section {section_name} was marked {status} on {attendance_date}.\n\n"
        "Please contact the school if you need any clarification.\n\n"
        "— School Management"
    )

    # Send via WhatsApp
    notif = send_whatsapp(
        to=number,
        message=message,
        category='STUDENT_ABSENCE',
        user=student.user,
    )

    logger.info(
        "Absence notification %s for student %s (number %s)",
        notif.status if notif else "not configured",
        student.id,
        number,
    )

    return notif
