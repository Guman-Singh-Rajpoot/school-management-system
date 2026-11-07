from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.db.models import Q
from rest_framework import serializers, exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, School


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
                'whatsapp_number': getattr(self.user, 'whatsapp_number', ''),
                'school_name': getattr(self.user, 'school_name', ''),
                'must_change_password': getattr(self.user, 'must_change_password', False),
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
            'whatsapp_number',
            'school_name',
            'profile_photo',
            'is_active',
            'must_change_password',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        # Never expose password hash in any response
        extra_kwargs = {
            'password': {'write_only': True},
        }
class RegisterSerializer(serializers.ModelSerializer):
    """
    Admin-only serializer for creating Teacher/Student user accounts.
    Optionally marks the account as requiring a password change on first login
    (use is_temporary_password=True when generating a temp password).
    """
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    password_confirm = serializers.CharField(
        write_only=True
    )

    # When True the created user must change their password on first login.
    is_temporary_password = serializers.BooleanField(
        write_only=True,
        default=False,
        required=False,
    )

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'whatsapp_number',
            'school_name',
            'role',
            'password',
            'password_confirm',
            'is_temporary_password',
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

        email = attrs.get('email', '')
        if email and User.objects.filter(email__iexact=email).exists():
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
        is_temporary = validated_data.pop('is_temporary_password', False)
        password = validated_data.pop('password')

        user = User.objects.create_user(
            password=password,
            must_change_password=is_temporary,
            **validated_data
        )

        return user
class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'registration_number', 'affiliation_number', 'address', 'city', 'state', 'pin_code', 'email', 'contact_number']

class SchoolOwnerRegisterSerializer(serializers.Serializer):
    """Serializer for registering a new school and its owner."""
    # School fields
    school_name = serializers.CharField(max_length=255)
    registration_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    affiliation_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pin_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    school_email = serializers.EmailField(required=False, allow_blank=True)
    school_contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # Owner fields
    owner_full_name = serializers.CharField(max_length=255)
    owner_username = serializers.CharField(max_length=150)
    owner_email = serializers.EmailField()
    owner_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        if User.objects.filter(username__iexact=attrs['owner_username']).exists():
            raise serializers.ValidationError({'owner_username': 'Username already taken.'})
        if User.objects.filter(email__iexact=attrs['owner_email']).exists():
            raise serializers.ValidationError({'owner_email': 'Email already registered.'})
        if attrs.get('owner_phone') and User.objects.filter(phone=attrs['owner_phone']).exists():
            raise serializers.ValidationError({'owner_phone': 'Phone number already registered.'})
        # Ensure school registration number uniqueness if provided
        reg_num = attrs.get('registration_number')
        if reg_num:
            from .models import School
            if School.objects.filter(registration_number=reg_num).exists():
                raise serializers.ValidationError({'registration_number': 'Registration number already used.'})
        return attrs

    def create(self, validated_data):
        from .models import School, User
        school_data = {
            'name': validated_data['school_name'],
            'registration_number': validated_data.get('registration_number') or None,
            'affiliation_number': validated_data.get('affiliation_number') or None,
            'address': validated_data.get('address') or '',
            'city': validated_data.get('city') or '',
            'state': validated_data.get('state') or '',
            'pin_code': validated_data.get('pin_code') or '',
            'email': validated_data.get('school_email') or '',
            'contact_number': validated_data.get('school_contact_number') or '',
        }
        school = School.objects.create(**school_data)

        owner = User.objects.create_user(
            username=validated_data['owner_username'],
            email=validated_data['owner_email'],
            first_name=validated_data['owner_full_name'].split(' ')[0],
            last_name=' '.join(validated_data['owner_full_name'].split(' ')[1:]),
            phone=validated_data.get('owner_phone') or '',
            password=validated_data['password'],
            role=User.Role.OWNER,
            school=school,
            must_change_password=False,
        )
        # Link owner to school
        school.owner = owner
        school.save()
        return {'school': school, 'owner': owner}



class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)

    def validate_identifier(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Please enter your username, email, or phone number.")
        return val


class PasswordResetValidateSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs

