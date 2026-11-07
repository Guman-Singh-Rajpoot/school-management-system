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

    def validate(self, attrs):
        school_class = attrs.get('school_class') or (self.instance.school_class if self.instance else None)
        section = attrs.get('section') or (self.instance.section if self.instance else None)
        roll_number = (attrs.get('roll_number') or (self.instance.roll_number if self.instance else '')).strip()

        # A section always belongs to exactly one class.
        if school_class and section and section.class_room_id != school_class.id:
            raise serializers.ValidationError({
                "section": "The selected section does not belong to the selected class."
            })

        if school_class and section and roll_number:
            qs = Student.objects.filter(school_class=school_class, section=section, roll_number__iexact=roll_number)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    "roll_number": "A student with this roll number already exists in this class and section."
                })
        return attrs

    def update(self, instance, validated_data):
        is_active = self.initial_data.get('is_active')
        if is_active is not None and instance.user:
            instance.user.is_active = bool(is_active)
            instance.user.save(update_fields=['is_active'])
        return super().update(instance, validated_data)



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

    must_change_password = serializers.BooleanField(
        write_only=True,
        required=False,
        default=True,
    )

    whatsapp_number = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
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
        default=None,
    )

    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )

    roll_number = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
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

    def _callers_school(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return None
        if user.is_superuser:
            return user.school_id
        return user.school_id

    def validate(self, attrs):
        school_class = attrs.get('school_class')
        section = attrs.get('section')
        roll_number = (attrs.get('roll_number') or '').strip()

        school_id = self._callers_school()

        # Classes/sections posted in the create payload must belong to
        # the authenticated admin's school.
        if school_class is not None:
            chain = school_class.session
            if school_id is not None and (
                chain is None or chain.school_id is None or chain.school_id != school_id
            ):
                raise serializers.ValidationError({
                    "school_class": "Class must belong to your school."
                })

        if section is not None:
            if school_id is not None:
                chain = (
                    section.class_room.session if section.class_room_id else None
                )
                if chain is None or chain.school_id != school_id:
                    raise serializers.ValidationError({
                        "section": "Section must belong to your school."
                    })

            if school_class is not None and section.class_room_id != school_class.id:
                raise serializers.ValidationError({
                    "section": "The selected section does not belong to the selected class."
                })

        # Where the school defines classes, a class (and matching section)
        # is REQUIRED so that the student lands in the correct class list.
        if school_id is not None:
            from apps.academics.models import SchoolClass as _SchoolClass
            school_has_classes = _SchoolClass.objects.filter(
                session__school_id=school_id,
            ).exists()
            if school_has_classes and school_class is None:
                raise serializers.ValidationError({
                    "school_class": "This school has classes configured; assign the student to a class."
                })

        # A section picked with no class is ambiguous -- reject unless the
        # section implicitly determines the class.
        if section is not None and school_class is None:
            attrs['school_class'] = section.class_room

        if school_class and section and roll_number:
            school_class_id = school_class.pk if hasattr(school_class, 'pk') else school_class
            section_id = section.pk if hasattr(section, 'pk') else section
            if Student.objects.filter(
                school_class_id=school_class_id,
                section_id=section_id,
                roll_number__iexact=roll_number,
            ).exists():
                raise serializers.ValidationError({
                    "roll_number": "A student with this roll number already exists in this class and section."
                })
        return attrs

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
        must_change_password = validated_data.pop("must_change_password", True)
        whatsapp_number = validated_data.pop("whatsapp_number", "").strip()

        # Admin's school: the new student account joins the same school.
        request = self.context.get('request')
        creator = getattr(request, 'user', None)
        school = getattr(creator, 'school', None) if creator else None

        # Session defaults to the school's current session.
        if not validated_data.get('session'):
            from apps.academics.models import Session as _Session
            current = None
            if school:
                current = _Session.objects.filter(school=school, is_current=True).first() \
                    or _Session.objects.filter(school=school).order_by('-start_date').first()
            if current:
                validated_data['session'] = current

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            phone=validated_data.get("mobile_number", "").strip(),
            whatsapp_number=(whatsapp_number or validated_data.get("mobile_number", "").strip()),
            role=User.Role.STUDENT,
            school=school,
            must_change_password=must_change_password,
        )

        student = Student.objects.create(
            user=user,
            **validated_data
        )

        try:
            from apps.announcements.whatsapp import send_account_created_notification
            send_account_created_notification(user, password)
        except Exception:
            pass

        return student

    def to_representation(self, instance):
        return StudentSerializer(instance, context=self.context).data