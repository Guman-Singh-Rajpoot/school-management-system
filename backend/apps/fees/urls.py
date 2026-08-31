from rest_framework.routers import DefaultRouter
from .views import FeeStructureViewSet, StudentFeeViewSet, PaymentViewSet

router = DefaultRouter()
router.register('fee-structures', FeeStructureViewSet)
router.register('student-fees', StudentFeeViewSet)
router.register('payments', PaymentViewSet)

urlpatterns = router.urls
