from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)

    class Meta:
        model = Attendance
        fields = '__all__'


class BulkAttendanceItemSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    status = serializers.ChoiceField(choices=Attendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True)


class BulkAttendanceSerializer(serializers.Serializer):
    """For marking a whole class's attendance for a date in one request."""
    date = serializers.DateField()
    records = BulkAttendanceItemSerializer(many=True)
