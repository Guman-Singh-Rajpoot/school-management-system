from rest_framework.routers import DefaultRouter
from .views import (
    AnnouncementViewSet, MessageViewSet, NotificationViewSet,
    WhatsAppConfigViewSet, WhatsAppNotificationViewSet,
)

router = DefaultRouter()
router.register('messages', MessageViewSet)
router.register('notifications', NotificationViewSet)
router.register('whatsapp-config', WhatsAppConfigViewSet)
router.register('whatsapp-notifications', WhatsAppNotificationViewSet)
router.register('', AnnouncementViewSet)

urlpatterns = router.urls
