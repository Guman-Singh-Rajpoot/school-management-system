from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, MessageViewSet, NotificationViewSet

router = DefaultRouter()
router.register('messages', MessageViewSet)
router.register('notifications', NotificationViewSet)
router.register('', AnnouncementViewSet)

urlpatterns = router.urls
