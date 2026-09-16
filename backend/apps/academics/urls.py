from rest_framework.routers import DefaultRouter
from .views import SessionViewSet, SchoolClassViewSet, SectionViewSet, SubjectViewSet

router = DefaultRouter()
router.register('sessions', SessionViewSet)
router.register('classes', SchoolClassViewSet)
router.register('sections', SectionViewSet)
router.register('subjects', SubjectViewSet)

urlpatterns = router.urls
