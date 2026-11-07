from rest_framework import serializers
from .models import Announcement, Message, Notification, WhatsAppConfig, WhatsAppNotification


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    whatsapp_notification_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Announcement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'whatsapp_sent', 'whatsapp_sent_at']

    def get_whatsapp_notification_count(self, obj):
        return obj.whatsapp_notifications.count()

    def validate(self, attrs):
        audience = attrs.get('audience', getattr(self.instance, 'audience', None))
        class_room = attrs.get('class_room', getattr(self.instance, 'class_room', None))
        section = attrs.get('section', getattr(self.instance, 'section', None))

        if audience == Announcement.Audience.CLASS and not class_room:
            raise serializers.ValidationError({'class_room': 'A class must be selected for CLASS audience.'})
        if audience == Announcement.Audience.SECTION and not section:
            raise serializers.ValidationError({'section': 'A section must be selected for SECTION audience.'})
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)

    class Meta:
        model = Message
        fields = '__all__'
        read_only_fields = ['sender', 'sent_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['recipient', 'announcement', 'title', 'message', 'created_at', 'delivery_status']


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppConfig
        fields = '__all__'
        # Never return the access_token in list responses — admin must
        # explicitly open the detail view to see/update it.
        extra_kwargs = {
            'access_token': {'write_only': True},
        }


class WhatsAppNotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)

    class Meta:
        model = WhatsAppNotification
        fields = '__all__'
        read_only_fields = ['created_at', 'sent_at', 'status', 'provider_message_id', 'error_message']
