from rest_framework import serializers

from .models import FeeStructure, StudentFee, StudentFeeAdjustment, Payment  # noqa


class FeeStructureSerializer(serializers.ModelSerializer):
    school_class_name = serializers.CharField(source='school_class.name', read_only=True)
    session_name = serializers.CharField(source='session.name', read_only=True)
    monthly_total_in_class = serializers.SerializerMethodField()

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'school_class',
            'school_class_name',
            'session',
            'session_name',
            'fee_type',
            'amount',
            'due_date',
            'due_day',
            'late_fee_amount',
            'active',
            'monthly_total_in_class',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_monthly_total_in_class(self, obj):
        """
        Preview helper: the sum of ACTIVE category amounts for the class
        and session AFTER this row's pending changes. Used by the admin
        to confirm the total monthly fee before saving.
        """
        total = 0
        for row in obj.__class__.objects.filter(
            school_class=obj.school_class,
            session=obj.session,
            active=True,
        ).exclude(pk=obj.pk):
            total += row.amount
        total += obj.amount if getattr(obj, 'active', True) else 0
        return str(total)

    def validate_session(self, session):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if session and user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            if session.school_id and user.school_id and session.school_id != user.school_id:
                raise serializers.ValidationError(
                    "Fee structure must belong to your own school's academic session."
                )
        return session

    def validate(self, attrs):
        """
        Cross-field validation:
        - the chosen class must belong to the chosen session's school;
        - the category must not already exist for the class+session.
        """
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        session = attrs.get('session') or (self.instance.session if self.instance else None)
        school_class = attrs.get('school_class') or (self.instance.school_class if self.instance else None)

        if school_class and session and school_class.session_id and school_class.session_id != session.id:
            raise serializers.ValidationError({
                'school_class': "The selected class does not belong to the selected academic session."
            })

        if school_class and user and user.is_authenticated and not (user.is_superuser or user.is_staff):
            chain_session = school_class.session
            if chain_session and chain_session.school_id and user.school_id and chain_session.school_id != user.school_id:
                raise serializers.ValidationError(
                    "Fee structure must belong to a class in your own school."
                )

        fee_type = attrs.get('fee_type') or (self.instance.fee_type if self.instance else None)
        if school_class and session and fee_type:
            qs = FeeStructure.objects.filter(
                school_class=school_class,
                session=session,
                fee_type__iexact=fee_type.strip(),
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'fee_type': "This fee category already exists for the class and session."
                })
        return attrs


class FeePaymentSerializer(serializers.ModelSerializer):

    student_name = serializers.CharField(source='student_fee.student.user.get_full_name', read_only=True)

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
            'student_name',
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
    due_date = serializers.DateField(read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_admission_number = serializers.CharField(source='student.admission_number', read_only=True)
    school_class_name = serializers.CharField(source='fee_structure.school_class.name', read_only=True)
    session_name = serializers.CharField(source='fee_structure.session.name', read_only=True)
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = StudentFee
        fields = [
            'id',
            'student',
            'student_name',
            'student_admission_number',
            'fee_structure',
            'fee_type',
            'school_class_name',
            'session_name',
            'gross_amount',
            'discount_amount',
            'scholarship_amount',
            'net_payable',
            'paid_amount',
            'pending_amount',
            'month',
            'year',
            'due_date',
            'payment_status',
            'payments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'student',
            'student_name',
            'student_admission_number',
            'fee_structure',
            'fee_type',
            'school_class_name',
            'session_name',
            'gross_amount',
            'net_payable',
            'paid_amount',
            'pending_amount',
            'due_date',
            'payments',
            'created_at',
            'updated_at',
        ]

    def get_paid_amount(self, obj):
        return obj.paid_amount

    def get_pending_amount(self, obj):
        return obj.pending_amount

    def get_payment_status(self, obj):
        return obj.payment_status

    def validate_discount_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Discount cannot be negative.")
        return value

    def validate_scholarship_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Scholarship cannot be negative.")
        return value

    def validate(self, attrs):
        instance = self.instance
        if not instance:
            raise serializers.ValidationError(
                "Individual fee rows are created via monthly generation, not posted directly. "
                "Use POST /api/fees/fee-structures/generate-schedule/."
            )
        discount = attrs.get('discount_amount', instance.discount_amount)
        scholarship = attrs.get('scholarship_amount', instance.scholarship_amount)
        if discount + scholarship > instance.gross_amount:
            raise serializers.ValidationError({
                'discount_amount': "Discount plus scholarship cannot exceed the bill amount."
            })
        return attrs


class StudentFeeAdjustmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)

    class Meta:
        model = StudentFeeAdjustment
        fields = [
            'id',
            'student',
            'student_name',
            'fee_type',
            'discount_amount',
            'scholarship_amount',
            'concession_reason',
            'active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        discount = attrs.get('discount_amount', 0)
        scholarship = attrs.get('scholarship_amount', 0)
        if discount < 0 or scholarship < 0:
            raise serializers.ValidationError(
                "Discount/scholarship amounts cannot be negative."
            )
        if discount + scholarship <= 0:
            raise serializers.ValidationError(
                "Set a discount and/or scholarship amount for the adjustment."
            )

        student = attrs.get('student') or (self.instance.student if self.instance else None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if student and user and user.is_authenticated and not user.is_superuser:
            student_school = student.user.school_id
            if user.school_id and student_school and student_school != user.school_id:
                raise serializers.ValidationError(
                    "You can only create adjustments for students of your own school."
                )
        return attrs
