# Deploying to Render

Everything needed to get this running on Render, in one file. Start with §1 — that is the direct answer to "what dependencies have to change".

The app deploys as **three Render services**:

| Service | Type | What it runs |
|---|---|---|
| `school-db` | PostgreSQL | The database |
| `school-api` | Web Service | Django + Gunicorn |
| `school-web` | Static Site | The built React SPA |

---

## 1. Dependency changes

### 1.1 Add to `backend/backend/backend/requirements.txt`

Three packages. None of them are optional — the app will not deploy without them.

```diff
  Django==5.0.6
  djangorestframework==3.15.1
  djangorestframework-simplejwt==5.3.1
  django-cors-headers==4.3.1
  django-filter==24.2
  psycopg2-binary==2.9.9
  drf-spectacular==0.27.2
  Pillow==10.4.0
  python-decouple==3.8
  django-extensions==3.2.3
  openpyxl==3.1.2
  reportlab==4.2.0
  qrcode==7.4.2
+
+ # --- Production server / deployment ---
+ gunicorn==22.0.0
+ whitenoise==6.7.0
+ dj-database-url==2.2.0
```

| Package | Why it is required |
|---|---|
| `gunicorn` | Render runs your start command directly. `manage.py runserver` is a development server and must never face the internet. Gunicorn is the WSGI server that actually serves requests. |
| `whitenoise` | Render does not serve Django's static files for you. Without this, `/admin/` renders unstyled and `/api/docs/` (Swagger UI) is broken, because their CSS and JS never load. |
| `dj-database-url` | Render Postgres hands you a single `DATABASE_URL` connection string. The current settings expect five separate `DB_*` variables. This parses the one into the other. |

### 1.2 Already correct — do not change

- **`psycopg2-binary`** — already present and is the right choice. Do not swap to plain `psycopg2`; that needs build toolchain and PostgreSQL headers at install time.
- **`Pillow`** — needed for `ImageField` uploads. Keep.
- **`reportlab`, `openpyxl`, `qrcode`** — used by document generation. Keep.
- **`python-decouple`** — reads environment variables. Works identically on Render, where env vars come from the dashboard rather than a `.env` file. Keep.

### 1.3 Optional

- **`django-extensions`** is a development convenience (`shell_plus`, `graph_models`). Harmless in production, and it is in `INSTALLED_APPS`, so if you remove it from requirements you must also remove it from settings or the app will fail to boot. Simplest is to leave it.

### 1.4 Pin the Python version

Add `backend/backend/backend/runtime.txt`:

```
python-3.12.4
```

Without this Render picks a default that can change under you between deploys. Django 5.0 supports Python 3.10–3.12.

### 1.5 Frontend

**No dependency changes.** The existing `package.json` builds cleanly as-is. Just pin the Node version by setting the `NODE_VERSION` environment variable on the static site to `22`.

One code change is needed in the frontend, but it is not a dependency — see §3.

---

## 2. Backend code changes

### 2.1 `config/settings.py`

Five edits. Each one is load-bearing.

**a. Database — read `DATABASE_URL` when present**

```python
import dj_database_url

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='school_management'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# Render supplies a single DATABASE_URL. When it is set, it wins.
# Local development keeps using the DB_* variables above unchanged.
DATABASE_URL = config('DATABASE_URL', default=None)
if DATABASE_URL:
    DATABASES['default'] = dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        ssl_require=True,
    )
```

Written this way, local setup is untouched — no `DATABASE_URL`, no change in behaviour.

**b. WhiteNoise middleware** — must sit directly after `SecurityMiddleware`:

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',      # ← add
    'django.contrib.sessions.middleware.SessionMiddleware',
    ...
]
```

**c. Static file storage** (Django 5 style):

```python
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
```

**d. Allowed hosts, CSRF, and HTTPS awareness:**

```python
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Render injects the service's public hostname.
RENDER_EXTERNAL_HOSTNAME = config('RENDER_EXTERNAL_HOSTNAME', default=None)
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=Csv(),
)

