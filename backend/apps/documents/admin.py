from django.contrib import admin
from .models import GeneratedDocument, BackupRecord

admin.site.register(GeneratedDocument)
admin.site.register(BackupRecord)
