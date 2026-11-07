import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import { CalendarCheck, BookOpen, Wallet, ClipboardList, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function StudentDashboard() {
  const [announcements, setAnnouncements] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [fees, setFees] = useState({ totalPayable: 0, totalPaid: 0, totalRemaining: 0, status: '—' });
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      try {
        setLoading(true);
        const [annRes, attRes, feesRes, hwRes] = await Promise.allSettled([
          api.get('/announcements/', { params: { page_size: 5 } }),
          api.get('/attendance/summary/'),
          api.get('/fees/student-fees/'),
          api.get('/homework/', { params: { page_size: 5 } }),
        ]);

        if (annRes.status === 'fulfilled') {
          setAnnouncements(annRes.value?.data?.results || (Array.isArray(annRes.value?.data) ? annRes.value.data : []));
        }

        if (attRes.status === 'fulfilled') {
          setAttendanceSummary(attRes.value?.data || null);
        }

        if (feesRes.status === 'fulfilled') {
          const feeList = feesRes.value?.data?.results || (Array.isArray(feesRes.value?.data) ? feesRes.value.data : []);
          let payable = 0;
          let paid = 0;
          let remaining = 0;

          feeList.forEach((f) => {
            payable += Number(f.net_payable ?? f.amount ?? 0);
            paid += Number(f.paid_amount ?? 0);
            remaining += Number(f.remaining_amount ?? f.pending_amount ?? 0);
          });

          let status = 'No Fees';
          if (feeList.length > 0) {
            if (remaining <= 0) {
              status = 'Fully Paid';
            } else if (paid > 0) {
              status = `Partially Paid (₹${remaining.toLocaleString('en-IN')} Due)`;
            } else {
              status = `Due: ₹${remaining.toLocaleString('en-IN')}`;
            }
          }

          setFees({
            totalPayable: payable,
            totalPaid: paid,
            totalRemaining: remaining,
            status,
          });
        }

        if (hwRes.status === 'fulfilled') {
          setHomework(hwRes.value?.data?.results || (Array.isArray(hwRes.value?.data) ? hwRes.value.data : []));
        }
      } catch (err) {
        console.error('Student dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, []);

  const annColumns = [
    { key: 'title', header: 'Title' },
    { key: 'message', header: 'Message', render: (row) => <span className="line-clamp-1">{row.message}</span> },
    { key: 'created_at', header: 'Date', render: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  const attendancePct = attendanceSummary?.attendance_percentage ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Student Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Track your attendance, fee status, homework, and announcements in one place.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Attendance Rate"
          value={loading ? '…' : attendancePct !== null ? `${attendancePct}%` : '—'}
          icon={CalendarCheck}
          accent={attendancePct && attendancePct >= 75 ? 'green' : 'amber'}
        />

        <StatCard
          label="Fee Status"
          value={loading ? '…' : fees.status}
          icon={Wallet}
          accent={fees.totalRemaining <= 0 ? 'green' : 'rose'}
        />

        <StatCard
          label="Pending Fees"
          value={loading ? '…' : `₹${fees.totalRemaining.toLocaleString('en-IN')}`}
          icon={Wallet}
          accent={fees.totalRemaining > 0 ? 'rose' : 'brand'}
        />

        <StatCard
          label="Assigned Homework"
          value={loading ? '…' : homework.length}
          icon={ClipboardList}
          accent="amber"
        />
      </div>

      {/* Fee & Attendance Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Summary */}
        <Card title="Attendance Record">
          {attendanceSummary && attendanceSummary.total_days > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center py-2">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {attendanceSummary.present_days}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Days Present</div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900">
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {attendanceSummary.absent_days}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Days Absent</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {attendanceSummary.total_days}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Total Days</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-500">
                  Minimum attendance criteria: <strong>75%</strong>
                </span>
                <Link to="/student/attendance" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                  View full history <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No attendance recorded yet.</p>
          )}
        </Card>

        {/* Fee Status Card */}
        <Card title="Fee Summary">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Paid Amount</span>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{fees.totalPaid.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500">Remaining Balance</span>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  ₹{fees.totalRemaining.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              {fees.totalRemaining <= 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> All dues cleared
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                  <AlertTriangle className="w-4 h-4" /> Payment pending
                </span>
              )}
              <Link to="/student/fees" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                View fee receipts & details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Announcements */}
      <Card title="School Announcements">
        <DataTable
          columns={annColumns}
          rows={announcements}
          loading={loading}
          emptyText="No announcements yet."
        />
      </Card>
    </div>
  );
}
