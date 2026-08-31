from django.contrib import admin
from .models import Student, StudentDocument


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        'admission_number',
        'student_name',
        'school_class',
        'section',
        'status',
    )

    search_fields = (
        'admission_number',
        'user__first_name',
        'user__last_name',
        'user__email',
    )

    list_filter = (
        'status',
        'gender',
        'school_class',
        'section',
    )

    def student_name(self, obj):
        return obj.user.get_full_name()

    student_name.short_description = 'Student Name'


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'doc_type',
        'verified',
        'uploaded_at',
        'uploaded_by',
    )

    list_filter = (
        'doc_type',
        'verified',
    )

    search_fields = (
        'student__admission_number',
        'student__user__first_name',
        'student__user__last_name',
    )