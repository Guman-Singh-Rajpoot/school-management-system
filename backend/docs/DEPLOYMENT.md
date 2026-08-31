# Deployment notes

## Environment

Set these in production (see `.env.example` for the full list):

```
DEBUG=False
SECRET_KEY=<a long random value>
ALLOWED_HOSTS=yourdomain.com
DB_NAME=... DB_USER=... DB_PASSWORD=... DB_HOST=... DB_PORT=...
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

Run `python manage.py migrate` and `python manage.py collectstatic` as part
of your deploy, and serve `staticfiles/` and `media/` from your web
server/CDN rather than Django.

## Database backups

The `BackupRecord` model (`/api/documents/backups/`, Admin-only) stores
**metadata** about backups -- who triggered one, when, and whether it
succeeded -- so the admin dashboard can show backup history. It does not
run `pg_dump` itself.

A simple way to actually produce backups on a Postgres host:

```bash
pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%F).dump
```

Run that on a cron job (or your platform's scheduled task feature), upload
the resulting file wherever you keep backups, and optionally POST a
`BackupRecord` to `/api/documents/backups/` with the outcome so it shows
up in the dashboard.

To restore:

```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean backup_2026-08-29.dump
```
