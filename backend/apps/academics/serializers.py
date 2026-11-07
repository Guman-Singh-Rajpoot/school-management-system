from rest_framework import serializers

from apps.accounts.models import School

from .models import Session, SchoolClass, Section, Subject


def _user_school(request):
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    # Superusers may legitimately operate school-wide.
    if user.is_superuser:
        return user.school_id
    return user.school_id


class SessionSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    school = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Session
        fields = "__all__"

    def validate_school(self, school):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None:
            return school
        if not (user.is_superuser or user.is_staff):
            if school is not None and school.id != user.school_id:
                raise serializers.ValidationError(
                    "You can only manage academic sessions for your own school."
                )
        return school

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and not validated_data.get('school') and not user.is_superuser:
            validated_data['school'] = user.school
        return super().create(validated_data)


class SchoolClassSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source='session.name', read_only=True)

    class Meta:
        model = SchoolClass
        fields = "__all__"

    def validate(self, attrs):
        session = attrs.get('session') or (self.instance.session if self.instance else None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if session and user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            if session.school and user.school_id and session.school_id != user.school_id:
                raise serializers.ValidationError(
                    "Class must belong to your school's academic session."
                )
        return attrs


class SectionSerializer(serializers.ModelSerializer):
    class_room_name = serializers.CharField(source='class_room.name', read_only=True)

    class Meta:
        model = Section
        fields = "__all__"

    def validate(self, attrs):
        class_room = attrs.get('class_room') or (self.instance.class_room if self.instance else None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if class_room and user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            session = class_room.session
            if session and session.school and user.school_id and session.school_id != user.school_id:
                raise serializers.ValidationError(
                    "Section must belong to a class in your school."
                )
        return attrs


class SubjectSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source='school_class.name', read_only=True)

    class Meta:
        model = Subject
        fields = "__all__"

    def validate(self, attrs):
        school_class = attrs.get('school_class') or (self.instance.school_class if self.instance else None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if school_class and user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            session = school_class.session
            if session and session.school and user.school_id and session.school_id != user.school_id:
                raise serializers.ValidationError(
                    "Subject must belong to a class in your school."
                )
        return attrs
