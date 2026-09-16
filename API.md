# API Reference

Base URL: `/api/`. Interactive docs at `/api/docs/` (Swagger) and `/api/redoc/`.

Every endpoint requires `Authorization: Bearer <access_token>` unless noted. Unauthenticated requests get `401`.

List responses are paginated — `{count, next, previous, results}` — 20 per page.

> This file is written from the actual routers and serializers. If it disagrees with `/api/docs/`, trust `/api/docs/` and fix this file.

## Auth — `/api/auth/`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `register/` | — | Register a user |
| POST | `login/` | — | Obtain tokens |
| POST | `refresh/` | — | Exchange refresh for a new access token |
| POST | `logout/` | Yes | Blacklist the refresh token |
| GET | `me/` | Yes | Current user |
| POST | `change-password/` | Yes | Change own password |
| GET | `users/` | Admin | List users |
| GET/PATCH/DELETE | `users/<id>/` | Admin | Manage a user |

**Login**

```http
POST /api/auth/login/
{"username": "admin", "password": "..."}
```

```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {"id": 1, "username": "admin", "email": "admin@example.com",
           "role": "ADMIN", "full_name": "Ada Admin"}
}
```

Access token lives 30 minutes, refresh 7 days. Refresh tokens rotate and the old one is blacklisted.

## Students — `/api/students/`

| Method | Path | Who |
|---|---|---|
| GET | `/api/students/` | Admin, Teacher (all) · Student (own only) |
| POST | `/api/students/` | Admin |
| GET | `/api/students/<id>/` | Admin, Teacher · Student for own record (`403` otherwise) |
| PATCH / DELETE | `/api/students/<id>/` | Admin |
| GET/POST | `/api/students/documents/` | Admin writes · owner reads |

`?search=` matches admission number, name, or mobile number.

**Create** provisions the `User` and profile together:

```json
{
  "username": "student1", "email": "s1@example.com",
  "first_name": "Sam", "last_name": "Rao", "password": "...",
  "admission_number": "ADM-001", "gender": "M",
  "date_of_birth": "2012-05-01", "admission_date": "2024-04-01",
  "session": 1, "school_class": 1, "section": 1
}
```

Read responses add `full_name`, `session_name`, `school_class_name`, `section_name`, and nested `user` and `documents`.

Editable via PATCH: `gender`, `date_of_birth`, `mobile_number`, `current_address`, `city`, `state`, `father_name`, `father_mobile`, `mother_name`, `mother_mobile`, `guardian_name`, `guardian_mobile`, `session`, `school_class`, `section`, `status` (`ACTIVE` / `INACTIVE` / `GRADUATED` / `TRANSFERRED`). Read-only: `id`, `user`, `created_at`, `updated_at`.

## Teachers — `/api/teachers/`

| Method | Path | Who |
|---|---|---|
| GET | `/api/teachers/` | Admin (all) · Teacher (own only) |
| POST | `/api/teachers/` | Admin |
| GET | `/api/teachers/<id>/` | Admin · Teacher for self (`403` otherwise) |
| PATCH / DELETE | `/api/teachers/<id>/` | Admin |
| — | `/api/teachers/documents/` | Admin writes · owner reads |
| — | `/api/teachers/salaries/` | Admin writes · teacher reads own |
| — | `/api/teachers/salary-payments/` | Admin writes · teacher reads own |
| — | `/api/teachers/attendance/` | Admin writes · teacher reads own |

**Create** — required: `username`, `email`, `first_name`, `last_name`, `password`, `employee_id` (unique), `gender`, `date_of_birth`, `joining_date`, `qualification`, `department`. The response includes `id`.

PATCH accepts: `qualification`, `department`, `experience_years`, `salary`, `address`, `aadhaar_number`, `pan_number`, `bank_name`, `bank_account_number`, `bank_ifsc`.

### Salary

`TeacherSalary` is one record per teacher per month.

```json
POST /api/teachers/salaries/
{"teacher": 2, "salary_month": "2026-08-01", "amount": "45000"}
```

Returns `teacher_name`, `employee_id`, `paid_amount`, `remaining_amount`, and nested `payments`. A duplicate teacher+month is rejected with `400`.

