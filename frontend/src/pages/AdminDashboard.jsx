import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    feeCollection: 0,
    pendingFees: 0,
  });

  const [todayAttendance, setTodayAttendance] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const results = await Promise.allSettled([
          api.get('/students/?page_size=1'),
          api.get('/teachers/?page_size=1'),
          api.get('/fees/student-fees/dashboard_summary/'),
          api.get('/attendance/summary/', { params: { date: today } }),
        ]);

        const studentsRes = results[0];
        const teachersRes = results[1];
        const feesRes = results[2];
        const attendanceRes = results[3];

        setStats({
          students:
            studentsRes.status === 'fulfilled'
              ? studentsRes.value?.data?.count ?? 0
              : 0,

          teachers:
            teachersRes.status === 'fulfilled'
              ? teachersRes.value?.data?.count ?? 0
              : 0,

          feeCollection:
            feesRes.status === 'fulfilled'
              ? Number(feesRes.value?.data?.total_fee_collection ?? 0)
              : 0,

          pendingFees:
            feesRes.status === 'fulfilled'
              ? Number(feesRes.value?.data?.total_pending ?? 0)
              : 0,
        });

        if (attendanceRes.status === 'fulfilled') {
          setTodayAttendance(attendanceRes.value.data);
        }
      } catch (error) {
        console.error('Dashboard error:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          Admin Dashboard
        </h1>

        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Overview of the entire school system.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="Total Students"
          value={loading ? '…' : stats.students}
          icon={GraduationCap}
          accent="brand"
        />

        <StatCard
          label="Total Teachers"
          value={loading ? '…' : stats.teachers}
          icon={Users}
          accent="green"
        />

        <StatCard
          label="Fee Collected"
          value={
            loading
              ? '…'
              : `₹${stats.feeCollection.toLocaleString('en-IN')}`
          }
          icon={Wallet}
          accent="amber"
        />

        <StatCard
          label="Fee Pending"
          value={
            loading
              ? '…'
              : `₹${stats.pendingFees.toLocaleString('en-IN')}`
          }
          icon={CalendarCheck}
          accent="rose"
        />

      </div>

      {/* Attendance */}
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
            to="/admin/attendance"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Student Attendance
          </Link>

          <Link
            to="/admin/teacher-attendance"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Teacher Attendance
          </Link>

          <Link
            to="/admin/classes"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Classes & Sessions
          </Link>

          <Link
            to="/admin/announcements"
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            Post Announcement
          </Link>

        </div>

      </Card>

    </div>
  );
}