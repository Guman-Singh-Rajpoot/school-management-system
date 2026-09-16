from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, AuditLog
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    RegisterSerializer,
)


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

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK
        )


# ============================================================
# REGISTER
# ============================================================

class RegisterView(generics.CreateAPIView):

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            {
                "detail": "Registration successful.",
                "user": UserSerializer(user).data,
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

            token = RefreshToken(
                refresh_token
            )

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

        except Exception as e:

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

class UserListCreateView(
    generics.ListCreateAPIView
):

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

        from .permissions import IsAdmin

        return [
            IsAdmin()
        ]


# ============================================================
# ADMIN - USER DETAIL
# ============================================================

class UserDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    def get_permissions(self):

        from .permissions import IsAdmin

        return [
            IsAdmin()
        ]