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
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";

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
import Announcements from "./pages/Announcements";
import Classes from "./pages/Classes";


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

  const role = String(
    user?.role || ""
  ).toUpperCase();

  // ADMIN
  if (role === "ADMIN") {
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
// APP ROUTES
// ============================================================

function AppRoutes() {
  return (
    <Routes>

      {/* ======================================================
          LOGIN
      ====================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />


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
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsList />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="teachers" element={<TeachersList />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="teacher-attendance" element={<TeacherAttendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="salaries" element={<TeacherSalary />} />
        <Route path="classes" element={<Classes />} />
        <Route path="announcements" element={<Announcements />} />
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
