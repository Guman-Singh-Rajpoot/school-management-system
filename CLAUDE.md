# CLAUDE.md

Working notes for Claude Code (and any new contributor) on this repository. Read this before changing anything.

## What this is

Django REST Framework API + React (Vite) SPA + PostgreSQL. A school management system with three roles — Admin, Teacher, Student — where **all access control is enforced server-side**.

Paths are nested one level deeper than usual:

- Backend project root (contains `manage.py`): `backend/backend/backend/`
- Frontend project root (contains `package.json`): `frontend/frontend/frontend/`

That is not a typo and not something to "fix" — the deployment config depends on those paths.

## Commands

```bash
# Backend — from backend/backend/backend/
python manage.py check                      # config sanity
python manage.py makemigrations --check     # detect drift without writing
python manage.py migrate
python manage.py test                       # 29 permission tests
python manage.py spectacular --file /tmp/schema.yaml   # see below — this is the good one
python manage.py runserver

# Frontend — from frontend/frontend/frontend/
npm install
npm run dev      # port 3000, proxies /api to :8000
npm run build
npm run lint
```

### `spectacular` is the highest-value check

`python manage.py spectacular` instantiates **every serializer and filterset in the project**. It has caught field-name drift that the unit tests missed — references to renamed model fields in `announcements` and `documents`, for example. Run it after any serializer, viewset, or model change. Two "APIView has no serializer" notices are expected and harmless.

## Ground rules

### 1. No fake data. Ever.

No fixtures, no seed commands, no demo users, no sample students, no hardcoded chart data in React. `DatabaseStartsEmptyTests` enforces this on the backend. A hardcoded weekly-attendance chart was previously shipped in `AdminDashboard.jsx` and had to be removed — do not reintroduce that pattern. Pages render real API data or an honest empty state.

### 2. Never guess field names

Do not write fallback chains:

```js
// Wrong — and this exact pattern silently rendered ₹0.00 for months
const total = fee.total_amount ?? fee.totalAmount ?? fee.amount ?? 0;
```

Check the actual serializer, or hit the running API, and use the one real name. If a label is needed, add an explicit `*_name` field to the serializer rather than guessing client-side.

Names that have specifically caused bugs:

| Correct | Commonly mis-typed as |
|---|---|
| `Section.class_room` | `school_class` |
| `Subject.school_class` | `class_room` |
| `Announcement.message` | `body` |
| `Announcement.class_room` | `school_class` |
| `GeneratedDocument.document_type` | `doc_type` |
| `GeneratedDocument.uploaded_by` | `generated_by` |
| `Payment.method` | `payment_type` |
| `Payment.created_by` | `recorded_by` |
| `TimetableSlot.day_of_week` is an **int 0–6** | `"MON"` |

### 3. Permissions are server-side

Hiding a button in React is UX, not security. Every restriction needs a DRF permission class. Assume someone will hit the API directly with a valid token for a different account.

### 4. The 403-vs-404 pattern — do not "simplify" it

Owner-scoped viewsets filter the queryset **for `list` only**:

```python
def get_queryset(self):
    qs = super().get_queryset()
    if self.request.user.role == 'STUDENT' and self.action == 'list':
        return qs.filter(user=self.request.user)
    return qs
```

Filtering on every action makes a cross-user fetch return `404` — the object falls out of scope before `has_object_permission` runs, so the intended `403` never happens. This has regressed more than once. Tests cover it.

### 5. `perform_create` must not clobber legitimate Admin choices

```python
def perform_create(self, serializer):
    if self.request.user.role == 'TEACHER':
        serializer.save(teacher=self.request.user.teacher_profile)  # can't spoof
    else:
        serializer.save()  # Admin picked a teacher; honour it
```

The naive version — always overwriting `teacher` — produced a 500 IntegrityError whenever Admin created homework, because Admin has no `teacher_profile`.

### 6. Server-set fields stay read-only

`created_at`, `created_by`, `marked_by`, `uploaded_by`, `receipt_number`, `paid_on` are set in `perform_create` and listed in `read_only_fields`. Never accept them from the client — the audit trail is the whole point.

### 7. Money is derived, never stored

`paid_amount` and `remaining_amount` are properties aggregating over payment rows. Do not add stored balance columns; they will drift.

### 8. Migrations

Do not delete migrations casually. If you must, check for dependents first:

```bash
grep -rn "'<app>', '000" apps/*/migrations/*.py
```

Deleting a migration that others depend on breaks the graph, and breaks any database that already applied it. If a database already has old migrations applied, deleting files is not a fix — ask before touching anything destructive.

## Verifying a change

Static checks pass easily while the app is still broken. Prefer live verification.

```bash
# Start the server, then exercise the real flow:
ACCESS=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access'])")

curl -s http://127.0.0.1:8000/api/students/ -H "Authorization: Bearer $ACCESS"
```

Full check before calling something done:

1. `manage.py check`
2. `manage.py makemigrations --check`
3. `manage.py test`
4. `manage.py spectacular`
5. Live curl of the specific flow you changed
6. `npm run build && npm run lint` if frontend touched

Sandbox note: backgrounding the dev server and then curling from a *separate* `bash` call does not work — the process does not persist. Start the server and run the curls **in the same command**.

## Frontend conventions

Every data page:

```jsx
const [rows, setRows]       = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState("");

// Handle paginated and bare responses alike:
setRows(Array.isArray(data) ? data : data?.results || []);
```

Write actions open a `<Modal>`, POST or PATCH, then re-run the loader. Flatten API errors readably:

```js
Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
```

Use existing components — `Card`, `DataTable`, `Modal`, `StatCard`, `DocumentsPanel` — rather than new one-off markup. All API calls go through `src/api/client.js`; never a bare `fetch` or a second axios instance, or you lose the JWT interceptor and the refresh queue.

Internal navigation uses React Router `<Link>` / `navigate()`, never `<a href>` — a raw anchor forces a full reload and drops SPA state.

Do not add a nav link for a page that does not exist. Dead links are worse than a visibly incomplete menu.

## Where things live

| Looking for | Path |
|---|---|
| All permission classes | `apps/accounts/permissions.py` |
| Permission tests | `apps/accounts/tests.py` |
| Settings, env vars | `config/settings.py` |
| URL routing | `config/urls.py` + each app's `urls.py` |
| axios client, JWT refresh | `frontend/src/api/client.js` |
| Routing, role areas | `frontend/src/App.jsx` |
| Sidebar, header, nav | `frontend/src/layouts/DashboardLayout.jsx` |

## Documentation

- `SPEC.md` — intended behaviour; settles "bug or by design"
- `ARCHITECTURE.md` — how it fits together and why
- `API.md` — endpoints and fields
- `CHANGELOG.md` — what changed and why
- `DEPLOY_RENDER.md` — deployment, including required dependency changes

Keep these current. A stale `API.md` is worse than none, because it gets trusted. When they disagree with the code, the code wins — then fix the doc.

## Not yet built

No UI for Exams, Marks entry, Documents browser, Homework, or Timetable. The APIs are live and tested; the screens are missing. Build them against real fields — check the serializer first, hit the running API second, write the page third.
