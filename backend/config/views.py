from django.http import JsonResponse, HttpResponseNotAllowed
from django.db import connection


def health_check(request):
    """
    Unauthenticated health check endpoint.
    Returns JSON indicating backend and database connectivity.
    Does not expose secrets, credentials, or internal configuration.
    """
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    db_status = "connected"
    is_healthy = True

    try:
        connection.ensure_connection()
    except Exception:
        db_status = "disconnected"
        is_healthy = False

    payload = {
        "status": "healthy" if is_healthy else "unhealthy",
        "database": db_status,
    }
    return JsonResponse(payload, status=200 if is_healthy else 503)


def api_root(request):
    """
    Unauthenticated API root endpoint.
    Provides entry-point links to documentation, health check, and auth routes.
    """
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    return JsonResponse({
        "name": "School Management System API",
        "status": "online",
        "docs": "/api/docs/",
        "redoc": "/api/redoc/",
        "health": "/api/health/",
        "auth": "/api/auth/",
    })
