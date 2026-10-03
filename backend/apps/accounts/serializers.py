from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.db.models import Q
from rest_framework import serializers, exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Enhanced login serializer that allows authenticating with:
    - Username (case-insensitive)
    - Email address (case-insensitive)
    - Phone number
    - Student admission number
    - Teacher employee ID
    Provides clean error messages and returns complete user details with role.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        role = user.role
        if user.is_superuser or user.is_staff:
            role = User.Role.ADMIN
        elif not role:
            role = User.Role.STUDENT

        token['role'] = role
        token['username'] = user.username
        token['full_name'] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        identifier = (
            attrs.get(self.username_field)
            or attrs.get('email')
            or attrs.get('phone')
            or attrs.get('identifier')
            or ''
        ).strip()
        password = attrs.get('password', '')

        if not identifier:
            raise serializers.ValidationError({
                'detail': 'Please enter your username, email, or phone number.'
            })
        if not password:
            raise serializers.ValidationError({
                'detail': 'Please enter your password.'
            })

        # Authenticate via custom backend (checks username, email, phone, admission_number, employee_id)
        user = authenticate(
            request=self.context.get('request'),
            username=identifier,
            password=password,
        )

        if not user:
            # Provide specific feedback
            matched_user = (
                User.objects.filter(
                    Q(username__iexact=identifier)
                    | Q(email__iexact=identifier)
                    | Q(phone=identifier)
                    | Q(student_profile__admission_number__iexact=identifier)
                    | Q(teacher_profile__employee_id__iexact=identifier)
                ).exclude(email='', phone='').first()
            )
            if matched_user:
                if not matched_user.is_active:
                    raise exceptions.AuthenticationFailed(
                        'This account is inactive. Please contact the administrator.',
                        code='inactive_account',
                    )
                else:
                    raise exceptions.AuthenticationFailed(
                        'Incorrect password. Please try again.',
                        code='invalid_password',
                    )
            else:
                raise exceptions.AuthenticationFailed(
                    'No active account found with the given username, email, or phone number.',
                    code='no_active_account',
                )

        self.user = user

        # Normalize role
        role = self.user.role
        if self.user.is_superuser or self.user.is_staff:
            role = User.Role.ADMIN
        elif not role:
            role = User.Role.STUDENT

        refresh = self.get_token(self.user)

        update_last_login(None, self.user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': self.user.id,
                'username': self.user.username,
                'email': self.user.email,
                'role': role,
                'full_name': self.user.get_full_name() or self.user.username,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'phone': getattr(self.user, 'phone', ''),
                'school_name': getattr(self.user, 'school_name', ''),
            },
        }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
    'id',
    'username',
    'email',
    'first_name',
    'last_name',
    'role',
    'phone',
    'school_name',
    'profile_photo',
    'is_active',
    'created_at',
]
        read_only_fields = ['id', 'created_at']
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    password_confirm = serializers.CharField(
        write_only=True
    )

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'school_name',
            'role',
            'password',
            'password_confirm',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })

        role = attrs.get('role')

        if role not in [
            User.Role.ADMIN,
            User.Role.TEACHER,
            User.Role.STUDENT,
        ]:
            raise serializers.ValidationError({
                'role': 'Invalid role.'
            })

        if User.objects.filter(
            email=attrs['email']
        ).exists():
            raise serializers.ValidationError({
                'email': 'This email is already registered.'
            })

        if attrs.get('phone') and User.objects.filter(
            phone=attrs['phone']
        ).exists():
            raise serializers.ValidationError({
                'phone': 'This phone number is already registered.'
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')

        password = validated_data.pop('password')

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        return user        


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value
