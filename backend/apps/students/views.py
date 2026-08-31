from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdmin, IsAdminOrSelfStudent
from .models import Student, StudentDocument
from .serializers import (
    StudentSerializer,
    StudentCreateSerializer,
    StudentDocumentSerializer,
)


class StudentViewSet(viewsets.ModelViewSet):

    queryset = Student.objects.select_related(
        "user",
        "session",
        "school_class",
        "section",
    ).all()

    permission_classes = [IsAuthenticated, IsAdminOrSelfStudent]

    def get_serializer_class(self):
        if self.action == "create":
            return StudentCreateSerializer

        return StudentSerializer

    def get_queryset(self):
        user = self.request.user

        if not user or not user.is_authenticated:
            return Student.objects.none()

        queryset = self.queryset

        # ADMIN → all students
        if user.role == "ADMIN":
            pass

        # TEACHER → can view students
        elif user.role == "TEACHER":
            pass

        # STUDENT → only own student for list; retrieve/update/destroy
        # deliberately stay unfiltered here so a foreign-ID lookup is
        # turned into a 403 by the object-level permission, not a 404.
        elif user.role == "STUDENT":
            if self.action == "list":
                queryset = queryset.filter(user=user)

        else:
            queryset = Student.objects.none()

        search = self.request.query_params.get("search")

        if search:
            queryset = queryset.filter(
                Q(admission_number__icontains=search)
                | Q(middle_name__icontains=search)
                | Q(mobile_number__icontains=search)
                | Q(father_name__icontains=search)
                | Q(mother_name__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save()


class StudentDocumentViewSet(viewsets.ModelViewSet):

    queryset = StudentDocument.objects.select_related(
        "student__user",
        "uploaded_by",
    ).all()

    serializer_class = StudentDocumentSerializer

    def get_queryset(self):
        user = self.request.user

        if not user or not user.is_authenticated:
            return StudentDocument.objects.none()

        if user.role == "ADMIN":
            return self.queryset

        if user.role == "STUDENT":
            return self.queryset.filter(student__user=user)

        return StudentDocument.objects.none()

    def get_permissions(self):

        if self.action in ("list", "retrieve"):
            return [
                IsAuthenticated(),
            ]

        return [
            IsAuthenticated(),
            IsAdmin(),
        ]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)