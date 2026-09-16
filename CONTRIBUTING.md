# Contributing

## Setup

See the Quick start in [README.md](README.md). You need Python 3.12, Node 22, and a local PostgreSQL.

Both servers must run together — the frontend proxies `/api` to the backend, so the frontend alone shows nothing but errors.

## Workflow

1. Read [SPEC.md](SPEC.md) if you are unsure whether something is a bug or intended.
2. Make the change.
3. Verify (below) — including a live request, not just green tests.
4. Update the affected docs in the same change, not later.
5. Add a `CHANGELOG.md` entry describing *what was wrong*, not just what you touched.

## Verification

Nothing is done until all of these pass:

```bash
# Backend — from backend/backend/backend/
python manage.py check
python manage.py makemigrations --check    # should say "No changes detected"
python manage.py test                      # 29 tests
python manage.py spectacular --file /tmp/schema.yaml

# Frontend — from frontend/frontend/frontend/
npm run build
npm run lint
```

Plus a live request exercising the flow you changed:

```bash
ACCESS=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access'])")

curl -s http://127.0.0.1:8000/api/students/ -H "Authorization: Bearer $ACCESS"
```

This matters more than it sounds. Several bugs in this codebase passed every static check while the feature was completely broken — a page calling an endpoint that did not exist, a serializer omitting the primary key, fee totals rendering as zero. Static checks confirm the code *runs*; only a real request confirms it *works*.

### Why `spectacular` earns its place

It instantiates every serializer and filterset. It has caught field references to renamed model fields that the test suite walked straight past. Run it after touching any model, serializer, or viewset.

## Conventions

### Backend

- Permission classes live in `apps/accounts/permissions.py`. Do not scatter ad-hoc checks through views.
- Owner-scoped viewsets filter the queryset **for `list` only** — see the 403-vs-404 note in [CLAUDE.md](CLAUDE.md).
- Server-set fields (`created_by`, `marked_by`, `uploaded_by`, timestamps, receipt numbers) go in `read_only_fields` and are populated in `perform_create`.
- Derived money values are properties over payment rows. Do not add stored balance columns.
- Business rules belong in serializer `validate_*` methods, not in views.

### Frontend

- All requests go through `src/api/client.js`. A bare `fetch` or a second axios instance loses the JWT interceptor and the refresh queue.
- Use exact backend field names. No `a ?? b ?? c` fallback chains — if you do not know the field, go look.
- Internal links use React Router `<Link>` / `navigate()`, never `<a href>`.
- Reuse `Card`, `DataTable`, `Modal`, `StatCard`, `DocumentsPanel`.
- Role-dependent UI reads `user.role` from `useAuth()` — mirroring the server rule, never substituting for it.

### Both

- **No demo data.** No fixtures, no seeds, no hardcoded rows or charts. Real data or an honest empty state.
- Do not add navigation to a page that does not exist.

## Migrations

```bash
python manage.py makemigrations
python manage.py makemigrations --check --dry-run   # confirm nothing left over
```

Before deleting a migration, check who depends on it:

```bash
grep -rn "'<app>', '000" apps/*/migrations/*.py
```

Deleting a migration that others reference breaks the graph. Deleting one that a live database has already applied breaks that database — and no code change fixes it afterwards. If you are unsure whether a database has real data in it, ask before doing anything destructive.

## Tests

`apps/accounts/tests.py` holds the permission matrix: each role against each resource, both the permitted path and the forbidden one. Cross-user access must assert `403`, not `404`.

New endpoint → add tests for all three roles, including the denials. The denial tests are the ones that catch regressions; the happy path rarely breaks quietly.

## Commit messages

State the problem, not just the file:

```
Fix teacher attendance calling a nonexistent endpoint

TeacherAttendance.jsx posted to /teacher-attendance/, which was never
routed. The page appeared to work but every save failed silently.
Pointed at /api/teachers/attendance/.
```

## Reporting bugs

Include the request (method, path, body), the response (status and body), the role you were acting as, and whether it reproduces via `curl`. A `403` where you expected `200` is a permissions question; a `400` is a serializer question; a `404` usually means a wrong URL. Knowing which narrows it immediately.
