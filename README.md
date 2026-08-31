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