```json
POST /api/teachers/salary-payments/
{"teacher_salary": 1, "amount": "25000",
 "payment_method": "BANK_TRANSFER", "reference_number": "TXN123"}
```

`payment_method`: `CASH` · `CARD` · `UPI` · `BANK_TRANSFER` · `CHEQUE`. Amount must be > 0 and must not exceed the remaining balance. `created_at` and `created_by` are server-set.

### Teacher attendance

```json
POST /api/teachers/attendance/
{"teacher": 2, "date": "2026-08-30", "status": "PRESENT", "remarks": ""}
```

Status: `PRESENT` · `ABSENT` · `LEAVE` — no `HOLIDAY`. One record per teacher per date; duplicates return `400`. `marked_by` is server-set. Filters: `teacher`, `date`, `status`.

## Academics — `/api/academics/`

Read: any authenticated user. Write: **Admin only**.

| Resource | Path | Fields |
|---|---|---|
| Sessions | `sessions/` | `name`, `start_date`, `end_date`, `is_current` |
| Classes | `classes/` | `name`, `session` → adds `session_name` |
| Sections | `sections/` | `class_room`, `name` → adds `class_room_name` |
| Subjects | `subjects/` | `name`, `code` (unique), `school_class`, `is_elective` → adds `school_class_name` |

Filters: classes by `name`, `session`; sections by `class_room`, `name`; subjects by `school_class`, `is_elective`.

> The section FK is named **`class_room`**, not `school_class`. Subjects use `school_class`. This asymmetry is real and has caused bugs — check before assuming.

## Attendance — `/api/attendance/`

| Method | Path | Who |
|---|---|---|
| GET | `/api/attendance/` | Admin, Teacher (all) · Student (own only) |
| POST/PATCH/DELETE | `/api/attendance/` | Admin, Teacher |
| POST | `/api/attendance/bulk_mark/` | Admin, Teacher |
| GET | `/api/attendance/summary/` | Any (scoped) |

```json
POST /api/attendance/
{"student": 1, "date": "2026-08-30", "status": "PRESENT", "remarks": ""}
```

Status: `PRESENT` · `ABSENT` · `LEAVE` · `HOLIDAY`. One record per student per date. Filters: `student`, `date`, `status`.

`summary/` respects the same filters and returns:

```json
{"total_days": 20, "present_days": 18,
 "attendance_percentage": 90.0,
 "breakdown": [{"status": "PRESENT", "count": 18}]}
```

## Fees — `/api/fees/`

| Resource | Path | Who |
|---|---|---|
| Fee structures | `fee-structures/` | Admin writes · authenticated reads |
| Student fees | `student-fees/` | Admin writes · student reads own |
| Payments | `payments/` | Admin writes · student reads own |
| Dashboard | `student-fees/dashboard_summary/` | Admin |

```json
POST /api/fees/fee-structures/
{"school_class": 1, "session": 1, "fee_type": "Tuition",
 "amount": "50000", "due_date": "2026-06-01"}

POST /api/fees/student-fees/
{"student": 1, "fee_structure": 1,
 "discount_amount": "0", "scholarship_amount": "0"}
```

A `StudentFee` read returns computed values:

```json
{"id": 1, "student": 1, "student_name": "Sam Rao",
 "fee_type": "Tuition", "due_date": "2026-06-01",
 "net_payable": "50000.00", "paid_amount": 20000.0,
 "pending_amount": 30000.0, "payments": [...]}
```

```json
POST /api/fees/payments/
{"student_fee": 1, "amount": "20000", "method": "CASH", "remarks": "1st instalment"}
```

`method`: `CASH` · `CARD` · `UPI` · `BANK_TRANSFER` · `CHEQUE`. Must be > 0 and within the remaining balance. Server-set and non-overridable: `receipt_number`, `paid_on`, `created_at`, `created_by`.

`dashboard_summary/` returns `total_fee_collection` and `total_pending`.

## Exams — `/api/exams/`

