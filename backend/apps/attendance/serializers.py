from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)

    class Meta:
        model = Attendance
        fields = '__all__'


class BulkAttendanceItemSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    status = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True)

    def validate_status(self, value):
        if value in (None, '', 'NOT_MARKED'):
            return 'NOT_MARKED'
        valid_statuses = [choice[0] for choice in Attendance.Status.choices]
        if value not in valid_statuses:
            raise serializers.ValidationError(
                f"Invalid status '{value}'. Allowed choices: {valid_statuses} or 'NOT_MARKED'."
            )
        return value


class BulkAttendanceSerializer(serializers.Serializer):
    """For marking a whole class's attendance for a date in one request."""
    date = serializers.DateField()
    school_class = serializers.IntegerField(required=False, allow_null=True)
    section = serializers.IntegerField(required=False, allow_null=True)
    records = BulkAttendanceItemSerializer(many=True)

