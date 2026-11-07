import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, XCircle, HelpCircle, Save, Filter, RefreshCw } from "lucide-react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  PRESENT: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  ABSENT: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  LEAVE: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  HOLIDAY: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export default function TeacherAttendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [activeTab, setActiveTab] = useState(isAdmin ? "mark" : "reports");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Admin bulk mark state
  const [teachersList, setTeachersList] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { [teacherId]: { status, remarks } }
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  // Reports state
  const [records, setRecords] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportFilters, setReportFilters] = useState({
    date: "",
    teacher: "",
    status: "",
  });
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    rate: 0,
  });

  // Load teachers and existing attendance for bulk mark
  useEffect(() => {
    if (!isAdmin || activeTab !== "mark") return;

    let isMounted = true;
    async function loadGrid() {
      setLoadingGrid(true);
      setFeedback({ message: "", type: "" });
      try {
        const [teachersRes, attRes] = await Promise.all([
          api.get("/teachers/"),
          api.get("/teachers/attendance/", { params: { date: selectedDate } }),
        ]);

        if (!isMounted) return;

        const teachers = teachersRes.data?.results || teachersRes.data || [];
        const activeOnly = teachers.filter((t) => t.user?.is_active !== false);
        setTeachersList(activeOnly);

        const existingAtt = attRes.data?.results || attRes.data || [];
        const map = {};
        // Initialize all active teachers as NOT_MARKED
        activeOnly.forEach((t) => {
          map[t.id] = { status: "NOT_MARKED", remarks: "" };
        });
        // Populate existing records
        existingAtt.forEach((rec) => {
          const tId = typeof rec.teacher === "object" ? rec.teacher?.id : rec.teacher;
          if (map[tId]) {
            map[tId] = {
              status: rec.status || "PRESENT",
              remarks: rec.remarks || "",
            };
          }
        });

        setAttendanceMap(map);
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load teacher attendance grid:", err);
        setFeedback({
          message: err.response?.data?.detail || "Failed to load faculty list and attendance.",
          type: "error",
        });
      } finally {
        if (isMounted) setLoadingGrid(false);
      }
    }

    loadGrid();
    return () => {
      isMounted = false;
    };
  }, [isAdmin, activeTab, selectedDate]);

  // Load reports
  async function loadReports() {
    setLoadingReports(true);
    setReportError("");
    try {
      const params = {};
      if (reportFilters.date) params.date = reportFilters.date;
      if (reportFilters.status) params.status = reportFilters.status;
      if (isAdmin && reportFilters.teacher) params.teacher = reportFilters.teacher;

      const [res, sumRes] = await Promise.all([
        api.get("/teachers/attendance/", { params }),
        api.get("/teachers/attendance/summary/", { params }).catch(() => ({ data: null })),
      ]);

      const data = res.data?.results || res.data || [];
      setRecords(data);

      if (sumRes.data) {
        setSummaryStats({
          total: sumRes.data.total_records || 0,
          present: sumRes.data.present_count || 0,
          absent: sumRes.data.absent_count || 0,
          rate: sumRes.data.attendance_percentage || 0,
        });
      } else {
        const total = data.length;
        const present = data.filter((r) => r.status === "PRESENT").length;
        const absent = data.filter((r) => r.status === "ABSENT").length;
        setSummaryStats({
          total,
          present,
          absent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        });
      }
    } catch (err) {
      console.error("Failed to load attendance reports:", err);
      setReportError(err.response?.data?.detail || "Failed to load attendance records.");
      setRecords([]);
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportFilters.date, reportFilters.teacher, reportFilters.status]);

  // Batch status helper
  function setAllStatus(newStatus) {
    setAttendanceMap((prev) => {
      const updated = { ...prev };
      teachersList.forEach((t) => {
        updated[t.id] = {
          ...(updated[t.id] || {}),
          status: newStatus,
        };
      });
      return updated;
    });
  }

  // Individual status update
  function setTeacherStatus(teacherId, status) {
    setAttendanceMap((prev) => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] || { remarks: "" }),
        status,
      },
    }));
  }

  function setTeacherRemarks(teacherId, remarks) {
    setAttendanceMap((prev) => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] || { status: "NOT_MARKED" }),
        remarks,
      },
    }));
  }

  // Save bulk teacher attendance
  async function handleSaveBulk() {
    setSavingBulk(true);
    setFeedback({ message: "", type: "" });
    try {
      const recordsToSubmit = teachersList.map((t) => ({
        teacher: t.id,
        status: attendanceMap[t.id]?.status || "NOT_MARKED",
        remarks: attendanceMap[t.id]?.remarks || "",
      }));

      const res = await api.post("/teachers/attendance/bulk_mark/", {
        date: selectedDate,
        records: recordsToSubmit,
      });

      setFeedback({
        message: res.data?.detail || `Attendance recorded successfully for ${selectedDate}.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to save teacher attendance:", err);
      setFeedback({
        message: err.response?.data?.detail || "Failed to save teacher attendance.",
        type: "error",
      });
    } finally {
      setSavingBulk(false);
    }
  }

  // Count statuses in mark grid
  const presentCount = Object.values(attendanceMap).filter((v) => v.status === "PRESENT").length;
  const absentCount = Object.values(attendanceMap).filter((v) => v.status === "ABSENT").length;
  const notMarkedCount = Object.values(attendanceMap).filter(
    (v) => !v.status || v.status === "NOT_MARKED"
  ).length;

  const reportColumns = [
    {
      key: "teacher",
      header: "Faculty Member",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {row.teacher_name || `#${row.teacher}`}
          </p>
          <p className="text-xs text-slate-500 font-mono">ID: {row.employee_id || "-"}</p>
        </div>
      ),
    },
    { key: "date", header: "Date" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            STATUS_STYLES[row.status] || "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "marked_by",
      header: "Marked By",
      render: (row) => row.marked_by_name || "Admin",
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row) => row.remarks || <span className="text-slate-400 italic">None</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Teacher Attendance
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isAdmin
              ? "Record and manage faculty attendance across all staff members."
              : "View your personal faculty attendance history and metrics."}
          </p>
        </div>

        {/* Tab switch for Admin */}
        {isAdmin && (
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("mark")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "mark"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Mark Combined Attendance
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "reports"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Records & Reports
            </button>
          </div>
        )}
      </div>

      {/* ADMIN BULK MARK TAB */}
      {isAdmin && activeTab === "mark" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={16} className="text-brand-600" />
                  Attendance Date:
                </label>
                <input
                  type="date"
                  className="input max-w-[180px]"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              {/* Quick Actions & Bulk Stats */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 mr-2">Quick set:</span>
                <button
                  type="button"
                  onClick={() => setAllStatus("PRESENT")}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => setAllStatus("ABSENT")}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                >
                  Mark All Absent
                </button>
                <button
                  type="button"
                  onClick={() => setAllStatus("NOT_MARKED")}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Counters Badge Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500">Total Faculty</span>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {teachersList.length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Present</span>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {presentCount}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Absent</span>
                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                  {absentCount}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <span className="text-xs text-slate-500">Not Marked</span>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                  {notMarkedCount}
                </p>
              </div>
            </div>
          </Card>

          {/* Feedback banner */}
          {feedback.message && (
            <div
              className={`p-4 rounded-lg text-sm border flex items-center justify-between ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              }`}
            >
              <span>{feedback.message}</span>
              <button
                onClick={() => setFeedback({ message: "", type: "" })}
                className="text-xs font-semibold underline ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Teacher Roster Table */}
          <Card>
            {loadingGrid ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                Loading faculty roster...
              </div>
            ) : teachersList.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No active faculty members found in the system.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Faculty Member</th>
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Department / Qualification</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {teachersList.map((teacher) => {
                      const currentStatus = attendanceMap[teacher.id]?.status || "NOT_MARKED";
                      const currentRemarks = attendanceMap[teacher.id]?.remarks || "";

                      return (
                        <tr
                          key={teacher.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {teacher.full_name || teacher.user?.first_name
                                ? `${teacher.user?.first_name || ""} ${teacher.user?.last_name || ""}`.trim()
                                : teacher.employee_id}
                            </div>
                            <div className="text-xs text-slate-500">
                              {teacher.user?.email || teacher.user?.username}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {teacher.employee_id || "-"}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {teacher.qualification || teacher.specialization || "General Faculty"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* PRESENT PILL */}
                              <button
                                type="button"
                                onClick={() => setTeacherStatus(teacher.id, "PRESENT")}
                                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1 ${
                                  currentStatus === "PRESENT"
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-emerald-700 border-slate-300 dark:border-slate-700 hover:border-emerald-500"
                                }`}
                              >
                                <CheckCircle2 size={13} />
                                Present
                              </button>

                              {/* ABSENT PILL */}
                              <button
                                type="button"
                                onClick={() => setTeacherStatus(teacher.id, "ABSENT")}
                                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1 ${
                                  currentStatus === "ABSENT"
                                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-rose-700 border-slate-300 dark:border-slate-700 hover:border-rose-500"
                                }`}
                              >
                                <XCircle size={13} />
                                Absent
                              </button>

                              {/* NOT MARKED PILL */}
                              <button
                                type="button"
                                onClick={() => setTeacherStatus(teacher.id, "NOT_MARKED")}
                                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1 ${
                                  currentStatus === "NOT_MARKED"
                                    ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                                    : "bg-transparent text-slate-500 border-transparent hover:border-slate-300"
                                }`}
                              >
                                <HelpCircle size={13} />
                                Unmarked
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Optional remarks"
                              className="input text-xs py-1 h-8 max-w-[200px]"
                              value={currentRemarks}
                              onChange={(e) => setTeacherRemarks(teacher.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Save Action */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="text-xs text-slate-500">
                Unmarked teachers will not have an attendance entry recorded for this date.
              </div>
              <button
                type="button"
                disabled={savingBulk || loadingGrid || teachersList.length === 0}
                onClick={handleSaveBulk}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                <Save size={16} />
                {savingBulk ? "Saving Faculty Attendance..." : "Save Teacher Attendance"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* REPORTS TAB (Visible to Admin and Teacher) */}
      {(!isAdmin || activeTab === "reports") && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <span className="text-xs font-medium text-slate-500">Total Recorded Days</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {summaryStats.total}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Present</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {summaryStats.present}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Absent</span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {summaryStats.absent}
              </p>
            </Card>
            <Card className="p-4">
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Attendance Rate</span>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                {summaryStats.rate}%
              </p>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Filters:</span>
            </div>

            <input
              type="date"
              className="input max-w-[180px] text-xs py-1.5"
              value={reportFilters.date}
              onChange={(e) => setReportFilters((f) => ({ ...f, date: e.target.value }))}
            />

            <select
              className="input max-w-[180px] text-xs py-1.5"
              value={reportFilters.status}
              onChange={(e) => setReportFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
            </select>

            {(reportFilters.date || reportFilters.status || reportFilters.teacher) && (
              <button
                type="button"
                onClick={() => setReportFilters({ date: "", status: "", teacher: "" })}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          {reportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
              {reportError}
            </div>
          )}

          <Card>
            <DataTable
              columns={reportColumns}
              rows={records}
              loading={loadingReports}
              emptyText="No teacher attendance records found for the selected criteria."
            />
          </Card>
        </div>
      )}
    </div>
  );
}
