from django.contrib import admin
from .models import FeeStructure, StudentFee, Payment


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = (
        'school_class',
        'session',
        'fee_type',
        'amount',
        'due_date',
    )


@admin.register(StudentFee)
class StudentFeeAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'fee_structure',
        'net_payable',
        'paid_amount',
        'remaining_amount',
        'payment_status',
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'receipt_number',
        'student',
        'amount',
        'method',
        'created_by',
        'created_at',
    )
