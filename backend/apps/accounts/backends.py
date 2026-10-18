from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from .models import User


class EmailOrUsernameOrPhoneModelBackend(ModelBackend):
    """
    Custom authentication backend that allows users to authenticate using:
    - Username (case-insensitive)
    - Email address (case-insensitive)
    - Phone number
    - Student admission number (for students)
    - Teacher employee ID (for teachers)
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD) or kwargs.get('email') or kwargs.get('phone')

        if username is None or password is None:
            return None

        clean_identifier = str(username).strip()
        if not clean_identifier:
            return None

        user = None

        # 1. Exact username
        user = User.objects.filter(username=clean_identifier).first()

        # 2. Case-insensitive username
        if not user:
            user = User.objects.filter(username__iexact=clean_identifier).first()

        # 3. Email (case-insensitive)
        if not user:
            user = User.objects.filter(email__iexact=clean_identifier).exclude(email='').first()

        # 4. Phone number
        if not user:
            user = User.objects.filter(phone=clean_identifier).exclude(phone='').first()

        # 5. Student admission number (via student_profile)
        if not user:
            user = User.objects.filter(
                student_profile__admission_number__iexact=clean_identifier
            ).exclude(student_profile__admission_number='').first()

        # 6. Teacher employee ID (via teacher_profile)
        if not user:
            user = User.objects.filter(
                teacher_profile__employee_id__iexact=clean_identifier
            ).exclude(teacher_profile__employee_id='').first()

        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