# Render terminates TLS at its proxy; without this Django thinks every
# request is plain HTTP and will redirect-loop once SSL redirect is on.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
```

**e. CORS** — no code change, but the env var must name your frontend origin (§4).

### 2.2 Media uploads — read this before going live

**Render's filesystem is ephemeral. Every uploaded file is deleted on redeploy and on restart.**

This app has real uploads — student documents, teacher documents, exam calendar files. On the default setup they will silently vanish. There is also a second problem: `config/urls.py` only serves media when `DEBUG=True`, so in production uploaded files are not reachable at all.

Three options:

| Option | Trade-off |
|---|---|
| **Render Persistent Disk** | Simplest. Attach a disk, mount at `/opt/render/project/src/media`, set `MEDIA_ROOT` to it. Costs money; pins you to a single instance (no horizontal scaling). |
| **S3 / Cloudflare R2** (recommended) | Add `django-storages[s3]==1.14.4`, point the `default` storage backend at the bucket. Survives redeploys, scales, serves files directly. |
| **Ignore it** | Only acceptable if you genuinely never upload files. Given the documents feature, you probably do. |

For S3, add to requirements:

```
django-storages[s3]==1.14.4
```

and set the `default` entry in `STORAGES` to `storages.backends.s3.S3Storage` with the usual `AWS_*` env vars.

I would not treat this as optional polish — losing parents' uploaded certificates on a routine redeploy is the kind of bug that is discovered far too late.

---

## 3. Frontend code change

`src/api/client.js` currently has:

```js
const api = axios.create({ baseURL: "/api", ... });
```

A relative `/api` works in development because Vite proxies it. On Render the SPA is served from a *different host* than the API, so `/api/students/` would hit the static site and return the HTML index page instead of JSON.

Change it to:

```js
const api = axios.create({
  // In dev this is undefined, so it falls back to "/api" and the Vite proxy handles it.
  // In production Render injects VITE_API_URL at build time.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});
```

Then set `VITE_API_URL=https://school-api.onrender.com/api` on the static site (§4). Vite inlines `import.meta.env.*` **at build time**, so changing this variable requires a rebuild, not just a restart.

### SPA routing rewrite

React Router owns paths like `/admin/students`. A hard refresh on that URL asks Render for a file that does not exist → 404. Add a rewrite rule on the static site:

- **Source** `/*` → **Destination** `/index.html` → **Action** Rewrite

Without this, the app works until a user refreshes or opens a deep link.

---

## 4. Creating the services

### 4.1 PostgreSQL

New → PostgreSQL. Name `school-db`. Note the **Internal Database URL** — use the internal one; it is faster and does not leave Render's network.

### 4.2 Web Service (backend)

New → Web Service, connected to your repo.

| Setting | Value |
|---|---|
| Root Directory | `backend/backend/backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate` |
| Start Command | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` |

The Root Directory is the triple-nested path — the directory containing `manage.py`. Getting this wrong is the most common first-deploy failure.

Environment variables:

| Key | Value |
|---|---|
| `SECRET_KEY` | Generate a fresh one. Never reuse the development key. |
| `DEBUG` | `False` |
| `DATABASE_URL` | Internal Database URL from `school-db` |
| `ALLOWED_HOSTS` | `school-api.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://school-web.onrender.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://school-web.onrender.com` |
| `PYTHON_VERSION` | `3.12.4` (if not using `runtime.txt`) |

Generate a secret key with:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4.3 Static Site (frontend)

New → Static Site, same repo.

| Setting | Value |
|---|---|
| Root Directory | `frontend/frontend/frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

Environment variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://school-api.onrender.com/api` |
| `NODE_VERSION` | `22` |

Plus the `/*` → `/index.html` rewrite from §3.

### 4.4 First admin account

The database deploys empty by design. Open the backend service's **Shell** tab:

```bash
python manage.py createsuperuser
```

The `accounts` signal sets `role=ADMIN` on superusers automatically, so this account has full access immediately.

---

## 5. Optional: `render.yaml`

Committing this at the repository root lets Render provision all three services as a Blueprint instead of clicking through the dashboard.

```yaml
databases:
  - name: school-db
    databaseName: school_management
    user: school_admin
    plan: free

services:
  - type: web
    name: school-api
    runtime: python
    rootDir: backend/backend/backend
    plan: free
    buildCommand: "pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate"
    startCommand: "gunicorn config.wsgi:application --bind 0.0.0.0:$PORT"
    envVars:
      - key: SECRET_KEY
        generateValue: true
      - key: DEBUG
        value: "False"
      - key: PYTHON_VERSION
        value: "3.12.4"
      - key: DATABASE_URL
        fromDatabase:
          name: school-db
          property: connectionString
      - key: ALLOWED_HOSTS
        value: school-api.onrender.com
      - key: CORS_ALLOWED_ORIGINS
        value: https://school-web.onrender.com
      - key: CSRF_TRUSTED_ORIGINS
        value: https://school-web.onrender.com

  - type: web
    name: school-web
    runtime: static
    rootDir: frontend/frontend/frontend
    buildCommand: "npm ci && npm run build"
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        value: https://school-api.onrender.com/api
      - key: NODE_VERSION
        value: "22"
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

The service names in the URLs must match the names above. If Render assigns a suffixed hostname, update the values to match what it actually issues.

---

## 6. Verifying the deploy

```bash
# 1. API is up and auth is enforced
curl -i https://school-api.onrender.com/api/students/
# expect 401 {"detail":"Authentication credentials were not provided."}

# 2. Login works
curl -X POST https://school-api.onrender.com/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your password>"}'
# expect access + refresh + user

# 3. Authenticated read works
curl https://school-api.onrender.com/api/students/ \
  -H "Authorization: Bearer <access>"
# expect {"count":0,...} on a fresh database
```

Then in a browser:

- `https://school-api.onrender.com/api/docs/` — Swagger UI should be **styled**. Unstyled means WhiteNoise or `collectstatic` is misconfigured.
- `https://school-web.onrender.com/login` — log in, then hard-refresh on `/admin/students`. A 404 means the SPA rewrite is missing.
- Check the browser console for CORS errors — those mean `CORS_ALLOWED_ORIGINS` does not exactly match the frontend origin (scheme included).

---

## 7. Troubleshooting

| Symptom | Cause |
|---|---|
| Build: `ModuleNotFoundError: No module named 'config'` | Root Directory is wrong. It must be the triple-nested path containing `manage.py`. |
| Build fails on `collectstatic` | `whitenoise` missing from requirements, or `STORAGES` not configured. |
| `DisallowedHost` | The Render hostname is not in `ALLOWED_HOSTS`. |
| `/api/docs/` loads but is unstyled | WhiteNoise middleware missing or in the wrong position. |
| Frontend loads, all API calls 404 and return HTML | `VITE_API_URL` not set at build time, so `baseURL` is still relative `/api`. |
| API calls blocked by CORS | `CORS_ALLOWED_ORIGINS` mismatch. Must include the scheme and no trailing slash. |
| Login works, refresh 500s | `rest_framework_simplejwt.token_blacklist` missing from `INSTALLED_APPS`, or its migrations did not run. |
| Deep links 404 on refresh | SPA rewrite rule missing. |
| Redirect loop after enabling SSL redirect | `SECURE_PROXY_SSL_HEADER` not set. |
| Uploaded files disappear | Ephemeral filesystem. See §2.2. |
| First request after idle takes ~50s | Render's free tier spins services down. Expected; upgrade the plan to avoid it. |

---

## 8. Free-tier caveats

- Services sleep after inactivity; the next request pays a cold start of roughly a minute.
- Free PostgreSQL instances expire after 90 days. Back up (`backend/docs/DEPLOYMENT.md`) or upgrade before then.
- The filesystem is ephemeral regardless of plan unless you attach a disk.

None of these block a demo or a pilot. They do make free tier a poor fit for a school actually depending on the system day to day.