| Resource | Path | Who |
|---|---|---|
| Exams | `exams/` | Admin writes · all read (calendar) |
| Exam subjects | `exam-subjects/` | Admin writes |
| Grades | `grades/` | Admin writes |
| Marks | `marks/` | Admin, authorised Teacher write · student reads own |
| Report card | `marks/report_card/?student=<id>&exam=<id>` | Admin, Teacher · student for self |

```json
POST /api/exams/exams/
{"name": "Midterm", "exam_type": "MIDTERM", "school_class": 1, "session": 1,
 "start_date": "2026-09-01", "end_date": "2026-09-10", "room": ""}

POST /api/exams/exam-subjects/
{"exam": 1, "subject": 1, "max_marks": 100, "passing_marks": 33}

POST /api/exams/grades/
{"name": "A", "min_percentage": 90, "max_percentage": 100, "grade_point": 9}

POST /api/exams/marks/
{"student": 1, "exam_subject": 1, "marks_obtained": 85}
```

Report card:

```json
{"student_id": 1, "exam_id": 1, "subjects": [...],
 "total_marks_obtained": 85.0, "total_max_marks": 100.0,
 "percentage": 85.0, "rank": 1}
```

A student passing someone else's `student` id gets `403`.

## Announcements — `/api/announcements/`

| Method | Path | Who |
|---|---|---|
| GET | `/api/announcements/` | All (scoped to audience) |
| POST/PATCH/DELETE | `/api/announcements/` | **Admin only** |
| GET | `/api/announcements/notifications/` | Own only |
| GET | `/api/announcements/notifications/unread_count/` | Own only |
| PATCH | `/api/announcements/notifications/<id>/mark_read/` | Own only |
| — | `/api/announcements/messages/` | Direct messages |

```json
POST /api/announcements/
{"title": "Holiday Notice", "message": "School closed tomorrow", "audience": "ALL"}
```

`audience`: `ALL` · `STUDENTS` · `TEACHERS` · `CLASS` (then `class_room` is required). Creating one fans out `Notification` rows to every user in the audience. Filters: `audience`, `class_room`.

> The announcement router registers at the app root, so the collection is `/api/announcements/` — **not** `/api/announcements/announcements/`.

## Homework — `/api/homework/`

| Method | Path | Who |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/homework/` | Admin, Teacher |
| — | `/api/homework/submissions/` | Teacher reviews · student submits own |

```json
POST /api/homework/
{"title": "Chapter 1", "description": "Exercises 1-10",
 "section": 1, "subject": 1, "teacher": 2, "due_date": "2026-09-05"}
```

`section`, `subject`, and `teacher` are all required. A Teacher's own `teacher` value is forced to themselves; Admin's explicit choice is respected.

## Timetable — `/api/timetable/`

```json
POST /api/timetable/
{"section": 1, "subject": 1, "teacher": 2,
 "day_of_week": 0, "start_time": "09:00", "end_time": "10:00"}
```

`day_of_week` is an **integer** 0–6 (Monday = 0), not a string like `"MON"`. Admin writes; teachers and students read their own.

## Documents — `/api/documents/`

| Resource | Path | Who |
|---|---|---|
| Generated documents | `generated/` | Admin, Teacher (all) · Student (own only) |
| Backup records | `backups/` | Admin |

Filters: `document_type`, `student`. `uploaded_by` and `uploaded_at` are server-set. A student requesting another student's document gets `403`.

File uploads use `multipart/form-data`:

```js
const formData = new FormData();
formData.append("student", studentId);
formData.append("file", file);
formData.append("document_type", "AADHAAR");

await api.post("/students/documents/", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

`backups/` stores backup **metadata** for the dashboard; it does not itself run `pg_dump`. See `backend/docs/DEPLOYMENT.md`.

## Status codes

| Code | Meaning here |
|---|---|
| `200` / `201` / `204` | Success / created / deleted |
| `400` | Validation failed — duplicate attendance, payment over balance, bad choice value |
| `401` | Missing, expired, or malformed token — the client refreshes once, then redirects to login |
| `403` | Authenticated but not permitted, **including requesting another user's record** |
| `404` | Genuinely does not exist |
| `500` | Server bug — report it |

Validation errors are field-keyed:

```json
{"employee_id": ["teacher with this employee id already exists."]}
```
