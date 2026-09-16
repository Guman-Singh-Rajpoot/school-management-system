"""
Push notification dispatch.

This module is intentionally a clean seam between "we created an in-app
Notification row" and "we told a push provider (FCM/APNs/etc) to buzz the
user's phone". Nothing here requires a push provider to be configured --
Notification rows are always created and always visible in-app; this just
upgrades delivery_status to SENT/FAILED when a provider *is* configured.

To wire up real phone push notifications, set the following in backend/.env
(see .env.example) and implement `_send_via_provider` below for your chosen
provider (Firebase Cloud Messaging is the common choice for both Android and
iOS via a single API):

    PUSH_PROVIDER=fcm
    FCM_SERVER_KEY=<your Firebase server key>
    # or, for the newer HTTP v1 API:
    FCM_PROJECT_ID=<your Firebase project id>
    FCM_SERVICE_ACCOUNT_JSON=<path to service account credentials JSON>

Each User would also need a `device_token` (FCM registration token) captured
from the mobile app on login -- that's a small addition to the User model
(or a separate DeviceToken model, to support multiple devices per user)
once you're ready to add real push. Until then, `dispatch` simply marks the
notification NOT_CONFIGURED and the frontend keeps working entirely off the
in-app Notification list/unread-count endpoints.
"""
from django.conf import settings


def dispatch(notification):
    """Attempt to push `notification` to the recipient's device(s).

    Never raises -- delivery problems must never break the request that
    created the announcement/notification.
    """
    provider = getattr(settings, 'PUSH_PROVIDER', None)
    if not provider:
        notification.delivery_status = notification.DeliveryStatus.NOT_CONFIGURED
        notification.save(update_fields=['delivery_status'])
        return

    try:
        _send_via_provider(provider, notification)
        notification.delivery_status = notification.DeliveryStatus.SENT
    except Exception:
        notification.delivery_status = notification.DeliveryStatus.FAILED
    notification.save(update_fields=['delivery_status'])


def _send_via_provider(provider, notification):  # pragma: no cover - integration point
    """Implement this once a real push provider is configured. Left as a
    stub so the rest of the system works cleanly without one."""
    raise NotImplementedError(f"No push integration implemented for provider '{provider}' yet.")
