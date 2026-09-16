from rest_framework.routers import DefaultRouter
from .views import HomeworkViewSet, HomeworkSubmissionViewSet

router = DefaultRouter()
router.register('submissions', HomeworkSubmissionViewSet)
router.register('', HomeworkViewSet)

urlpatterns = router.urls
