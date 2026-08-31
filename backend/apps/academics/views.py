from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend

from .models import Session, SchoolClass, Section, Subject
from .serializers import (
    SessionSerializer,
    SchoolClassSerializer,
    SectionSerializer,
    SubjectSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Any authenticated user can view; only Admin can create/edit/delete.

    Students and teachers legitimately need to read sessions/classes/
    sections/subjects (for forms, timetables, etc.), but only Admin
    manages the academic structure itself.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and request.user.is_authenticated and request.user.role == 'ADMIN'
        )


class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.all()
    serializer_class = SessionSerializer
    permission_classes = [IsAdminOrReadOnly]


class SchoolClassViewSet(viewsets.ModelViewSet):
    queryset = SchoolClass.objects.select_related("session").all()
    serializer_class = SchoolClassSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["name", "session"]


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related("class_room").all()
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["class_room", "name"]


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related("school_class").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["school_class", "is_elective"]