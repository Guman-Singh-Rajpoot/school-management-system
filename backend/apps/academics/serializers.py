from rest_framework import serializers

from .models import Session, SchoolClass, Section, Subject


class SessionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Session
        fields = "__all__"


class SchoolClassSerializer(serializers.ModelSerializer):
    session_name = serializers.CharField(source='session.name', read_only=True)

    class Meta:
        model = SchoolClass
        fields = "__all__"


class SectionSerializer(serializers.ModelSerializer):
    class_room_name = serializers.CharField(source='class_room.name', read_only=True)

    class Meta:
        model = Section
        fields = "__all__"


class SubjectSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source='school_class.name', read_only=True)

    class Meta:
        model = Subject
        fields = "__all__"