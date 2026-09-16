from django.contrib import admin
from .models import Announcement, Message, Notification

admin.site.register(Announcement)
admin.site.register(Message)
admin.site.register(Notification)
