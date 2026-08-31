from rest_framework.routers import DefaultRouter
from .views import ExamViewSet, ExamSubjectViewSet, GradeViewSet, MarkViewSet

router = DefaultRouter()
router.register('exams', ExamViewSet)
router.register('exam-subjects', ExamSubjectViewSet)
router.register('grades', GradeViewSet)
router.register('marks', MarkViewSet)

urlpatterns = router.urls
