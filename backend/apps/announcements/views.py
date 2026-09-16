from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.models import User
from apps.accounts.permissions import IsAdmin, IsSelfUser
from .models import Announcement, Message, Notification
from .serializers import AnnouncementSerializer, MessageSerializer, NotificationSerializer
from . import services


class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    Only Admin creates/edits/deletes announcements. Everyone authenticated
    sees the announcements targeted at their audience (ALL / their role /
    their specific class). Creating an announcement automatically fans out
    an in-app Notification to every user in that audience.
    """
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    filterset_fields = ['audience', 'class_room']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'STUDENT':
            student = getattr(user, 'student_profile', None)
            q = Q(audience=Announcement.Audience.ALL) | Q(audience=Announcement.Audience.STUDENTS)
            if student and student.school_class:
                q |= Q(audience=Announcement.Audience.CLASS, class_room=student.school_class)
            return qs.filter(q)
        if user.role == 'TEACHER':
            return qs.filter(Q(audience=Announcement.Audience.ALL) | Q(audience=Announcement.Audience.TEACHERS))
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            # Only Admin manages announcements/notifications school-wide.
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        self._fan_out_notifications(announcement)

    def _fan_out_notifications(self, announcement):
        """Create one Notification per targeted user and attempt push delivery."""
        if announcement.audience == Announcement.Audience.ALL:
            recipients = User.objects.filter(role__in=[User.Role.TEACHER, User.Role.STUDENT])
        elif announcement.audience == Announcement.Audience.TEACHERS:
            recipients = User.objects.filter(role=User.Role.TEACHER)
        elif announcement.audience == Announcement.Audience.STUDENTS:
            recipients = User.objects.filter(role=User.Role.STUDENT)
        elif announcement.audience == Announcement.Audience.CLASS:
            recipients = User.objects.filter(
                role=User.Role.STUDENT, student_profile__school_class=announcement.class_room
            )
        else:
            recipients = User.objects.none()

        notifications = Notification.objects.bulk_create([
            Notification(
                recipient=recipient,
                announcement=announcement,
                title=announcement.title,
                message=announcement.message,
            )
            for recipient in recipients
        ])
        for notification in notifications:
            services.dispatch(notification)


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
    Each user (Admin, Teacher, Student) sees only notifications addressed
    to them. Notifications are created by the system (announcement
    fan-out), not directly by API clients -- so `create` isn't offered here;
    users may only read their own list and mark items as read.
    """
    queryset = Notification.objects.select_related('recipient', 'announcement').all()
    serializer_class = NotificationSerializer
    http_method_names = ['get', 'patch', 'head', 'options']
    filterset_fields = ['is_read']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == 'ADMIN':
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
