# Render Deployment Environment Variables

## Backend Environment Variables (.env in backend/ directory on Render)

# Security
SECRET_KEY=your-secret-key-will-be-generated-by-render
DEBUG=False

# Database (Render will set DATABASE_URL, but individual vars may be needed)
DB_NAME=school_management
DB_USER=postgres_user
DB_PASSWORD=secure-password
DB_HOST=localhost
DB_PORT=5432

# Server Configuration
ALLOWED_HOSTS=your-backend-url.onrender.com,127.0.0.1

# Frontend CORS Configuration
CORS_ALLOWED_ORIGINS=https://your-frontend-url.onrender.com,http://localhost:3000

# Optional: Push Notifications (see docs/NOTIFICATIONS.md)
# PUSH_PROVIDER=fcm
# FCM_PROJECT_ID=your-firebase-project-id
# FCM_SERVICE_ACCOUNT_JSON=/path/to/service-account.json

---

## Frontend Environment Variables (frontend/.env during Render build)

# API Configuration
VITE_API_URL=https://your-backend-url.onrender.com

---

## Setup Instructions for Render Dashboard

### 1. Connect Your Repository
- Go to https://dashboard.render.com
- Click "New +" → "Web Service"
- Connect your GitHub repository
- Select your school-management-system repository

### 2. Backend Service Setup
- **Name:** school-management-backend
- **Environment:** Python 3.11
- **Build Command:** 
  ```
  cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput
  ```
- **Start Command:** 
  ```
  cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
  ```
- **Plan:** Free or Starter
- **Region:** Choose your preferred region

### 3. Set Environment Variables (Backend)
In the Render dashboard, add these environment variables:
- `SECRET_KEY`: Generate a secure key or let Render generate one
- `DEBUG`: `False`
- `ALLOWED_HOSTS`: `school-management-backend.onrender.com`
- `CORS_ALLOWED_ORIGINS`: `https://your-frontend-url.onrender.com`
- `DATABASE_URL`: Will be auto-set by Render when you add PostgreSQL

### 4. Add PostgreSQL Database
- Click "Create" on the Database section
- **Name:** school-management-db
- **Engine:** PostgreSQL
- **Plan:** Free or Starter
- **Version:** 15

### 5. Frontend Service Setup
- Add new Web Service (or use Render's Static Site for frontend only)
- **Name:** school-management-frontend
- **Environment:** Node
- **Build Command:** 
  ```
  npm install && npm run build
  ```
- **Start Command:** 
  ```
  npm run preview
  ```
- **Plan:** Free or Starter
- **Region:** Same as backend (recommended)

### 6. Frontend Environment Variables
- `VITE_API_URL`: `https://school-management-backend.onrender.com`

### 7. Deploy
- Render will automatically deploy when you push to your repository
- Check the deployment logs for any issues

---

## Important Notes

1. **CORS Configuration**: Update CORS_ALLOWED_ORIGINS after getting your Render URLs
2. **Static Files**: WhiteNoise is configured to serve static files efficiently
3. **Media Files**: Media files are stored in the instance's ephemeral filesystem and will be lost on redeploy. Consider using object storage (S3, Cloudinary) for production.
4. **Database**: PostgreSQL instance will be created and connected automatically
5. **Free Plan Limits**: 
   - Services spin down after 15 minutes of inactivity
   - Limited to 0.5 CPU and 512MB RAM
   - Database backups limited

---

## Post-Deployment Steps

1. **Run Migrations**: Already handled in build command
2. **Create Superuser**: SSH into the backend service or run:
   ```
   python manage.py createsuperuser
   ```
3. **Test API**: Visit `https://your-backend-url.onrender.com/api/schema/`
4. **Test Frontend**: Visit `https://your-frontend-url.onrender.com`
