from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsSchoolAdmin, IsAdmin, IsAdminOrSelfStudent, is_school_admin
from apps.academics.models import SchoolClass, Section, Session
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

        # Admin/Owner -> only their school's students (school-wise isolation).
        if is_school_admin(user):
            if user.school_id and not user.is_superuser:
                queryset = queryset.filter(user__school_id=user.school_id)

        # TEACHER -> can view only students in assigned classes/sections
        elif user.role == "TEACHER":
            if self.action == "list":
                teacher = getattr(user, "teacher_profile", None)
                if teacher:
                    queryset = queryset.filter(
                        Q(school_class__in=teacher.classes.all())
                        | Q(section__in=teacher.sections.all())
                    ).distinct()
                else:
                    queryset = Student.objects.none()

        # STUDENT -> only own student for list; retrieve/update/destroy
        # deliberately stay unfiltered here so a foreign-ID lookup is
        # turned into a 403 by the object-level permission, not a 404.
        elif user.role == "STUDENT":
            if self.action == "list":
                queryset = queryset.filter(user=user)

        else:
            queryset = Student.objects.none()

        school_class_id = self.request.query_params.get("school_class")
        if school_class_id:
            queryset = queryset.filter(school_class_id=school_class_id)

        section_id = self.request.query_params.get("section")
        if section_id:
            queryset = queryset.filter(section_id=section_id)

        session_id = self.request.query_params.get("session")
        if session_id:
            queryset = queryset.filter(session_id=session_id)

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

        # SUPERUSER cross-school filter lets platform staff pick a school.
        school_id_param = self.request.query_params.get("school")
        if school_id_param and (user.is_superuser):
            queryset = queryset.filter(user__school_id=school_id_param)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def get_permissions(self):
        if self.action == "transfer":
            return [IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """
        POST /api/students/<id>/transfer/
        Body: {"school_class": <id>, "section": <id>, "roll_number": <optional>}

        Authorized admins can move a student to another class/section.
        Historical attendance and financial records are keyed to the
        Student row, so they are preserved automatically. Roll-number
        uniqueness is re-validated in the destination class/section.
        """
        student = self.get_object()
        school = request.user.school

        if school is None and not request.user.is_superuser:
            return Response(
                {"detail": "Admin account is not linked to a school."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        class_id = request.data.get("school_class")
        section_id = request.data.get("section")
        roll_number = (request.data.get("roll_number") or "").strip()

        if not class_id:
            return Response(
                {"school_class": ["Target class is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_class = SchoolClass.objects.select_related("session").get(id=class_id)
        except (SchoolClass.DoesNotExist, ValueError, TypeError):
            return Response(
                {"school_class": ["Target class not found."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # School-wise isolation: the destination class must belong to the
        # admin's school.
        if school is not None and (
            not target_class.session or target_class.session.school_id != school.id
        ):
            return Response(
                {"school_class": ["Target class must belong to your school."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_section = None
        if section_id:
            try:
                target_section = Section.objects.get(id=section_id)
            except (Section.DoesNotExist, ValueError, TypeError):
                return Response(
                    {"section": ["Target section not found."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if target_section.class_room_id != target_class.id:
                return Response(
                    {"section": ["The selected section does not belong to the selected class."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not roll_number:
            roll_number = student.roll_number

        if roll_number:
            qs = Student.objects.filter(
                school_class=target_class,
                section=target_section,
                roll_number__iexact=roll_number,
            ).exclude(pk=student.pk)
            if qs.exists():
                return Response(
                    {"roll_number": ["A student with this roll number already exists in the target class/section."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        student.school_class = target_class
        student.section = target_section
        if roll_number:
            student.roll_number = roll_number
        # Keep the session aligned with the new class.
        if target_class.session:
            student.session = target_class.session
        student.save()

        serializer = StudentSerializer(student, context={"request": request})
        return Response(serializer.data)


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

        if is_school_admin(user):
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