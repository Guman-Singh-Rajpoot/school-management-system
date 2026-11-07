from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import IsAdminOrReadOnly
from .models import Session, SchoolClass, Section, Subject
from .serializers import (
    SessionSerializer,
    SchoolClassSerializer,
    SectionSerializer,
    SubjectSerializer,
)


class SchoolScopedViewSet(viewsets.ModelViewSet):
    """
    All academic master data belongs to a school (via Session.chain).

    Members of a school see only their school's records; superusers see
    everything. Writes are validated against the caller's school.
    """

    school_filter_lookup = "session__school_id"

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if not user.school_id:
            return qs.filter(**{f"{self.school_filter_lookup}__isnull": True})
        return qs.filter(**{self.school_filter_lookup: user.school_id})


class SessionViewSet(SchoolScopedViewSet):
    school_filter_lookup = "school_id"
    queryset = Session.objects.select_related("school").all()
    serializer_class = SessionSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["school", "is_current"]


class SchoolClassViewSet(SchoolScopedViewSet):
    queryset = SchoolClass.objects.select_related("session", "session__school").all()
    serializer_class = SchoolClassSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["name", "session"]


class SectionViewSet(SchoolScopedViewSet):
    school_filter_lookup = "class_room__session__school_id"
    queryset = Section.objects.select_related("class_room", "class_room__session").all()
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["class_room", "name"]


class SubjectViewSet(SchoolScopedViewSet):
    school_filter_lookup = "school_class__session__school_id"
    queryset = Subject.objects.select_related("school_class", "school_class__session").all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["school_class", "is_elective"]
