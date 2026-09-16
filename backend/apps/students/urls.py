from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, StudentDocumentViewSet

router = DefaultRouter()
router.register('documents', StudentDocumentViewSet)
router.register('', StudentViewSet)

urlpatterns = router.urls
