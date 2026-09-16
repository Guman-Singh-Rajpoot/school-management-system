# Functional Specification

What the system is meant to do, and the rules it must hold to. This is the reference for deciding whether a behaviour is a bug or a design choice.

## 1. Roles

Three roles, stored on `accounts.User.role`. A user has exactly one.

| Role | Broad capability |
|---|---|
| `ADMIN` | Full CRUD on everything. The only role that manages academic structure, fees, salaries, and announcements. |
| `TEACHER` | Reads the student roster. Marks student attendance. Manages their own homework and marks entry. Reads **only their own** salary, documents, and attendance. |
| `STUDENT` | Read-only, and only ever their own record: own attendance, own fees, own documents, own results. Plus announcements addressed to them. |

### Non-negotiable rule

**Permissions are enforced server-side.** Hiding a button in React is a convenience, never a security control. Someone with a valid token must not be able to reach another user's data through Postman, curl, or a crafted request.

Two failure modes matter and are distinct:

- Requesting **another user's** record → `403 Forbidden`, not `404`. A 404 leaks nothing but also misleads; the object-level permission check is what must reject it.
- Requesting a record that **does not exist** → `404 Not Found`.

This is why list endpoints pre-filter the queryset by owner, but retrieve/update/destroy deliberately do not — they let the object-level permission produce the 403.

## 2. Authentication

JWT, via `djangorestframework-simplejwt`.

- Login returns `access`, `refresh`, and a `user` object (id, username, email, role, full_name).
- Access token: 30 minutes. Refresh token: 7 days.
- Refresh tokens rotate, and the old one is blacklisted (`token_blacklist` app must be installed or logout breaks).
- Frontend stores tokens in `localStorage` and attaches `Authorization: Bearer <access>` via an axios request interceptor.
- On `401`, the client refreshes once and retries the original request; concurrent 401s queue behind a single refresh rather than stampeding.
- Logout blacklists the refresh token and clears local storage.

Default DRF permission is `IsAuthenticated` — endpoints are closed unless explicitly opened.

## 3. Data model rules

### Academic structure

A strict hierarchy:

```
Session (2026-2027)
  └── SchoolClass (Class 10)
        ├── Section (A, B)
        └── Subject (Mathematics, Science)
```

- `SchoolClass.session` is a nullable FK to `Session`.
- `Section.class_room` is a FK to `SchoolClass` (note: the field is `class_room`, **not** `school_class`).
- `Subject.school_class` is a FK to `SchoolClass`, with a unique `code`.
- Read: any authenticated user (students and teachers need this for forms and timetables). Write: Admin only.

### Students

- Creating a student provisions the `User` (role auto-set to `STUDENT`) and the `Student` profile in one request.
- `admission_number` is unique and is the human-facing identifier.
- A student's own record is reachable by that student; any other student's is `403`.

### Teachers and salary

- Creating a teacher likewise provisions `User` + `Teacher` in one request.
- `TeacherSalary` is **per teacher per month** — one record, enforced unique. It carries the amount due.
- `SalaryPayment` rows attach to a `TeacherSalary` via `teacher_salary` FK. Several partial payments may exist per salary.
- Derived, never stored: `paid_amount` = sum of payments; `remaining_amount` = amount − paid.
- A payment must be > 0 and must not push the total over the salary amount.
- A teacher may read their own salary and payment history. Never another teacher's. Write is Admin-only, including corrections — financial history is not silently editable by non-admins.

### Fees

- `FeeStructure` defines a fee for a class + session (type, amount, due date).
- `StudentFee` assigns a structure to a student, with optional `discount_amount` and `scholarship_amount`.
- Derived, never stored:
  - `net_payable` = structure amount − discount − scholarship (floored at 0)
  - `paid_amount` = sum of `Payment.amount`
  - `remaining_amount` / `pending_amount` = net_payable − paid (floored at 0)
  - `payment_status` = `PAID` / `PARTIAL` / `UNPAID`
- `Payment` records an instalment: amount, method, remarks, auto `receipt_number`.
- A payment must be > 0 and must not exceed the remaining balance.
- `created_at` (date **and** time) and `created_by` are set by the server. The client cannot supply or alter them — this is what makes "who recorded this payment, and when" trustworthy.
- Students may view their own fees and payments. They may never create, edit, or delete them.

### Attendance

Two independent models:

- `Attendance` — students. Status: `PRESENT`, `ABSENT`, `LEAVE`, `HOLIDAY`.
- `TeacherAttendance` — teachers. Status: `PRESENT`, `ABSENT`, `LEAVE` (no `HOLIDAY`).

Both enforce **one record per person per date** (`unique_together`). Attempting a duplicate returns `400`, not a second row.

- Student attendance: Admin and Teacher mark it; Students read only their own.
- Teacher attendance: Admin marks it; a Teacher reads only their own.
- `marked_by` is set from the request user, never the payload.

### Exams and marks

```
Exam → ExamSubject → Mark
                Grade (banding by percentage)
```

- Admin creates exams and exam-subjects. Admin, or an authorised teacher, enters marks.
- A student may view their own results and report card.
- The report card endpoint computes total, percentage, and rank.
- A student must not be able to fetch another student's report card by passing a different `student` query param.

### Announcements and notifications

- `Announcement` has a `title`, `message`, and an `audience`: `ALL`, `STUDENTS`, `TEACHERS`, or `CLASS` (with `class_room` set).
- Create / edit / delete is **Admin only**.
- Creating an announcement fans out a `Notification` row to every user in the target audience.
- Each user — including Admin — sees only notifications addressed to them. `Notification` is a per-recipient delivery record, not an audit log.
- In-app notifications work with zero configuration. Phone push is an optional add-on (see `backend/docs/NOTIFICATIONS.md`); a missing or broken push provider must never break the request that created the announcement.

### Documents

- Student and teacher documents upload as files, with `uploaded_by` and a `verified` flag set server-side.
- Admin writes; the owning student or teacher reads their own.
- A student requesting another student's document gets `403`.

## 4. Data integrity rules

- **The database starts empty.** No fixtures, no seed commands, no demo users, no sample students. A test (`DatabaseStartsEmptyTests`) asserts `User`/`Student`/`Teacher` counts are zero on a fresh migration. Frontend pages must render real API data or an honest empty state — never placeholder rows or hardcoded charts.
- **Server-generated fields stay server-generated.** Timestamps, `created_by`, `marked_by`, `uploaded_by`, receipt numbers: all `read_only` in their serializers.
- **Money is computed, not stored.** Paid and pending amounts derive from payment rows so they cannot drift out of sync.

## 5. Admin module scope

The Admin area covers:

- Dashboard — student/teacher counts, fee collected, fee pending, today's attendance
- Students — list, add, view, edit, delete, documents
- Teachers — list, add, view, edit, delete, documents
- Student attendance — mark and review, filter by date and status
- Teacher attendance — mark and review
- Fees — assign a fee, record a payment, see total / paid / pending / payment date-time
- Teacher salary — define monthly salary, record payment, see total / paid / pending / history
- Announcements — create, view, delete, with audience targeting
- Classes — sessions, classes, sections, subjects

### Not yet built

Dedicated UI pages for **Exams, Marks entry, Documents browser, Homework, and Timetable** do not exist. The APIs for all of them are live and tested; only the screens are missing. Navigation deliberately does not link to them rather than shipping dead links.
