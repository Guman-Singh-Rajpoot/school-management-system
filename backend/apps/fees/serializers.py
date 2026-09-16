from rest_framework import serializers
from .models import FeeStructure, StudentFee, Payment


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = '__all__'


class FeePaymentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Payment
        fields = [
            'id',
            'receipt_number',
            'student_fee',
            'amount',
            'method',
            'remarks',
            'paid_on',
            'created_at',
            'created_by',
        ]

        # receipt_number/paid_on/created_at/created_by are always generated
        # by the backend -- never accepted from or editable by the client.
        read_only_fields = [
            'id',
            'receipt_number',
            'paid_on',
            'created_at',
            'created_by',
        ]

    def validate_amount(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                'Payment amount must be greater than zero.'
            )

        student_fee_id = self.initial_data.get('student_fee')
        if student_fee_id:
            try:
                fee_obj = StudentFee.objects.get(pk=student_fee_id)
            except StudentFee.DoesNotExist:
                return value

            remaining = fee_obj.remaining_amount

            if value > remaining:
                raise serializers.ValidationError(
                    'Payment cannot exceed remaining fee.'
                )

        return value


class StudentFeeSerializer(serializers.ModelSerializer):
    payments = FeePaymentSerializer(many=True, read_only=True)
    net_payable = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    fee_type = serializers.CharField(source='fee_structure.fee_type', read_only=True)
    due_date = serializers.DateField(source='fee_structure.due_date', read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)

    class Meta:
        model = StudentFee
        fields = '__all__'

    def get_paid_amount(self, obj):
        return obj.paid_amount

    def get_pending_amount(self, obj):
        return obj.pending_amount
