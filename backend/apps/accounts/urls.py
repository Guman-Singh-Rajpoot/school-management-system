from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views


urlpatterns = [

    # Register
    path(
        "register/",
        views.RegisterView.as_view(),
        name="register",
    ),

    # Login
    path(
        "login/",
        views.CustomTokenObtainPairView.as_view(),
        name="login",
    ),

    # Refresh JWT
    path(
        "refresh/",
        TokenRefreshView.as_view(),
        name="refresh",
    ),

    # Logout
    path(
        "logout/",
        views.LogoutView.as_view(),
        name="logout",
    ),

    # Current logged-in user
    path(
        "me/",
        views.MeView.as_view(),
        name="me",
    ),

    # Change password
    path(
        "change-password/",
        views.ChangePasswordView.as_view(),
        name="change-password",
    ),

    # Users
    path(
        "users/",
        views.UserListCreateView.as_view(),
        name="users",
    ),

    path(
        "users/<int:pk>/",
        views.UserDetailView.as_view(),
        name="user-detail",
    ),
]