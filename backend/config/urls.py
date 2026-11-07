from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from .views import health_check, api_root

urlpatterns = [
    # Root redirect to API interactive docs
    path('', RedirectView.as_view(url='/api/docs/', permanent=False), name='root-redirect'),

    path('admin/', admin.site.urls),

    # Health check endpoint (unauthenticated)
    path('api/health/', health_check, name='health-check'),

    # API overview
    path('api/', api_root, name='api-root'),

    # API schema / docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Auth
    path('api/auth/', include('apps.accounts.urls')),

    # Feature apps
    path('api/students/', include('apps.students.urls')),
    path('api/teachers/', include('apps.teachers.urls')),
    path('api/academics/', include('apps.academics.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/exams/', include('apps.exams.urls')),
    path('api/fees/', include('apps.fees.urls')),
    path('api/timetable/', include('apps.timetable.urls')),
    path('api/homework/', include('apps.homework.urls')),
    path('api/announcements/', include('apps.announcements.urls')),
    path('api/documents/', include('apps.documents.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
