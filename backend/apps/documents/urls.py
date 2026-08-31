from rest_framework.routers import DefaultRouter
from .views import GeneratedDocumentViewSet, BackupViewSet

router = DefaultRouter()
router.register('generated', GeneratedDocumentViewSet)
router.register('backups', BackupViewSet)

urlpatterns = router.urls
