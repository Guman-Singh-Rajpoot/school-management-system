# 🏫 School Management System

A full-stack School Management System designed to manage students, teachers, attendance, fees, salaries, announcements, documents, and other academic activities from a centralized web application.

The system provides separate access for **Admin, Teacher, and Student** users with role-based permissions.

---

## 🚀 Features

### 👨‍💼 Admin

The Admin has complete control over the school management system.

- 📊 Admin Dashboard
- 👨‍🎓 Manage Students
  - Add students
  - Edit student information
  - Delete students
  - View student details
  - Manage student documents
  - View student attendance
- 👨‍🏫 Manage Teachers
  - Add teachers
  - Edit teacher information
  - Delete teachers
  - View teacher details
  - Manage teacher salary
  - View teacher attendance
- 💰 Fee Management
  - Student total fee
  - Paid amount
  - Pending amount
  - Record fee payments
  - Automatically record payment date and time
- 💵 Teacher Salary Management
  - Teacher salary
  - Paid amount
  - Pending amount
  - Record salary payments
  - Automatically record payment date and time
- 📅 Attendance Management
  - Student attendance
  - Teacher attendance
  - Present/Absent records
  - Attendance history
- 📢 Announcements & Notifications
  - Create announcements
  - Publish important school notices
- 📚 Exams Management
- 📄 Documents Management
- 🏫 Classes & Sections
- 📖 Subjects
- 👥 User Management
- 🔐 Role-based access control

---

### 👨‍🏫 Teacher

Teachers have access to information relevant to their work.

- Teacher Dashboard
- View own profile
- View assigned students/classes
- View student information
- View student attendance
- Manage/view attendance according to permissions
- View salary information
- View announcements
- View academic information

Teachers cannot access or modify Admin-only information.

---

### 👨‍🎓 Student

Students have access to their own academic information.

- Student Dashboard
- View own profile
- View own attendance
- View fee information
- View pending fees
- View announcements
- View exam information
- View timetable
- View available documents

Students cannot access other students' private information.

---

# 🛠️ Technology Stack

## Frontend

- React.js
- React Router
- Axios
- Tailwind CSS
- Lucide React
- Recharts
- Vite

## Backend

- Python
- Django
- Django REST Framework
- Django Simple JWT

## Database

- PostgreSQL

## Authentication

- JWT Authentication
- Role-based access control
- Protected routes

## Development Tools

- VS Code
- Git
- GitHub
- Postman
- Django REST Framework API Docs

---

# 📁 Project Structure

```text
school-management-system/
│
├── backend/
│   │
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env
│   │
│   ├── accounts/
│   ├── students/
│   ├── teachers/
│   ├── attendance/
│   ├── fees/
│   ├── announcements/
│   ├── documents/
│   ├── exams/
│   ├── academics/
│   ├── timetable/
│   └── ...
│
├── frontend/
│   │
│   ├── package.json
│   ├── src/
│   │   │
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   │
│   │   ├── api/
│   │   └── App.jsx
│   │
│   └── ...
│
├── .gitignore
└── README.md

---

# ⚙️ Installation & Setup

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Git

## Local Development

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000` and automatically proxies API requests to `http://localhost:8000/api`.

---

# 🚀 Deployment

## Deploy on Render

This project is configured for easy deployment on [Render](https://render.com), a modern cloud platform.

### Quick Start

1. **Push to GitHub**: Ensure your project is pushed to a GitHub repository
   ```bash
   git push origin main
   ```

2. **Connect to Render**: 
   - Go to [https://dashboard.render.com](https://dashboard.render.com)
   - Click "Create New Service"
   - Connect your GitHub repository

3. **Configure Services**: 
   - Backend API service will be created automatically from `render.yaml`
   - Frontend service will be created automatically
   - PostgreSQL database will be provisioned

### Configuration Files

- **`render.yaml`**: Infrastructure as Code configuration for Render
- **`Procfile`**: Process file for Render (fallback)
- **`RENDER_DEPLOYMENT.md`**: Detailed deployment guide
- **`backend/.env.production.example`**: Production environment template
- **`frontend/.env.production.example`**: Frontend production configuration

### Environment Variables

The `render.yaml` file automatically configures environment variables. You can override them in the Render dashboard if needed.

**Key variables:**
- `SECRET_KEY`: Django secret key (auto-generated)
- `DEBUG`: Set to `False` in production
- `ALLOWED_HOSTS`: Your Render backend URL
- `CORS_ALLOWED_ORIGINS`: Your Render frontend URL
- `VITE_API_URL`: Points to your backend API

### Database

PostgreSQL database is automatically created and configured. Initial migrations run during deployment.

### Static Files

Static files are served using WhiteNoise for efficient production serving.

### For Detailed Deployment Instructions

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for comprehensive step-by-step deployment guide.

---

# 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

# 📧 Contact & Support

For issues, feature requests, or questions, please open an issue on GitHub.
