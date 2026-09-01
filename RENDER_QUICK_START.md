# 🚀 Quick Render Deployment Guide

This guide walks you through deploying the School Management System to Render in minutes.

## Prerequisites

- GitHub account with your repository
- Render account (free tier available at https://render.com)

## Step 1: Prepare Your Repository

Make sure all changes are committed and pushed to GitHub:

```bash
git add .
git commit -m "Setup for Render deployment"
git push origin main
```

## Step 2: Connect to Render

1. Go to https://dashboard.render.com
2. Click "New +" button
3. Select "Web Service"
4. Click "Connect account" and authorize GitHub
5. Select your `school-management-system` repository

## Step 3: Configure Backend Service

When prompted to create a new service:

- **Name**: `school-management-backend`
- **Environment**: Python 3.11
- **Region**: Choose your preferred region
- **Branch**: main
- **Build Command**: `cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`
- **Start Command**: `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- **Plan**: Free or higher

## Step 4: Add Environment Variables (Backend)

In the service settings, add these environment variables:

| Key | Value |
|-----|-------|
| `SECRET_KEY` | (Leave empty - Render will generate) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `*.onrender.com,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | `https://<your-frontend-url>` |
| `PYTHON_VERSION` | `3.11` |
| `DATABASE_URL` | Your database connection string (add in Step 5) |
| `DB_NAME` | Your database name |
| `DB_USER` | Your database username |
| `DB_PASSWORD` | Your database password |
| `DB_HOST` | Your database host |
| `DB_PORT` | `5432` |

## Step 5: Connect Existing PostgreSQL Database

Since you've already created a separate database in Render:

1. From your Render dashboard, go to your PostgreSQL database instance
2. Copy the **Internal Database URL** (starts with `postgresql://`)
3. Go back to your backend service settings
4. Add/Update these environment variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your internal database URL from step 2 |
| `DB_NAME` | `school_management` (or your actual DB name) |
| `DB_USER` | Your database username |
| `DB_PASSWORD` | Your database password |
| `DB_HOST` | Your database host (internal address) |
| `DB_PORT` | `5432` |

**Example DATABASE_URL:**
```
postgresql://username:password@dpg-xxxx-a.oregon-postgres.render.com:5432/school_management
```

## Step 6: Create Frontend Service

1. Go to dashboard and click "New +"
2. Select "Static Site"
3. Connect to your GitHub repository again
4. Configure:
   - **Name**: `school-management-frontend`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish directory**: `frontend/dist`
   - **Plan**: Free

## Step 7: Add Frontend Environment Variables

Add this environment variable to the frontend service:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://<your-backend-url>` |

Replace `<your-backend-url>` with your actual Render backend URL (format: `service-name.onrender.com`).

## Step 8: Deploy

1. Both services will automatically deploy
2. Check the deployment logs for any errors
3. Once successful, your services will be live!

## Step 9: Create Superuser (Admin Account)

To access the admin panel:

1. Go to your backend service dashboard on Render
2. Click "Shell" in the service menu
3. Run: `python manage.py createsuperuser`
4. Follow the prompts to create your admin account
5. Visit `https://<your-backend-url>/admin/` to access the admin panel

## Important URLs

Once deployed:

- **Frontend**: `https://school-management-frontend.onrender.com`
- **Backend API**: `https://school-management-backend.onrender.com`
- **API Documentation**: `https://<backend-url>/api/schema/`
- **Admin Panel**: `https://<backend-url>/admin/`

## Troubleshooting

### Backend fails to build
- Check the build logs in Render dashboard
- Ensure `backend/requirements.txt` has all dependencies
- Verify Python version is 3.11

### Frontend shows 404 errors
- Ensure `VITE_API_URL` points to your backend URL
- Check that CORS is properly configured on the backend
- Clear browser cache

### Database migration errors
- The migrations run automatically during deployment
- If needed, SSH into the backend and run: `python manage.py migrate`

### CORS errors
- Update `CORS_ALLOWED_ORIGINS` environment variable
- Must include your frontend's full URL (with https://)

## Updating Your Application

After making changes:

1. Commit to GitHub:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. Render will automatically redeploy both services

## Free Tier Limitations

- Services spin down after 15 minutes of inactivity (automatic restart on next request)
- Limited to 0.5 CPU and 512MB RAM
- Suitable for testing and low-traffic applications
- Upgrade to Pro plan for production use

## Next Steps

- Customize your deployment in `render.yaml`
- Set up custom domains
- Configure email notifications
- Enable push notifications (see `docs/NOTIFICATIONS.md`)
- Set up CI/CD pipeline for automated tests

## Support

For issues:
- Check Render dashboard logs
- Review `RENDER_DEPLOYMENT.md` for detailed configuration
- Check Django/DRF documentation
- Review React/Vite documentation

Happy deploying! 🎉
