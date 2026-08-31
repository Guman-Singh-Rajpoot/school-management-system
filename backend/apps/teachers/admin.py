from django.contrib import admin
from .models import Teacher, TeacherDocument, TeacherSalary, SalaryPayment, TeacherAttendance

admin.site.register(Teacher)
admin.site.register(TeacherDocument)
admin.site.register(TeacherSalary)
admin.site.register(SalaryPayment)
admin.site.register(TeacherAttendance)
