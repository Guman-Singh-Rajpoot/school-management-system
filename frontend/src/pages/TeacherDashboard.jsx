import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import { Users, ClipboardList, BookOpen, CalendarCheck } from 'lucide-react';

export default function TeacherDashboard() {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/homework/', { params: { page_size: 5 } })
      .then((res) => setHomework(res.data.results || []))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'subject_name', header: 'Subject' },
    { key: 'due_date', header: 'Due date' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your classes, homework, and quick actions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Classes" value="—" icon={Users} accent="brand" />
        <StatCard label="Homework Set" value={homework.length} icon={ClipboardList} accent="green" />
        <StatCard label="Subjects" value="—" icon={BookOpen} accent="amber" />
        <StatCard label="Attendance Today" value="Not marked" icon={CalendarCheck} accent="rose" />
      </div>

      <Card title="Recent homework">
        <DataTable columns={columns} rows={homework} loading={loading} emptyText="No homework assigned yet." />
      </Card>

      <Card title="Quick actions">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Link to="/teacher/attendance" className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">Student Attendance</Link>
          <Link to="/teacher/salary" className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">My Salary</Link>
          <Link to="/teacher/announcements" className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">Announcements</Link>
        </div>
      </Card>
    </div>
  );
}
