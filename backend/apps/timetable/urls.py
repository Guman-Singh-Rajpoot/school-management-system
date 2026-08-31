from rest_framework.routers import DefaultRouter
from .views import TimetableSlotViewSet

router = DefaultRouter()
router.register('', TimetableSlotViewSet)

urlpatterns = router.urls
