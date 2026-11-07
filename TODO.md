# School Management System - Implementation TODO

## STATUS: COMPLETE

All implementation stages are done. Here is the summary:

### DONE - Stage 1: Backend Migrations
- `accounts.0002`: Added `must_change_password`, `whatsapp_number` to User; created `PasswordResetToken` model
- `accounts.0003`: Created `School` model; added `school` FK to User; extended `role` with `OWNER` choice
- `announcements.0002`: Created `WhatsAppConfig`, `WhatsAppNotification` models; added announcement WhatsApp fields
- `students.0003`: Added `unique_together` constraint on `school_class, section, roll_number`
- `teachers.0003`: Added `sections` M2M field to Teacher
- `fees.0003`: Added `month`, `year`, `payment_status_field` to StudentFee; conditional unique constraint

### DONE - Stage 2: Monthly Fee System
- `StudentFee` model: Added `month` (1-12), `year` fields; `payment_status_field` (PENDING/PARTIALLY_PAID/PAID)
- `StudentFee.save()`: Keeps `payment_status_field` in sync; defaults new records to PENDING
- `Payment.save()`/`delete()`: Updates parent `StudentFee.payment_status_field` after payment changes
- Conditional unique constraint: `(student, month, year)` prevents duplicate monthly fee records
- `FeeStructureViewSet.generate_monthly` action: Generates StudentFee records for all active students in a class for a given month/year, skipping existing ones
- `StudentFeeSerializer`: Exposes `payment_status` (computed), `month`, `year`, `payment_status_field`
- `payment_status` property returns 'PENDING'/'PARTIALLY_PAID'/'PAID'

### DONE - Stage 3: WhatsApp Integration
- `whatsapp.py` service: `send_whatsapp()`, `send_announcement_notifications()`, `send_fee_reminder()`, `send_fee_paid_confirmation()`, `send_salary_paid_notification()`, `send_account_created_notification()`
- Credentials from env vars (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) with DB config fallback
- Graceful degradation: logs as NOT_CONFIGURED when credentials missing; never breaks callers
- `send_fee_paid_confirmation` wired into `PaymentViewSet.perform_create`
- `send_salary_paid_notification` wired into `SalaryPaymentViewSet.perform_create`
- `send_account_created_notification` wired into `TeacherCreateSerializer.create` and `StudentCreateSerializer.create`
- `WhatsAppConfigViewSet` + `status` action; `WhatsAppNotificationViewSet` + `retry` action

### DONE - Stage 4: Frontend
- `Login.jsx`: Redirects to `/change-password` when `must_change_password` is true
- `App.jsx` `ProtectedRoute`: Blocks dashboard access when `must_change_password` is true, redirects to `/change-password`
- `ChangePassword.jsx`: Forced password change page with old/new password validation
- `WhatsAppSettings.jsx`: Admin WhatsApp config + notification audit history with retry
- `DashboardLayout.jsx`: WhatsApp & Alerts nav item for admin
- `App.jsx`: `/change-password` route, `/admin/whatsapp` route, `/register` redirects to `/login`
- `Fees.jsx`: Payment status badge (PENDING/PARTIALLY_PAID/PAID) in fee table
- Frontend build: 0 errors; Lint: 0 errors (32 pre-existing warnings)

### DONE - Stage 5: Testing
- All 36 Django tests pass (permission/security matrix, password reset, roll number uniqueness, WhatsApp access)
- No pending migrations
- Django `check` passes; `spectacular` schema validates

### Files Changed

Backend:
- `backend/apps/accounts/migrations/0002_*.py` (new)
- `backend/apps/accounts/migrations/0003_*.py` (new)
- `backend/apps/accounts/models.py` (School model, User.school FK, role OWNER)
- `backend/apps/accounts/permissions.py` (IsOwner, is_owner property)
- `backend/apps/accounts/serializers.py` (RegisterSerializer fields, must_change_password)
- `backend/apps/accounts/tests.py` (Section FK fix, roll number test assertion)
- `backend/apps/accounts/views.py`
- `backend/apps/accounts/urls.py`
- `backend/apps/announcements/migrations/0002_*.py` (new)
- `backend/apps/announcements/models.py` (WhatsAppConfig, WhatsAppNotification, announcement fields)
- `backend/apps/announcements/serializers.py`
- `backend/apps/announcements/views.py`
- `backend/apps/announcements/urls.py`
- `backend/apps/announcements/whatsapp.py` (WhatsApp service)
- `backend/apps/students/migrations/0003_*.py` (new)
- `backend/apps/students/models.py`
- `backend/apps/students/serializers.py` (roll_number optional, whatsapp_number, must_change_password)
- `backend/apps/students/views.py`
- `backend/apps/fees/migrations/0003_*.py` (new)
- `backend/apps/fees/models.py` (month, year, payment_status_field, save overrides)
- `backend/apps/fees/serializers.py` (payment_status field)
- `backend/apps/fees/views.py` (generate_monthly action, WhatsApp on payment)
- `backend/apps/teachers/migrations/0003_*.py` (new)
- `backend/apps/teachers/models.py` (sections M2M)
- `backend/apps/teachers/serializers.py` (whatsapp_number, must_change_password, WhatsApp on create)
- `backend/apps/teachers/views.py` (WhatsApp on salary payment)
- `backend/config/settings.py`
- `backend/config/urls.py`

Frontend:
- `frontend/src/App.jsx` (routes, ProtectedRoute guard)
- `frontend/src/api/client.js`
- `frontend/src/pages/Login.jsx` (must_change_password redirect)
- `frontend/src/pages/ChangePassword.jsx` (new)
- `frontend/src/pages/WhatsAppSettings.jsx` (new)
- `frontend/src/pages/Fees.jsx` (payment status badge)
- `frontend/src/components/AddStudentForm.jsx`
- `frontend/src/components/AddTeacherForm.jsx`
- `frontend/src/layouts/DashboardLayout.jsx` (WhatsApp nav item)
- `frontend/src/pages/AdminDashboard.jsx`, `Announcements.jsx`, `Attendance.jsx`, `StudentDashboard.jsx`, `StudentDetail.jsx`, `TeacherAttendance.jsx`, `TeacherDashboard.jsx`, `TeacherDetail.jsx`
- `frontend/vite.config.js`

### Environment Variables Required

Backend `.env`:
- `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`
- `FRONTEND_URL`
- WhatsApp (optional): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`

Frontend `.env`:
- `VITE_API_URL`

### External Setup Required
1. **PostgreSQL database** - Create `school_management` database
2. **WhatsApp Business Cloud API** - Get access token and phone number ID from Meta Developer Dashboard; set in `.env` or via WhatsApp settings page
3. **Email SMTP** - Configure for password reset emails (defaults to console backend in debug)

### Local Run Commands (PowerShell)

Backend:
```powershell
cd C:\Users\guman\Desktop\school-management-system/backend
.\venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py create_school_admin --username admin --email admin@school.com --password "SecurePass123!"
python manage.py runserver 0.0.0.0:8000
```

Frontend:
```powershell
cd C:\Users\guman\Desktop\school-management-system/frontend
npm run dev
```

### Test Commands
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py test --noinput
```
