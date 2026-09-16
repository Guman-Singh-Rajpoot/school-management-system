# Changelog

Notable changes to this project. Newest first.

Entries describe what was actually wrong and how it was verified, because several of these bugs were invisible in the UI and only surfaced under live API testing.

---

## [Unreleased]

### Documentation

- Added `README.md`, `SPEC.md`, `ARCHITECTURE.md`, `API.md`, `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and `DEPLOY_RENDER.md`.
- `DEPLOY_RENDER.md` covers the full Render deployment, including the three required dependency additions (`gunicorn`, `whitenoise`, `dj-database-url`) and the ephemeral-filesystem problem affecting uploads.

### Known gaps

- No UI pages yet for Exams, Marks entry, Documents browser, Homework, or Timetable. The APIs exist and are tested; only the screens are missing. Navigation intentionally omits links to them rather than shipping dead ends.
- Media uploads are not production-ready on an ephemeral filesystem. See `DEPLOY_RENDER.md` §2.2.

---

## Frontend rebuild

### Added

- **`TeacherSalary.jsx`** — define a monthly salary per teacher, record payments against it, view total / paid / pending and full payment history.
- **`Classes.jsx`** — tabbed management of Sessions, Classes, Sections, and Subjects with create, edit, and delete.
- **Mark Attendance** forms in both `Attendance.jsx` and `TeacherAttendance.jsx`. Both pages were previously read-only tables with no way to record anything, despite that being the core requirement.
- **Edit forms** on `StudentDetail.jsx` and `TeacherDetail.jsx`. Neither page had any edit capability at all.
- `.input` utility class in `index.css` for consistent form controls.

### Fixed

- **`App.jsx` never used `DashboardLayout` or `ThemeProvider`.** Every admin, teacher, and student page rendered with no sidebar, no header, and no dark-mode toggle. Rewritten to mount the three role areas as nested layout routes with `<Outlet/>`.
- **Field-name guessing throughout the detail pages.** Code like `fee.total_amount ?? fee.totalAmount ?? fee.amount ?? 0` was falling through every branch because none of those fields exist — fee totals silently rendered as ₹0.00. Replaced with the real field names (`net_payable`, `paid_amount`, `pending_amount`), verified against live API responses.
- **`Fees.jsx` had no payment recording.** Rewritten with Assign Fee and Record Payment flows against `/api/fees/student-fees/` and `/api/fees/payments/`.
- **`AdminDashboard.jsx` displayed a hardcoded fake attendance chart** (`{name: 'Mon', present: 92}`…), violating the no-demo-data rule. Replaced with a real `/api/attendance/summary/` call for today.
- **`Announcements.jsx` had no role gating** — students and teachers saw Create and Delete controls that the backend would reject. Gated on `user.role`, and added the audience selector.
- **`TeacherAttendance.jsx` called a nonexistent endpoint** (`/teacher-attendance/`). Pointed at `/api/teachers/attendance/`.
- Navigation in `DashboardLayout` linked to Exams, Documents, Timetable, Homework, Marks, and Notifications pages that were never built — every one a dead link. Trimmed to routes that exist.
- `TeacherDashboard.jsx` used raw `<a href>` for internal navigation, forcing a full page reload and dropping SPA state. Switched to React Router `<Link>`.
- Student and teacher list rows navigated to `/students/:id` and `/teachers/:id`, which are not real routes. Corrected to `/admin/students/:id` and `/admin/teachers/:id`.
- Removed unused imports flagged by lint (`DataTable` in `TeacherDetail.jsx`, `Phone` icon references to a field that does not exist on `Teacher`).

---

## Backend consistency pass

### Added

- **`TeacherAttendance` API.** The model and migration existed but had no serializer, viewset, or URL — the frontend page was calling an endpoint that did not exist. Added `TeacherAttendanceSerializer`, `TeacherAttendanceViewSet`, and route `/api/teachers/attendance/`, following the same ownership pattern as salary payments. Admin manages all; a teacher reads only their own.
- `IsSelfTeacherViaTeacherSalaryFK` permission, resolving ownership through `teacher_salary.teacher.user`.
- `student_name` on `StudentFeeSerializer`; `session_name`, `school_class_name`, `section_name` on `StudentSerializer`; `session_name`, `class_room_name`, `school_class_name` on the academics serializers. These let list views show labels without extra round trips.
- `backend/docs/NOTIFICATIONS.md` and `backend/docs/DEPLOYMENT.md`, both referenced by code comments but previously missing.

### Fixed

- **Academic structure had no write protection.** Sessions, Classes, Sections, and Subjects were reachable with the project-wide `IsAuthenticated` default, so any student or teacher could create, edit, or delete them. Added `IsAdminOrReadOnly`: any authenticated user reads, only Admin writes.
- **`token_blacklist` was missing from `INSTALLED_APPS`** while `BLACKLIST_AFTER_ROTATION = True`. Logout and token rotation both failed at runtime. Added the app; its migrations now run.
- **Admin could not create Homework — 500 IntegrityError.** `perform_create` unconditionally overwrote `teacher` with the requester's own `teacher_profile`, which is `None` for Admin, violating the NOT NULL constraint. Now a Teacher is still pinned to themselves (no spoofing), but Admin's explicit choice is honoured.
- **Notification list leaked every user's notifications to Admin.** A special case returned the unfiltered queryset for Admin, contradicting the per-recipient design. Now scoped for everyone.
- **Teacher creation response omitted `id`.** `TeacherCreateSerializer.Meta.fields` listed every field except the primary key, so the frontend had no way to reference the record it had just created.
- **Cross-user requests returned `404` instead of `403`.** `StudentViewSet.get_queryset` filtered by owner on *every* action, so a foreign ID fell out of scope before the object-level permission could run. Now filters on `list` only. (This has regressed more than once — see `ARCHITECTURE.md`.)
- `announcements/views.py` referenced `school_class` and `announcement.body`; the real fields are `class_room` and `message`. Broke queryset filtering and the notification fan-out.
- `documents/views.py` filtered on `doc_type` (real field: `document_type`) and saved `generated_by` (real field: `uploaded_by`). `read_only_fields` also named fields that do not exist, so nothing was actually protected from client overwrite.
- Corrected the `BackupViewSet` docstring, which claimed it ran `pg_dump`. It records backup metadata only.

### Verification

Run against a clean checkout:

- `manage.py check` — no issues
- `manage.py makemigrations --check` — no pending changes
- `manage.py migrate` — applies cleanly from an empty database
- `manage.py test` — 29/29 pass
- `manage.py spectacular` — schema generates cleanly (this is what surfaced the `announcements` and `documents` field-name bugs; it instantiates every serializer and filterset)
- Live `curl` session covering login → session/class/section create → student create and edit → fee assign and pay → teacher create and edit → salary define and pay → attendance mark and duplicate rejection
- `npm run build` — succeeds, ~407 KB bundle
- `npm run lint` — 0 errors

---

## Model and migration repair

The `teachers` and `fees` apps each carried a migration that replaced a working model with an incompatible one, while serializers, views, and tests still referenced the original. The result was 13 of 29 tests failing, with `404`s where `403`s belonged, `400`s on valid creates, and `AttributeError: Cannot find 'payments'`.

### Fixed

- **`teachers.SalaryPayment`** — restored the `teacher_salary` FK to `TeacherSalary` (`related_name='payments'`). It had been swapped for an unrelated set of fields (`teacher`, `salary_month`, `salary_amount`, `amount_paid`, `status`, `recorded_by`) matching neither the serializer, the view, nor the model's own `__str__`.
- **`TeacherSalarySerializer`** had `SalaryPayment`'s validation logic pasted into it, checking fields that do not exist on `TeacherSalary`. Moved the real validation to `SalaryPaymentSerializer` and added a genuine duplicate-month check.
- **`fees.StudentFee`** — restored the `fee_structure` FK, `discount_amount`, `scholarship_amount`, and the `net_payable` / `paid_amount` / `remaining_amount` / `payment_status` properties.
- **`fees.Payment`** — restored `method`, `paid_on`, `receipt_number`, `remarks`, `student_fee`, and `created_by` (had been renamed `FeePayment` with `payment_type` / `recorded_by`).
- **`StudentSerializer`** listed `student_id`, `first_name`, `last_name`, `guardian_phone`, and `class_room` — none of which exist on the `Student` model. Rewritten against the real model.
- Deleted the two broken migrations, repaired the dependency graph in `attendance`, `exams`, and `documents` (which pointed at them), and regenerated clean replacements.
- Replaced float `MinValueValidator` arguments on `DecimalField`s with `Decimal` to clear the type warning.

### Frontend

- Pinned the Vite dev server to port 3000. Vite's default is 5173, which does not match the backend's `CORS_ALLOWED_ORIGINS` default — the dev frontend was being silently blocked.
- Added `ignorePatterns` for `node_modules` and `dist` to `.oxlintrc.json`. Lint was scanning the entire dependency tree and reporting 22,000+ warnings, burying the two real ones.

---

## Baseline

Initial state: Django + DRF backend with eleven feature apps, JWT auth, and role-based permissions; React + Vite frontend with role dashboards. Permission test suite added covering the role matrix.

**Data policy from the outset:** no fixtures, no seed commands, no demo records. `DatabaseStartsEmptyTests` asserts `User`, `Student`, and `Teacher` counts are zero on a freshly migrated database.
