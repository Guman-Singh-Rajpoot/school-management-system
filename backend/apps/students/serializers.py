from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User

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

    class Meta:
        model = Student

        exclude = [
            "user",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):

        user = User.objects.create_user(
            username=validated_data.pop("username"),
            email=validated_data.pop("email"),
            first_name=validated_data.pop("first_name"),
            last_name=validated_data.pop("last_name"),
            password=validated_data.pop("password"),
            role=User.Role.STUDENT,
        )

        return Student.objects.create(
            user=user,
            **validated_data
        )