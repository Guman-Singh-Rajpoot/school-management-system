from rest_framework import serializers
from .models import Homework, HomeworkSubmission


class HomeworkSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)

    class Meta:
        model = HomeworkSubmission
        fields = '__all__'


class HomeworkSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    section_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='section.class_room.name', read_only=True)
    submissions = HomeworkSubmissionSerializer(many=True, read_only=True)

    def get_section_name(self, obj):
        return str(obj.section)

    class Meta:
        model = Homework
        fields = '__all__'
