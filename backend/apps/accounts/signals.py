from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import User


@receiver(pre_save, sender=User)
def sync_superuser_role(sender, instance, **kwargs):
    """
    Whenever an account is (or becomes) a Django superuser
    (e.g. via `createsuperuser` or the Django admin), force its
    app-level `role` to ADMIN too, so it gets full manager access
    (add/edit/delete students & teachers, documents, etc.) through
    the API and the React app -- not just the /admin/ site.
    """
    if instance.is_superuser and instance.role != User.Role.ADMIN:
        instance.role = User.Role.ADMIN
