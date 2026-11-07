import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import { Users, ClipboardList, BookOpen, CalendarCheck, Megaphone, ArrowRight } from 'lucide-react';

export default function TeacherDashboard() {
  const [profile, setProfile] = useState(null);
  const [homework, setHomework] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10);

        const [teacherRes, hwRes, annRes, attRes] = await Promise.allSettled([
          api.get('/teachers/'),
          api.get('/homework/', { params: { page_size: 5 } }),
          api.get('/announcements/', { params: { page_size: 3 } }),
          api.get('/teachers/attendance/', { params: { date: today } }),
        ]);

        if (teacherRes.status === 'fulfilled') {
          const data = teacherRes.value.data;
          const teacherObj = Array.isArray(data?.results)
            ? data.results[0]
            : Array.isArray(data)
            ? data[0]
            : data;
          setProfile(teacherObj || null);
        }

        if (hwRes.status === 'fulfilled') {
          setHomework(hwRes.value.data?.results || (Array.isArray(hwRes.value.data) ? hwRes.value.data : []));
        }

        if (annRes.status === 'fulfilled') {
          setAnnouncements(annRes.value.data?.results || (Array.isArray(annRes.value.data) ? annRes.value.data : []));
        }

        if (attRes.status === 'fulfilled') {
          const attData = attRes.value.data?.results || (Array.isArray(attRes.value.data) ? attRes.value.data : []);
          setTodayAttendance(attData[0] || null);
        }
      } catch (err) {
        console.error('Teacher dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const hwColumns = [
    { key: 'title', header: 'Title' },
    { key: 'subject_name', header: 'Subject' },
    { key: 'due_date', header: 'Due date' },
  ];

  const classCount = profile?.classes?.length || 0;
  const subjectCount = profile?.subjects?.length || 0;
  const attendanceStatus = todayAttendance?.status || 'Not marked';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Teacher Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {profile ? `Welcome back, ${profile.full_name || profile.employee_id} • ${profile.department || 'Academic Staff'}` : 'Your classes, homework, and quick actions.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="My Classes"
          value={loading ? '…' : classCount}
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Homework Assigned"
          value={loading ? '…' : homework.length}
          icon={ClipboardList}
          accent="green"
        />
        <StatCard
          label="Subjects"
          value={loading ? '…' : subjectCount}
          icon={BookOpen}
          accent="amber"
        />
        <StatCard
          label="My Attendance Today"
          value={loading ? '…' : attendanceStatus}
          icon={CalendarCheck}
          accent={attendanceStatus === 'PRESENT' ? 'green' : attendanceStatus === 'ABSENT' ? 'rose' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Homework */}
        <div className="lg:col-span-2">
          <Card title="Recent Homework">
            <DataTable
              columns={hwColumns}
              rows={homework}
              loading={loading}
              emptyText="No homework assigned yet."
            />
          </Card>
        </div>

        {/* Recent Announcements */}
        <div>
          <Card title="Latest Announcements">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No announcements posted.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">{a.title}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{a.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1.5 block">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
                <Link
                  to="/teacher/announcements"
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1 pt-1"
                >
                  View all announcements <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Link
            to="/teacher/attendance"
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="font-semibold text-slate-900 dark:text-white">Student Attendance</div>
            <p className="text-xs text-slate-500 mt-1">Mark daily attendance for your section</p>
          </Link>
          <Link
            to="/teacher/salary"
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="font-semibold text-slate-900 dark:text-white">My Salary Slip</div>
            <p className="text-xs text-slate-500 mt-1">View month-wise salary & payment records</p>
          </Link>
          <Link
            to="/teacher/announcements"
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="font-semibold text-slate-900 dark:text-white">School Notice Board</div>
            <p className="text-xs text-slate-500 mt-1">Browse school-wide announcements</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}
