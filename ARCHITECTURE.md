# Architecture

How the system is assembled, and why certain things are the way they are.

## System shape

```
┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  React SPA (Vite)    │  HTTP  │  Django + DRF        │        │  PostgreSQL  │
│  localhost:3000      │ ─────► │  localhost:8000      │ ─────► │              │
│                      │  /api  │                      │        │              │
│  axios + JWT         │ ◄───── │  JWT auth,           │        └──────────────┘
│  localStorage tokens │  JSON  │  object permissions  │
└──────────────────────┘        └──────────┬───────────┘
                                           │
                                           ▼
                                    media/ (uploads)
```

In development, Vite proxies `/api` to Django, so the browser sees a single origin and CORS is mostly moot. In production the two are usually separate hosts, which is where CORS and the API base URL become real concerns — see [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

## Backend

Django 5.0 + Django REST Framework, split into eleven feature apps under `apps/`.

| App | Models | Responsibility |
|---|---|---|
| `accounts` | `User`, `AuditLog` | Custom user with `role`, JWT auth endpoints, **all permission classes** |
| `students` | `Student`, `StudentDocument` | Student profiles and their documents |
| `teachers` | `Teacher`, `TeacherDocument`, `TeacherSalary`, `SalaryPayment`, `TeacherAttendance` | Teacher profiles, payroll, teacher attendance |
| `academics` | `Session`, `SchoolClass`, `Section`, `Subject` | Academic structure |
| `attendance` | `Attendance` | Student attendance |
| `exams` | `Exam`, `ExamSubject`, `Grade`, `Mark` | Exams, marks, report cards |
| `fees` | `FeeStructure`, `StudentFee`, `Payment` | Fee assignment and collection |
| `timetable` | `TimetableSlot` | Weekly schedule |
| `homework` | `Homework`, `HomeworkSubmission` | Assignments |
| `announcements` | `Announcement`, `Message`, `Notification` | Broadcasts and per-user notifications |
| `documents` | `GeneratedDocument`, `BackupRecord` | Generated documents, backup metadata |

### The permission layer

This is the most important part of the backend, and it all lives in one file: `apps/accounts/permissions.py`.

The base class is `IsAdminOrOwnerOfObject`. Subclasses declare a dotted path from the object to the owning `User`:

```python
class IsSelfTeacherViaTeacherSalaryFK(IsAdminOrOwnerOfObject):
    owner_attr = 'teacher_salary.teacher.user'
    allowed_roles = ('TEACHER',)
```

Admin always passes. Otherwise the requester's role must be in `allowed_roles` **and** the resolved owner must be the requester. Available classes:

- Role gates: `IsAdmin`, `IsTeacher`, `IsStudent`, `IsAdminOrTeacher`, `IsAdminOrReadOnly`
- Ownership gates: `IsSelfUser`, `IsSelfStudent`, `IsSelfTeacher`, `IsAdminOrSelfStudent`, `IsSelfStudentViaStudentFK`, `IsSelfStudentViaStudentFeeFK`, `IsSelfStudentOrTeacherViaStudentFK`, `IsSelfTeacherViaTeacherFK`, `IsSelfTeacherViaTeacherSalaryFK`

#### The 403-vs-404 pattern

A viewset that scopes data by owner filters the queryset **for `list` only**:

```python
def get_queryset(self):
    qs = super().get_queryset()
    if self.request.user.role == 'STUDENT' and self.action == 'list':
        return qs.filter(user=self.request.user)
    return qs
```

If the queryset were filtered on every action, a student fetching another student's ID would get `404` — the object simply wouldn't be in scope, and the object-level permission would never run. Leaving retrieve/update/destroy unfiltered lets `has_object_permission` fire and return the intended `403`.

This pattern has regressed more than once. There are tests covering it; do not "simplify" it away.

### Derived financial values

Neither `StudentFee` nor `TeacherSalary` stores a paid or pending total. Both compute from their payment rows:

```python
@property
def paid_amount(self):
    return self.payments.aggregate(total=Sum('amount'))['total'] or 0

@property
def remaining_amount(self):
    return max(self.net_payable - self.paid_amount, 0)
```

Serializers expose these through `SerializerMethodField`. The consequence: totals cannot drift, and there is no "recalculate balances" maintenance job to forget to run.

### Server-set fields

Any field answering *who did this* or *when* is `read_only` in its serializer and populated in `perform_create`:

```python
def perform_create(self, serializer):
    serializer.save(created_by=self.request.user)
```

Covers `created_by`, `marked_by`, `uploaded_by`, `created_at`, `paid_on`, `receipt_number`.

One subtlety worth knowing, because it caused a 500 error in the past: a `perform_create` must not blindly overwrite a field that Admin is legitimately allowed to choose. Homework gets this right:

```python
def perform_create(self, serializer):
    if self.request.user.role == 'TEACHER':
        serializer.save(teacher=self.request.user.teacher_profile)  # can't spoof another teacher
    else:
        serializer.save()  # Admin's explicit choice stands
```

### Request lifecycle

```
Request
  → CorsMiddleware
  → JWTAuthentication              (resolves request.user from Bearer token)
  → ViewSet.get_permissions()      (role gate — has_permission)
  → ViewSet.get_queryset()         (scoping; list-only filtering)
  → Permission.has_object_permission()   (ownership gate → 403)
  → Serializer validation          (business rules → 400)
  → Model / DB constraints         (unique_together → 400)
  → Response
```

## Frontend

React 19 + Vite 8, React Router 7, Tailwind 4, axios, lucide-react icons.

### Routing

`App.jsx` mounts three protected areas as **layout routes**. `DashboardLayout` renders the sidebar and header, and `<Outlet/>` renders the active page inside it:

```jsx
<Route path="/admin" element={
  <ProtectedRoute allowedRoles={["ADMIN"]}>
    <DashboardLayout />
  </ProtectedRoute>
}>
  <Route index element={<AdminDashboard />} />
  <Route path="students" element={<StudentsList />} />
  <Route path="students/:id" element={<StudentDetail />} />
  …
</Route>
```

`/dashboard` is a redirect hub that sends each role to `/admin`, `/teacher`, or `/student`.

`ProtectedRoute` waits for `AuthContext.loading` before deciding — otherwise a page refresh bounces an authenticated user to `/login` while the token is still being read.

### The API client

`src/api/client.js` is the single axios instance; every page imports it. Two interceptors:

- **Request** — attaches `Authorization: Bearer <access_token>` from `localStorage`.
- **Response** — on `401`, refreshes once and retries. Concurrent 401s queue behind a single in-flight refresh (`isRefreshing` + `failedQueue`) instead of firing N refreshes. If refresh fails, it clears storage and redirects to `/login`. The login and refresh endpoints themselves are excluded, so a bad password can't trigger a refresh loop.

`baseURL` is `/api` — relative. In dev the Vite proxy resolves it. In production it must be pointed at the API host; see [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

### Page conventions

Every data page follows the same shape:

```jsx
const [rows, setRows]       = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState("");

async function load() { /* try / catch / finally */ }

// Handles both paginated {results: []} and bare [] responses:
setRows(Array.isArray(data) ? data : data?.results || []);
```

Write actions open a `<Modal>` containing a form, POST or PATCH, then re-run `load()`. Field-level API errors are flattened into a readable string:

```js
Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
```

Role-dependent controls are gated on `user.role` from `useAuth()`, mirroring the server rule — never replacing it.

Shared components: `Card`, `DataTable` (columns + rows + loading + emptyText), `Modal`, `StatCard`, `DocumentsPanel`, `AddStudentForm`, `AddTeacherForm`.

### Field naming

The frontend uses exact backend field names. It does **not** guess with fallback chains like `student.phone || student.phone_number || student.mobile`. That pattern hid real bugs — fee totals silently rendered as ₹0.00 because every candidate name was wrong. Serializers expose `*_name` companions (`student_name`, `teacher_name`, `session_name`, `school_class_name`, `section_name`, `fee_type`) so pages display labels without extra requests.

## Cross-cutting concerns

**Configuration** — `python-decouple` reads `.env`. `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DB_*`, `CORS_ALLOWED_ORIGINS`, and the optional `PUSH_*` keys.

**API documentation** — `drf-spectacular` generates OpenAPI at `/api/schema/`, Swagger UI at `/api/docs/`, ReDoc at `/api/redoc/`. Schema generation instantiates every serializer and filterset, which makes `python manage.py spectacular` a genuinely useful consistency check — it has caught field-name drift that unit tests missed.

**Pagination** — `PageNumberPagination`, 20 per page. Responses are `{count, next, previous, results}`.

**Notifications** — `apps/announcements/services.py` is a dispatch seam. It always records a `Notification` row; pushing to phones is optional and additive. `dispatch()` never raises, so a misconfigured provider cannot break announcement creation.

**Media** — uploads go to `MEDIA_ROOT`. Django serves them only when `DEBUG=True`; production needs a real file host. This matters on ephemeral-filesystem platforms — see [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

## Testing

29 tests in `apps/accounts/tests.py`, focused on the permission matrix: each role against each resource, both the allowed path and the forbidden one, asserting `403` (not `404`) for cross-user access. Plus `DatabaseStartsEmptyTests`, which guards the no-demo-data rule.

```bash
python manage.py test            # 29 tests
python manage.py spectacular     # consistency check across all serializers
npm run build && npm run lint    # frontend
```
