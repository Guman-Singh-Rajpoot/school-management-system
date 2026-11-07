from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.models import User
from apps.accounts.permissions import IsSchoolAdmin, IsSelfUser, IsAdmin
from .models import Announcement, Message, Notification, WhatsAppConfig, WhatsAppNotification
from .serializers import (
    AnnouncementSerializer, MessageSerializer, NotificationSerializer,
    WhatsAppConfigSerializer, WhatsAppNotificationSerializer,
)
from . import services


class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    Only Admin creates/edits/deletes announcements. Authenticated users see
    announcements targeted at their audience -- but only *published* ones
    (is_published=True). Admin sees all (drafts too).

    When an announcement is published, an in-app Notification is fanned out
    and (if configured) WhatsApp messages are sent.
    """
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    filterset_fields = ['audience', 'class_room', 'is_published']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admin/Owner sees everything (drafts + published)
        if is_school_admin(user):
            return qs

        # Non-admins only see published announcements within the date window
        qs = qs.filter(is_published=True).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=today)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        )

        if user.role == 'STUDENT':
            student = getattr(user, 'student_profile', None)
            q = (
                Q(audience=Announcement.Audience.ALL)
                | Q(audience=Announcement.Audience.STUDENTS)
            )
            if student and student.school_class:
                q |= Q(audience=Announcement.Audience.CLASS, class_room=student.school_class)
            if student and student.section:
                q |= Q(audience=Announcement.Audience.SECTION, section=student.section)
            return qs.filter(q)

        if user.role == 'TEACHER':
            return qs.filter(
                Q(audience=Announcement.Audience.ALL)
                | Q(audience=Announcement.Audience.TEACHERS)
            )

        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'publish', 'unpublish'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        if announcement.is_published:
            self._fan_out(announcement)

    def perform_update(self, serializer):
        was_published = self.get_object().is_published
        announcement = serializer.save()
        # Fan out only on the transition from draft → published
        if not was_published and announcement.is_published:
            self._fan_out(announcement)

    def _fan_out(self, announcement):
        """Create in-app Notifications and attempt WhatsApp dispatch."""
        recipients = _audience_users(announcement)

        Notification.objects.bulk_create([
            Notification(
                recipient=recipient,
                announcement=announcement,
                title=announcement.title,
                message=announcement.message,
            )
            for recipient in recipients
        ])

        # Push dispatch (in-app, existing FCM stub)
        for notification in announcement.notifications.all():
            services.dispatch(notification)

        # WhatsApp dispatch (new)
        try:
            from .whatsapp import send_announcement_notifications
            send_announcement_notifications(announcement)
        except Exception:
            pass

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        announcement = self.get_object()
        if announcement.is_published:
            return Response({'detail': 'Already published.'})
        announcement.is_published = True
        announcement.save(update_fields=['is_published', 'updated_at'])
        self._fan_out(announcement)
        return Response(AnnouncementSerializer(announcement).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        announcement = self.get_object()
        announcement.is_published = False
        announcement.save(update_fields=['is_published', 'updated_at'])
        return Response(AnnouncementSerializer(announcement).data)


def _audience_users(announcement):
    """Return queryset of User objects targeted by an announcement."""
    audience = announcement.audience
    if audience == Announcement.Audience.ALL:
        return User.objects.filter(role__in=[User.Role.TEACHER, User.Role.STUDENT], is_active=True)
    if audience == Announcement.Audience.TEACHERS:
        return User.objects.filter(role=User.Role.TEACHER, is_active=True)
    if audience == Announcement.Audience.STUDENTS:
        return User.objects.filter(role=User.Role.STUDENT, is_active=True)
    if audience == Announcement.Audience.CLASS and announcement.class_room:
        return User.objects.filter(
            role=User.Role.STUDENT, is_active=True,
            student_profile__school_class=announcement.class_room
        )
    if audience == Announcement.Audience.SECTION and announcement.section:
        return User.objects.filter(
            role=User.Role.STUDENT, is_active=True,
            student_profile__section=announcement.section
        )
    return User.objects.none()


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer

    def get_queryset(self):
        user = self.request.user
        return Message.objects.filter(Q(sender=user) | Q(recipient=user))

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Each user sees only notifications addressed to them.
    """
    queryset = Notification.objects.select_related('recipient', 'announcement').all()
    serializer_class = NotificationSerializer
    http_method_names = ['get', 'patch', 'head', 'options']
    filterset_fields = ['is_read']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admin/Owner sees all notifications
        if is_school_admin(user):
            return qs
        return qs.filter(recipient=user)

    def get_permissions(self):
        if self.action in ('list', 'unread_count'):
            return [IsAuthenticated()]
        return [IsSelfUser()]

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class WhatsAppConfigViewSet(viewsets.ModelViewSet):
    """Admin-only: manage the WhatsApp config (get or update the single row)."""
    queryset = WhatsAppConfig.objects.all()
    serializer_class = WhatsAppConfigSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def get_object(self):
        # Always operate on the first (and only) config row
        obj, _ = WhatsAppConfig.objects.get_or_create(pk=1)
        return obj

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Returns whether WhatsApp is configured and the feature toggles."""
        cfg = WhatsAppConfig.objects.first()
        from django.conf import settings
        env_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')
        env_pid = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
        is_configured = bool(
            (env_token and env_pid)
            or (cfg and cfg.enabled and cfg.access_token and cfg.phone_number_id)
        )
        return Response({
            'is_configured': is_configured,
            'using_env_vars': bool(env_token and env_pid),
            'config': WhatsAppConfigSerializer(cfg).data if cfg else None,
        })


class WhatsAppNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only: browse the WhatsApp notification log and retry failures."""
    queryset = WhatsAppNotification.objects.all()
    serializer_class = WhatsAppNotificationSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ['status', 'category', 'recipient']
    search_fields = ['recipient_number', 'message_body']

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Re-send a failed notification."""
        notif = self.get_object()
        if notif.status == WhatsAppNotification.Status.SENT:
            return Response({'detail': 'Already sent.'})
        from .whatsapp import send_whatsapp
        new_notif = send_whatsapp(
            to=notif.recipient_number,
            message=notif.message_body,
            category=notif.category,
            template_name=notif.template_name,
            user=notif.recipient,
            announcement=notif.announcement,
        )
        return Response(WhatsAppNotificationSerializer(new_notif).data)
