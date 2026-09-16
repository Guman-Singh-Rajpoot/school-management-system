import { useEffect, useState } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import { CalendarCheck, BookOpen, Wallet, ClipboardList } from 'lucide-react';

export default function StudentDashboard() {
  const [announcements, setAnnouncements] = useState([]);
  const [attendancePct, setAttendancePct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/announcements/', { params: { page_size: 5 } }),
      api.get('/attendance/summary/'),
    ]).then(([annRes, attRes]) => {
      setAnnouncements(annRes.value?.data?.results || []);
      setAttendancePct(attRes.value?.data?.attendance_percentage ?? null);
      setLoading(false);
    });
  }, []);

  const columns = [
    { key: 'title', header: 'Announcement' },
    { key: 'created_at', header: 'Date', render: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Student Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your attendance, marks, and announcements.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Attendance" value={attendancePct !== null ? `${attendancePct}%` : '—'} icon={CalendarCheck} accent="brand" />
        <StatCard label="Latest Exam" value="—" icon={BookOpen} accent="green" />
        <StatCard label="Fee Status" value="—" icon={Wallet} accent="amber" />
        <StatCard label="Pending Homework" value="—" icon={ClipboardList} accent="rose" />
      </div>

      <Card title="Announcements">
        <DataTable columns={columns} rows={announcements} loading={loading} emptyText="No announcements yet." />
      </Card>
    </div>
  );
}
