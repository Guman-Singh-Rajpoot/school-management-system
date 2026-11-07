import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import { Users, GraduationCap, CalendarCheck, Wallet, Calendar, BookOpen, Megaphone, MessageSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const isAdminOrOwner = ["ADMIN", "OWNER"].includes(String(role || "").toUpperCase());

  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    feeCollection: 0,
    pendingFees: 0,
  });

  const [todayAttendance, setTodayAttendance] = useState(null);

  const [salaryStats, setSalaryStats] = useState({
    totalDue: 0,
    totalPaid: 0,
  });

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const results = await Promise.allSettled([
          api.get("/students/?page_size=1"),
          api.get("/teachers/?page_size=1"),
          api.get("/fees/student-fees/dashboard_summary/"),
          api.get("/attendance/summary/", { params: { date: today } }),
          api.get("/teachers/salaries/"),
          api.get("/api/exams/"),
        ]);

        const studentsRes = results[0];
        const teachersRes = results[1];
        const feesRes = results[2];
        const attendanceRes = results[3];
        const salariesRes = results[4];
        const examsRes = results[5];

        setStats({
          students:
            studentsRes.status === "fulfilled"
              ? studentsRes.value?.data?.count ?? 0
              : 0,

          teachers:
            teachersRes.status === "fulfilled"
              ? teachersRes.value?.data?.count ?? 0
              : 0,

          feeCollection:
            feesRes.status === "fulfilled"
              ? Number(feesRes.value?.data?.total_fee_collection ?? 0)
              : 0,

          pendingFees:
            feesRes.status === "fulfilled"
              ? Number(feesRes.value?.data?.total_pending ?? 0)
              : 0,
        });

        if (attendanceRes.status === "fulfilled") {
          setTodayAttendance(attendanceRes.value.data);
        }

        if (salariesRes.status === "fulfilled") {
          const list = salariesRes.value.data?.results || (Array.isArray(salariesRes.value.data) ? salariesRes.value.data : []);
          let due = 0;
          let paid = 0;
          list.forEach((s) => {
            due += Number(s.amount || 0);
            paid += Number(s.paid_amount || 0);
          });
          setSalaryStats({ totalDue: due, totalPaid: paid });
        }

        if (examsRes.status === "fulfilled") {
          const data = Array.isArray(examsRes.data)
            ? examsRes.data
            : examsRes.data?.results || [];
          setExams(data);
        }
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user, role]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          {isAdminOrOwner ? "School Dashboard" : "Dashboard"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Role: {String(role || "").toUpperCase()}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="Total Students"
          value={loading ? 'Loading...' : stats.students}
          icon={GraduationCap}
          accent="brand"
        />

        <StatCard
          label="Total Teachers"
          value={loading ? 'Loading...' : stats.teachers}
          icon={Users}
          accent="green"
        />

        <StatCard
          label="Fee Collected"
          value={
            loading
              ? 'Loading...'
              : `₹${stats.feeCollection.toLocaleString()}`
          }
          icon={Wallet}
          accent="amber"
        />

        <StatCard
          label="Fee Pending"
          value={
            loading
              ? 'Loading...'
              : `₹${stats.pendingFees.toLocaleString()}`
          }
          icon={CalendarCheck}
          accent="rose"
        />

      </div>

      {/* Today's Attendance */}
      <Card title="Today's Attendance">
        {todayAttendance && todayAttendance.total_days > 0 ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-brand-600">
                {todayAttendance.attendance_percentage}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Present rate</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{todayAttendance.present_days}</p>
              <p className="text-xs text-slate-500 mt-1">Present today</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{todayAttendance.total_days}</p>
              <p className="text-xs text-slate-500 mt-1">Records marked</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No attendance has been marked for today yet.
          </p>
        )}
      </Card>

      {/* Quick Links */}
      <Card title="Quick links">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">

          <Link
            to="/admin/students"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Manage Students
          </Link>

          <Link
            to="/admin/teachers"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Manage Teachers
          </Link>

          <Link
            to="/admin/fees"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Fee Collection
          </Link>

          <Link
            to="/admin/salaries"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Teacher Salary
          </Link>

          <Link
            to "/admin/examinations"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Examinations
          </Link>

          <Link
            to "/admin/marks"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Marks
          </Link>

          <Link
            to="/admin/report-cards"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Report Cards
          </Link>

          <Link
            to "/admin/documents"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Documents
          </Link>

          <Link
            to "/admin/homework"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Homework
          </Link>

          <Link
            to "/admin/timetable"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Timetable
          </Link>

          <Link
            to="/admin/fee-structures"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Fee Structures
          </Link>

          <Link
            to="/admin/fee-payments"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Fee Payments
          </Link>

          <Link
            to="/admin/teacher-salaries"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 font-medium"
          >
            Teacher Salaries
          </Link>

          <Link
            to="/admin/announcements"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Post Announcement
          </Link>

          <Link
            to "/admin/whatsapp"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 font-medium"
          >
            WhatsApp & Alerts
          </Link>

        </div>

      </Card>

    </div>
  );
}