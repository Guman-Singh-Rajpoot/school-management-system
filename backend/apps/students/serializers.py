from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User
from apps.academics.models import Session, SchoolClass, Section

from .models import Student, StudentDocument


class StudentDocumentSerializer(serializers.ModelSerializer):

    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name",
        read_only=True
    )

    class Meta:
        model = StudentDocument
        fields = "__all__"
        read_only_fields = [
            "id",
            "uploaded_at",
            "uploaded_by",
        ]


class StudentSerializer(serializers.ModelSerializer):

    user = UserSerializer(read_only=True)

    documents = StudentDocumentSerializer(
        many=True,
        read_only=True
    )

    full_name = serializers.CharField(
        source="user.get_full_name",
        read_only=True
    )

    session_name = serializers.CharField(source='session.name', read_only=True)
    school_class_name = serializers.CharField(source='school_class.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = Student

        fields = "__all__"

        read_only_fields = [
            "id",
            "user",
            "created_at",
            "updated_at",
        ]


class StudentCreateSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        write_only=True
    )

    email = serializers.EmailField(
        write_only=True
    )

    first_name = serializers.CharField(
        write_only=True
    )

    last_name = serializers.CharField(
        write_only=True
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    session = serializers.PrimaryKeyRelatedField(
        queryset=Session.objects.all(),
        required=False,
        allow_null=True,
    )

    school_class = serializers.PrimaryKeyRelatedField(
        queryset=SchoolClass.objects.all(),
        required=False,
        allow_null=True,
    )

    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Student

        exclude = [
            "user",
            "created_at",
            "updated_at",
        ]

    def validate_username(self, value):
        val = value.strip()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return val

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return val

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for key in ('session', 'school_class', 'section'):
            if key in data and (data[key] == '' or data[key] is None):
                data[key] = None
        return super().to_internal_value(data)

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.pop("username").strip()
        email = validated_data.pop("email").strip().lower()
        first_name = validated_data.pop("first_name").strip()
        last_name = validated_data.pop("last_name").strip()
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            role=User.Role.STUDENT,
        )

        return Student.objects.create(
            user=user,
            **validated_data
        )

    def to_representation(self, instance):
        return StudentSerializer(instance, context=self.context).data