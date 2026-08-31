from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role/name claims to the JWT payload so the frontend can route by role."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'full_name': self.user.get_full_name(),
        }
        return data


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
