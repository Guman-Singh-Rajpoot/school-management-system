import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import { ThemeProvider } from "./context/ThemeContext";
import DashboardLayout from "./layouts/DashboardLayout";

// ============================================================
// DASHBOARD PAGES
// ============================================================

import Login from "./pages/Login";
import OwnerRegister from "./pages/OwnerRegister";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";

// Examination pages
import ExaminationsList from "./pages/ExaminationsList";
import ExamCreate from "./pages/ExamCreate";
import ExamDetail from "./pages/ExamDetail";

// Marks pages
import MarksList from "./pages/MarksList";
import MarkCreate from "./pages/MarkCreate";
import ReportCard from "./pages/ReportCard";

// Document pages
import DocumentsList from "./pages/DocumentsList";

// Homework pages
import HomeworkList from "./pages/HomeworkList";
import HomeworkCreate from "./pages/HomeworkCreate";

// Timetable pages
import TimetableList from "./pages/TimetableList";

// ============================================================
// STUDENT PAGES
// ============================================================

import StudentsList from "./pages/StudentsList";
import StudentDetail from "./pages/StudentDetail";

// ============================================================
// TEACHER PAGES
// ============================================================

import TeachersList from "./pages/TeachersList";
import TeacherDetail from "./pages/TeacherDetail";
import TeacherAttendance from "./pages/TeacherAttendance";
import TeacherSalary from "./pages/TeacherSalary";

// ============================================================
// OTHER PAGES
// ============================================================

import Attendance from "./pages/Attendance";
import Fees from "./pages/Fees";
import FeeStructures from "./pages/FeeStructures";
import Announcements from "./pages/Announcements";
import Classes from "./pages/Classes";
import WhatsAppSettings from "./pages/WhatsAppSettings";


// ============================================================
// PROTECTED ROUTE
// ============================================================

function ProtectedRoute({ children, allowedRoles }) {
  const {
    user,
    isAuthenticated,
    loading,
  } = useAuth();

  // Authentication is still loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">
          Loading...
        </div>
      </div>
    );
  }

  // User is not logged in
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Force password change if the account uses a temporary password
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  // Normalize role
  const userRole = String(
    user?.role || ""
  ).toUpperCase();

  // Check role
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(userRole)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  // Force password change on temporary password
  if (user?.must_change_password) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  return children;
}


// ============================================================
// DASHBOARD REDIRECT
// ============================================================

function DashboardRedirect() {
  const {
    user,
    isAuthenticated,
  } = useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Force password change on temporary password
  if (user?.must_change_password) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  const role = String(
    user?.role || ""
  ).toUpperCase();

  // ADMIN
 // ADMIN and SCHOOL OWNER
  if (role === "ADMIN" || role === "OWNER") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }
  // TEACHER
  if (role === "TEACHER") {
    return (
      <Navigate
        to="/teacher"
        replace
      />
    );
  }

  // STUDENT
  if (role === "STUDENT") {
    return (
      <Navigate
        to="/student"
        replace
      />
    );
  }

  return (
    <Navigate
      to="/login"
      replace
    />
  );
}


// ============================================================
// CHANGE PASSWORD ROUTE
// ============================================================

function ChangePasswordRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <ChangePassword />;
}


// ============================================================
// APP ROUTES
// ============================================================

function AppRoutes() {
  return (
    <Routes>

      {/* ======================================================
          LOGIN & RECOVERY
      ====================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />
      <Route
        path="/change-password"
        element={<ChangePasswordRoute />}
      />
      {/* Public self-registration route */}
      <Route path="/owner-register" element={<OwnerRegister />} />
      <Route path="/register-school" element={<OwnerRegister />} />



      {/* ======================================================
          DASHBOARD
      ====================================================== */}

      <Route
        path="/dashboard"
        element={<DashboardRedirect />}
      />


      {/* ======================================================
          ADMIN AREA
          Everything under /admin shares the sidebar/header chrome
          from DashboardLayout.
      ====================================================== */}

<Route
        path="/admin"
        element={
         <ProtectedRoute allowedRoles={["ADMIN", "OWNER"]}>
              <DashboardLayout />
            </ProtectedRoute>
        }>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsList />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="teachers" element={<TeachersList />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="teacher-attendance" element={<TeacherAttendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="fee-structures" element={<FeeStructures />} />
        <Route path="salaries" element={<TeacherSalary />} />
        <Route path="classes" element={<Classes />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="whatsapp" element={<WhatsAppSettings />} />
        <Route path="examinations" element={<ExaminationsList />} />
        <Route path="examinations/create" element={<ExamCreate />} />
        <Route path="examinations/:id" element={<ExamDetail />} />
        <Route path="marks" element={<MarksList />} />
        <Route path="report-cards" element={<ReportCard />} />
        <Route path="documents" element={<DocumentsList />} />
        <Route path="homework" element={<HomeworkList />} />
        <Route path="homework/create" element={<HomeworkCreate />} />
        <Route path="timetable" element={<TimetableList />} />
        <Route path="fee-payments" element={<Fees />} />
      </Route>


      {/* ======================================================
          TEACHER AREA
      ====================================================== */}

      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={["TEACHER"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="salary" element={<TeacherSalary />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="announcements" element={<Announcements />} />
      </Route>


      {/* ======================================================
          STUDENT AREA
      ====================================================== */}

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="announcements" element={<Announcements />} />
      </Route>


      {/* ======================================================
          ROOT
      ====================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />


      {/* ======================================================
          404
      ====================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

    </Routes>
  );
}


// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
