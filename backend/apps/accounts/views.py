
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login

from django.db import transaction

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q

import logging

from .models import User, AuditLog, PasswordResetToken, School
from .permissions import IsAdmin, IsSchoolAdmin, is_school_admin
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    RegisterSerializer,
    PasswordResetRequestSerializer,
    PasswordResetValidateSerializer,
    PasswordResetConfirmSerializer,
)

logger = logging.getLogger(__name__)


# ============================================================
# LOGIN
# ============================================================

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint.

    POST:
    {
        "username": "...",
        "password": "..."
    }

    Returns:
    {
        "access": "...",
        "refresh": "...",
        "user": {...}
    }
    """

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = getattr(serializer, 'user', None)

        if user:
            try:
                AuditLog.objects.create(
                    user=user,
                    action="LOGIN",
                    details={"role": getattr(user, 'role', '')}
                )
            except Exception:
                logger.exception("Failed to create login audit log")

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK
        )


# ============================================================
# REGISTER
# ============================================================

class RegisterView(generics.CreateAPIView):
    """
    User registration is restricted to administrators only.
    Teachers and students cannot register themselves.
    """

    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

# Never allow creating a second ADMIN via this endpoint.
        # ADMIN accounts are only created via management command or Django admin.
        # OWNER accounts are also not creatable through this endpoint.
        if is_school_admin(user):
            user.delete()
            return Response(
                {"detail": "Admin accounts cannot be created through this endpoint."},
                status=status.HTTP_403_FORBIDDEN
            )

        AuditLog.objects.create(
            user=request.user,
            action="CREATE_USER",
            details={
                "created_user": user.username,
                "role": user.role
            }
        )

        return Response(
            {
                "detail": "User account created successfully.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED
        )


# ============================================================
# SCHOOL OWNER REGISTRATION
# ============================================================

class OwnerRegisterView(APIView):
    """
    Public endpoint for school owners to register their school
    and owner account.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from .serializers import (
            SchoolOwnerRegisterSerializer,
            SchoolSerializer,
            UserSerializer
        )

        serializer = SchoolOwnerRegisterSerializer(data=request.data)

        # Validate incoming registration data.
        # DRF returns detailed field validation errors automatically.
        serializer.is_valid(raise_exception=True)

        try:
            # Create school and owner atomically.
            # If either creation fails, the transaction is rolled back.
            with transaction.atomic():
                result = serializer.save()

        except Exception:
            # Log the complete exception and traceback in backend logs.
            # Do not expose internal database errors to the frontend.
            logger.exception("School owner registration failed")

            return Response(
                {
                    "detail": "Registration failed. Please try again."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        owner = result['owner']
        school = result['school']

        refresh = RefreshToken.for_user(owner)

        return Response(
            {
                "detail": "School and owner created successfully.",
                "school": SchoolSerializer(school).data,
                "owner": UserSerializer(owner).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED
        )


# ============================================================
# LOGOUT
# ============================================================

class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {
                    "detail": "Refresh token is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)

            token.blacklist()

            AuditLog.objects.create(
                user=request.user,
                action="LOGOUT"
            )

            return Response(
                {
                    "detail": "Logout successful."
                },
                status=status.HTTP_205_RESET_CONTENT
            )

        except Exception:
            logger.exception("Logout failed")

            return Response(
                {
                    "detail": "Invalid or expired refresh token."
                },
                status=status.HTTP_400_BAD_REQUEST
            )


# ============================================================
# CURRENT USER
# ============================================================

class MeView(generics.RetrieveUpdateAPIView):

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ============================================================
# CHANGE PASSWORD
# ============================================================

class ChangePasswordView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        serializer = ChangePasswordSerializer(
            data=request.data,
            context={
                "request": request
            }
        )

        serializer.is_valid(
            raise_exception=True
        )

        request.user.set_password(
            serializer.validated_data["new_password"]
        )

        # Clear the forced password change flag.
        request.user.must_change_password = False
        request.user.save()

        AuditLog.objects.create(
            user=request.user,
            action="CHANGE_PASSWORD"
        )

        return Response(
            {
                "detail": "Password updated successfully."
            },
            status=status.HTTP_200_OK
        )


# ============================================================
# ADMIN - USER LIST + CREATE
# ============================================================

class UserListCreateView(generics.ListCreateAPIView):

    queryset = User.objects.all().order_by(
        "-created_at"
    )

    serializer_class = UserSerializer

    filterset_fields = [
        "role",
        "is_active"
    ]

    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name"
    ]

    def get_permissions(self):

        return [
            IsAuthenticated(),
            IsSchoolAdmin(),
        ]


# ============================================================
# ADMIN - USER DETAIL
# ============================================================

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    def get_permissions(self):

        return [
            IsAuthenticated(),
            IsSchoolAdmin(),
        ]


# ============================================================
# PASSWORD RESET - REQUEST
# ============================================================

class PasswordResetRequestView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data["identifier"]

        matched_user = User.objects.filter(
            Q(username__iexact=identifier)
            | Q(email__iexact=identifier)
            | Q(phone=identifier)
        ).first()

        # Generic safe response to prevent username/email enumeration.
        generic_detail = (
            "If an account with that email, username, or phone exists, "
            "password reset instructions have been dispatched."
        )

        if not matched_user or not matched_user.is_active:
            return Response(
                {"detail": generic_detail},
                status=status.HTTP_200_OK
            )

        client_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR")
            or request.META.get("REMOTE_ADDR")
        )

        if client_ip and "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        raw_token = PasswordResetToken.create_token(
            user=matched_user,
            ip_address=client_ip,
            lifetime_hours=1,
        )

        frontend_url = getattr(
            settings,
            "FRONTEND_URL",
            "http://localhost:3000"
        ).rstrip("/")

        reset_url = f"{frontend_url}/reset-password?token={raw_token}"

        subject = "School Management System - Password Reset Request"

        message = (
            f"Hello {matched_user.get_full_name() or matched_user.username},\n\n"
            f"A password reset was requested for your account ({matched_user.username}).\n"
            f"Please use the link below to set a new password:\n\n"
            f"{reset_url}\n\n"
            f"This link will expire in 1 hour. If you did not request this, please ignore this email.\n"
        )

        try:
            recipient_email = matched_user.email

            if recipient_email:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False,
                )

        except Exception:
            logger.exception("Password reset email delivery failed")

        AuditLog.objects.create(
            user=matched_user,
            action="PASSWORD_RESET_REQUESTED",
            ip_address=client_ip,
        )

        return Response(
            {"detail": generic_detail},
            status=status.HTTP_200_OK
        )


