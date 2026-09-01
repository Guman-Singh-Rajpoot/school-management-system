# 🔗 Connecting to Render PostgreSQL Database

Since you've already created a PostgreSQL database in Render, follow these steps to connect your backend service to it.

## Step 1: Get Your Database Connection String

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your PostgreSQL database instance
3. Under **Connections**, copy the **Internal Database URL**
4. This will look like:
   ```
   postgresql://username:password@dpg-xxxx-a.oregon-postgres.render.com:5432/school_management
   ```

## Step 2: Connect Backend Service to Database

1. Go to your **school-management-backend** service
2. Click **Environment**
3. Add or update these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Paste your full connection string from Step 1 | Use the Internal URL for Render-to-Render communication |
| `DB_NAME` | `school_management` | Extract from your DATABASE_URL |
| `DB_USER` | Your database username | Usually `postgres` or your custom username |
| `DB_PASSWORD` | Your database password | From Render dashboard |
| `DB_HOST` | Your database host | Extract from connection string (e.g., `dpg-xxxx.render.com`) |
| `DB_PORT` | `5432` | Default PostgreSQL port |

## Step 3: Verify Connection

1. Go back to your backend service
2. Click **Logs** to see deployment logs
3. Look for these messages (indicating successful migration):
   ```
   Running migrations...
   Applying auth.0001_initial...
   Applying accounts.0001_initial...
   ```

## Step 4: Test Connection

Once deployed, test your API:

```bash
curl https://<your-backend-url>/api/schema/
```

You should receive a 200 response with the API schema.

## Troubleshooting

### "Connection refused" errors
- Verify you're using the **Internal Database URL** (not the external one)
- Check that all environment variables are set correctly
- Make sure the database is not in "standby" mode

### "FATAL: remaining connection slots are reserved"
- Your free tier database has limited connections
- Stop/delete unused services that might be holding connections
- Consider upgrading to a paid plan

### "Permission denied" errors
- Verify `DB_USER` and `DB_PASSWORD` match your Render database credentials
- Check that the user has proper permissions on the database

## Important Notes

- ✅ Use **Internal URL** for backend-to-database communication within Render
- ❌ Do NOT use the External URL for production (higher latency, uses public internet)
- The database connection is automatically used for Django ORM queries
- Migrations run automatically during deployment

## Manual Database Operations

If needed, you can SSH into your backend service and run:

```bash
python manage.py dbshell  # Connect to database directly
python manage.py migrate  # Run migrations manually
python manage.py createsuperuser  # Create admin user
```
