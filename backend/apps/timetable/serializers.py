from rest_framework import serializers
from .models import TimetableSlot


class TimetableSlotSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    day_display = serializers.CharField(source='get_day_of_week_display', read_only=True)
    section_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='section.class_room.name', read_only=True)

    def get_section_name(self, obj):
        return str(obj.section)

    class Meta:
        model = TimetableSlot
        fields = '__all__'