# ============================================================
# PASSWORD RESET - VALIDATE TOKEN
# ============================================================

class PasswordResetValidateView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        serializer = PasswordResetValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]

        token_record, error = PasswordResetToken.verify_token(token)

        if error:
            return Response(
                {
                    "valid": False,
                    "detail": error
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "valid": True,
                "username": token_record.user.username,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# PASSWORD RESET - CONFIRM
# ============================================================

class PasswordResetConfirmView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["password"]

        token_record, error = PasswordResetToken.verify_token(token)

        if error:
            return Response(
                {"detail": error},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = token_record.user

        user.set_password(new_password)
        user.save()

        token_record.mark_used()

        client_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR")
            or request.META.get("REMOTE_ADDR")
        )

        AuditLog.objects.create(
            user=user,
            action="PASSWORD_RESET_COMPLETED",
            ip_address=client_ip,
        )

        return Response(
            {
                "detail": "Password has been reset successfully. You can now log in.",
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# ADMIN - RESET USER PASSWORD
# ============================================================

class AdminResetUserPasswordView(APIView):
    """
    Admin-only endpoint to reset the password for any user account.
    Supports setting must_change_password so the user is forced to change it.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def post(self, request, pk):

        try:
            target_user = User.objects.get(pk=pk)

        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_password = (request.data.get("new_password") or "").strip()
        must_change = request.data.get("must_change_password", True)

        if not new_password:
            import secrets
            import string

            alphabet = string.ascii_letters + string.digits + "@#$%"

            new_password = "".join(
                secrets.choice(alphabet) for _ in range(10)
            )

        elif len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.set_password(new_password)
        target_user.must_change_password = bool(must_change)
        target_user.save()

        # Send WhatsApp alert if user has WhatsApp number and feature enabled.
        try:
            from apps.announcements.whatsapp import send_whatsapp

            number = (
                getattr(target_user, 'whatsapp_number', '').strip()
                or getattr(target_user, 'phone', '').strip()
            )

            if number:
                msg = (
                    f"Hello {target_user.get_full_name() or target_user.username},\n\n"
                    f"Your password has been reset by the school administrator.\n"
                    f"New Temporary Password: {new_password}\n\n"
                    f"Please log in and update your password immediately.\n"
                    "— School Management"
                )

                send_whatsapp(
                    to=number,
                    message=msg,
                    category='ACCOUNT_CREATED',
                    user=target_user
                )

        except Exception:
            logger.exception("Admin password reset WhatsApp notification failed")

        client_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR")
            or request.META.get("REMOTE_ADDR")
        )

        AuditLog.objects.create(
            user=request.user,
            action="ADMIN_PASSWORD_RESET",
            model_name="User",
            object_id=str(target_user.pk),
            details={"target_username": target_user.username},
            ip_address=client_ip,
        )

        return Response(
            {
                "detail": f"Password for {target_user.username} has been reset successfully.",
                "temporary_password": new_password,
                "must_change_password": target_user.must_change_password,
            },
            status=status.HTTP_200_OK,
        )
