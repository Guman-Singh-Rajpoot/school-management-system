from rest_framework import serializers
from django.db.models import Sum
from .models import Exam, ExamSubject, Grade, Mark


class ExamSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = ExamSubject
        fields = '__all__'


class ExamSerializer(serializers.ModelSerializer):
    exam_subjects = ExamSubjectSerializer(many=True, read_only=True)

    class Meta:
        model = Exam
        fields = '__all__'


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = '__all__'


class MarkSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='exam_subject.subject.name', read_only=True)
    max_marks = serializers.IntegerField(source='exam_subject.max_marks', read_only=True)

    class Meta:
        model = Mark
        fields = '__all__'


class ReportCardSerializer(serializers.Serializer):
    """Aggregated report card for one student in one exam."""
    student_id = serializers.IntegerField()
    exam_id = serializers.IntegerField()
    subjects = MarkSerializer(many=True)
    total_marks_obtained = serializers.FloatField()
    total_max_marks = serializers.FloatField()
    percentage = serializers.FloatField()
