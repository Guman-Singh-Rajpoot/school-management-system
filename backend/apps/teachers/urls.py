from rest_framework.routers import DefaultRouter
from .views import (
    TeacherViewSet, TeacherDocumentViewSet, TeacherSalaryViewSet, SalaryPaymentViewSet,
    TeacherAttendanceViewSet,
)

router = DefaultRouter()
router.register('documents', TeacherDocumentViewSet)
router.register('salaries', TeacherSalaryViewSet)
router.register('salary-payments', SalaryPaymentViewSet)
router.register('attendance', TeacherAttendanceViewSet)
router.register('', TeacherViewSet)

urlpatterns = router.urls
