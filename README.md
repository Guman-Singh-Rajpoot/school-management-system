# School Management System

A role-based school administration platform: Django REST Framework API + React (Vite) single-page frontend, backed by PostgreSQL.

Three roles — **Admin**, **Teacher**, **Student** — each see a different dashboard and are restricted by server-side permissions, not just hidden buttons.

## Repository layout

The two halves are nested one level deeper than usual (this came from how the original archives were built):

```
school-management-system/
├── backend/backend/backend/     ← Django project root (manage.py lives here)
│   ├── config/                  settings, urls, wsgi, asgi
│   ├── apps/                    11 feature apps
│   ├── docs/                    NOTIFICATIONS.md, DEPLOYMENT.md
│   ├── media/                   user uploads (dev only)
│   ├── static/  staticfiles/    static assets / collectstatic target
│   └── requirements.txt
│
├── frontend/frontend/frontend/  ← Vite project root (package.json lives here)
│   ├── src/
│   │   ├── api/client.js        axios instance + JWT interceptors
│   │   ├── components/          Card, DataTable, Modal, forms…
│   │   ├── context/             AuthContext, ThemeContext
│   │   ├── layouts/             DashboardLayout (sidebar + header)
│   │   └── pages/               dashboards and feature pages
│   └── vite.config.js
│
├── README.md          ← you are here
├── SPEC.md            what the system is supposed to do
├── ARCHITECTURE.md    how it is put together
├── API.md             endpoint reference
├── CHANGELOG.md       what changed and why
├── CLAUDE.md          working notes for AI assistants / new contributors
├── CONTRIBUTING.md    conventions and workflow
└── DEPLOY_RENDER.md   deploying to Render (incl. dependency changes)
```

When a path in these docs is written as `backend/` or `frontend/`, it means the innermost directory — the one containing `manage.py` or `package.json`.

## Quick start

### 1. Backend

```bash
cd backend/backend/backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — set a real SECRET_KEY and your local Postgres credentials.

createdb school_management        # or create the DB however you prefer
python manage.py migrate
python manage.py test             # optional: 29 permission tests
python manage.py runserver
```

API: `http://localhost:8000/api/` — interactive docs at `http://localhost:8000/api/docs/`.

### 2. Frontend

```bash
cd frontend/frontend/frontend
npm install
npm run dev
```

App: `http://localhost:3000`. Vite proxies `/api` → `http://localhost:8000`, so both must run together.

The port matters: `3000` is what the backend's default `CORS_ALLOWED_ORIGINS` permits. Changing one without the other produces silent CORS failures.

### 3. First admin account

The database starts **completely empty** — no seeded users, no demo records. Create the first admin with Django's own command:

```bash
cd backend/backend/backend
python manage.py createsuperuser
```

A signal in `apps/accounts/signals.py` sets `role=ADMIN` on any superuser, so this account gets full API and dashboard access immediately. Log in at `/login`.

From there Admin creates teachers and students through the UI (*Teachers → Add Teacher*, *Students → Add Student*), each of which provisions the underlying `User` and the profile record in one call.

## Verification status

Last full check, run against a clean checkout:

| Check | Result |
|---|---|
| `manage.py check` | no issues |
| `manage.py makemigrations --check` | no pending changes |
| `manage.py migrate` | applies cleanly from empty DB |
| `manage.py test` | 29/29 pass |
| `manage.py spectacular` | schema generates cleanly |
| `npm run build` | succeeds (~407 KB bundle) |
| `npm run lint` | 0 errors |

## Documentation map

| Question | File |
|---|---|
| What should this system do? | [SPEC.md](SPEC.md) |
| How is it built? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What endpoints exist, with what fields? | [API.md](API.md) |
| What changed recently and why? | [CHANGELOG.md](CHANGELOG.md) |
| How do I deploy it to Render? | [DEPLOY_RENDER.md](DEPLOY_RENDER.md) |
| How do I work on it without breaking things? | [CLAUDE.md](CLAUDE.md), [CONTRIBUTING.md](CONTRIBUTING.md) |
| How do I wire up phone push notifications? | `backend/docs/NOTIFICATIONS.md` |
| How do backups work? | `backend/docs/DEPLOYMENT.md` |
