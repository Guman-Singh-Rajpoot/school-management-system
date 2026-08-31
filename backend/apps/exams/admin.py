from django.contrib import admin
from .models import Exam, ExamSubject, Grade, Mark

admin.site.register(Exam)
admin.site.register(ExamSubject)
admin.site.register(Grade)
admin.site.register(Mark)
