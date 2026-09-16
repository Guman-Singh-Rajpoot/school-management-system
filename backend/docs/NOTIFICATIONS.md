# Notifications

In-app notifications (dashboard list + unread count) work out of the box
with **zero configuration**. Every announcement automatically creates a
`Notification` row for each user in its target audience, and the frontend
reads these via:

- `GET  /api/announcements/notifications/` — list your own notifications
- `GET  /api/announcements/notifications/unread_count/` — badge count
- `PATCH /api/announcements/notifications/<id>/mark_read/` — mark as read

## Adding real phone push (optional)

To also push announcements to phones (Android/iOS), the dispatch seam is
already in place in `apps/announcements/services.py` — `dispatch()` is
called automatically every time a `Notification` row is created, and
currently marks it `NOT_CONFIGURED` because no provider is set up.

To wire up Firebase Cloud Messaging (the usual choice, since it covers both
Android and iOS from one API):

1. Create a Firebase project and a service account with the "Firebase Cloud
   Messaging API" enabled.
2. Add to `backend/.env`:

   ```
   PUSH_PROVIDER=fcm
   FCM_PROJECT_ID=your-firebase-project-id
   FCM_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
   ```

3. Add a way to store each user's FCM device/registration token (a
   `device_token` field on `User`, or a separate `DeviceToken` model if you
   want to support multiple devices per user) and have the mobile app POST
   its token after login.
4. Implement `_send_via_provider()` in `apps/announcements/services.py` to
   call the FCM HTTP v1 API with that token.

Until step 4 is done, everything else keeps working exactly as-is —
`dispatch()` never raises, so a missing/broken push provider can never break
the request that created the announcement.
