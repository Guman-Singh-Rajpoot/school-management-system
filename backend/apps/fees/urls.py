from rest_framework.routers import DefaultRouter
from .views import (
    FeeStructureViewSet,
    StudentFeeViewSet,
    PaymentViewSet,
    StudentFeeAdjustmentViewSet,
)

router = DefaultRouter()
router.register('fee-structures', FeeStructureViewSet)
router.register('student-fees', StudentFeeViewSet)
router.register('payments', PaymentViewSet)
router.register('adjustments', StudentFeeAdjustmentViewSet, basename='adjustment')

urlpatterns = router.urls
