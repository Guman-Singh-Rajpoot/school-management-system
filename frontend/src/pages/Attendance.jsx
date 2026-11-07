import { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { Check, X, Circle, Save, Calendar, Filter, Users, CalendarCheck, AlertCircle } from "lucide-react";

export default function Attendance() {
  const { user } = useAuth();
  const role = user?.role || "";
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
  const isAdmin = role === "ADMIN" || role === "OWNER";

  // Tab state for teacher/admin
  const [activeTab, setActiveTab] = useState(isStudent ? "history" : "mark");

  // Selection filters for marking
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Student list and attendance map
  const [classStudents, setClassStudents] = useState([]);
  const [attendanceState, setAttendanceState] = useState({}); // studentId -> status: 'PRESENT' | 'ABSENT' | 'NOT_MARKED'
  const [remarksState, setRemarksState] = useState({}); // studentId -> string
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  // History / Report records
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [historyFilters, setHistoryFilters] = useState({
    date: "",
    status: "",
    school_class: "",
  });

  // 1. Load Classes on Mount (for Admin & Teacher)
  useEffect(() => {
    if (isStudent) return;

    if (isTeacher) {
      // Fetch teacher's own profile to get assigned classes
      api.get("/teachers/").then((res) => {
        const teachers = res.data?.results || res.data || [];
        const currentTeacher = teachers.find((t) => t.user?.id === user?.id) || teachers[0];
        if (currentTeacher?.classes) {
          // If teacher has class IDs or objects, load academic classes
          api.get("/academics/classes/").then((cRes) => {
            const allCls = cRes.data?.results || cRes.data || [];
            const teacherClassIds = Array.isArray(currentTeacher.classes)
              ? currentTeacher.classes.map((c) => (typeof c === "object" ? c.id : c))
              : [];
            const assigned = allCls.filter((c) => teacherClassIds.includes(c.id));
            setClasses(assigned.length > 0 ? assigned : allCls);
            if (assigned.length > 0) setSelectedClass(String(assigned[0].id));
          });
        }
      });
    } else {
      // Admin loads all classes
      api.get("/academics/classes/").then((res) => {
        const list = res.data?.results || res.data || [];
        setClasses(list);
        if (list.length > 0) setSelectedClass(String(list[0].id));
      });
    }
  }, [isStudent, isTeacher, user?.id]);

  // 2. Load Sections when Class changes
  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setSelectedSection("");
      return;
    }
    api.get("/academics/sections/", { params: { class_room: selectedClass } }).then((res) => {
      const list = res.data?.results || res.data || [];
      setSections(list);
      setSelectedSection(""); // default all sections in that class
    });
  }, [selectedClass]);

  // 3. Load Students and Saved Attendance for Selected Class + Date
  useEffect(() => {
    if (isStudent || !selectedClass || activeTab !== "mark") return;

    let isMounted = true;
    setLoadingStudents(true);
    setSaveMessage({ type: "", text: "" });

    const studentParams = { school_class: selectedClass };
    if (selectedSection) studentParams.section = selectedSection;

    const attendanceParams = { school_class: selectedClass, date: selectedDate };
    if (selectedSection) attendanceParams.section = selectedSection;

    Promise.allSettled([
      api.get("/students/", { params: studentParams }),
      api.get("/attendance/", { params: attendanceParams }),
    ])
      .then(([studentsRes, attRes]) => {
        if (!isMounted) return;
        const students = studentsRes.value?.data?.results || studentsRes.value?.data || [];
        const savedAttendance = attRes.value?.data?.results || attRes.value?.data || [];

        // Build attendance map for existing records
        const attMap = {};
        const remMap = {};
        savedAttendance.forEach((record) => {
          const sId = record.student;
          attMap[sId] = record.status;
          if (record.remarks) remMap[sId] = record.remarks;
        });

        // For any student without a record, default to 'NOT_MARKED'
        const initialStatus = {};
        students.forEach((s) => {
          initialStatus[s.id] = attMap[s.id] || "NOT_MARKED";
        });

        setClassStudents(students);
        setAttendanceState(initialStatus);
        setRemarksState(remMap);
      })
      .finally(() => {
        if (isMounted) setLoadingStudents(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedClass, selectedSection, selectedDate, activeTab, isStudent]);

  // 4. Load History / Reports
  function loadHistory() {
    setHistoryLoading(true);
    const params = {};
    if (historyFilters.date) params.date = historyFilters.date;
    if (historyFilters.status) params.status = historyFilters.status;
    if (historyFilters.school_class) params.school_class = historyFilters.school_class;

    Promise.allSettled([
      api.get("/attendance/", { params }),
      api.get("/attendance/summary/", { params }),
    ])
      .then(([listRes, sumRes]) => {
        setHistoryRows(listRes.value?.data?.results || listRes.value?.data || []);
        setSummaryData(sumRes.value?.data || null);
      })
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    if (activeTab === "history" || isStudent) {
      loadHistory();
    }
  }, [activeTab, historyFilters, isStudent]);

  // Handle setting status for a single student
  function setStudentStatus(studentId, status) {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  }

  // Handle setting remark
  function setStudentRemark(studentId, remark) {
    setRemarksState((prev) => ({
      ...prev,
      [studentId]: remark,
    }));
  }

  // Bulk Save Attendance
  async function handleSaveAttendance() {
    setSaving(true);
    setSaveMessage({ type: "", text: "" });

    const records = classStudents.map((s) => ({
      student: s.id,
      status: attendanceState[s.id] || "NOT_MARKED",
      remarks: remarksState[s.id] || "",
    }));

    try {
      const payload = {
        date: selectedDate,
        school_class: selectedClass ? parseInt(selectedClass, 10) : undefined,
        section: selectedSection ? parseInt(selectedSection, 10) : undefined,
        records,
      };

      const res = await api.post("/attendance/bulk_mark/", payload);
      setSaveMessage({
        type: "success",
        text: res.data?.detail || "Class attendance saved successfully!",
      });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err.response?.data?.detail || "Failed to save attendance. Check permissions.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Counts for current marking screen
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let notMarked = 0;
    classStudents.forEach((s) => {
      const st = attendanceState[s.id];
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else notMarked++;
    });
    return { present, absent, notMarked, total: classStudents.length };
  }, [classStudents, attendanceState]);

  // History columns
  const historyColumns = [
    { key: "date", header: "Date" },
    ...(!isStudent ? [{ key: "student_name", header: "Student", render: (r) => r.student_name || `#${r.student}` }] : []),
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const cls =
          r.status === "PRESENT"
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : r.status === "ABSENT"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{r.status}</span>;
      },
    },
    { key: "remarks", header: "Remarks", render: (r) => r.remarks || "—" },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {isStudent ? "My Attendance" : "Student Attendance"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isStudent
              ? "View your personal attendance history and overall attendance percentage."
              : "Mark class-wise attendance by date and review attendance records."}
          </p>
        </div>

        {/* Tab switch for Teacher/Admin */}
        {!isStudent && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start">
            <button
              onClick={() => setActiveTab("mark")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "mark"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Class Attendance Sheet
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Reports & History
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MARK CLASS ATTENDANCE (Teacher & Admin) */}
      {/* ======================================================== */}
      {!isStudent && activeTab === "mark" && (
        <div className="space-y-6">
          {/* Filter Bar: Class, Section, Date */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Class / Grade *
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {classes.length === 0 && <option value="">No classes assigned</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Section (Optional)
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">All Sections</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Attendance Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </Card>

          {/* Counters Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Enrolled Students</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{counts.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-900/50">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">Present</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-400 mt-0.5">{counts.present}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">Absent</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{counts.absent}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Not Marked</p>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{counts.notMarked}</p>
            </div>
          </div>

          {/* Notifications */}
          {saveMessage.text && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                saveMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
              }`}
            >
              {saveMessage.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
              <span>{saveMessage.text}</span>
            </div>
          )}

          {/* Student Attendance Table */}
          <Card
            title={`Attendance Sheet — ${selectedDate}`}
            actions={
              <button
                onClick={handleSaveAttendance}
                disabled={saving || classStudents.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-sm"
              >
                <Save size={16} />
                {saving ? "Saving Changes..." : "Save Attendance"}
              </button>
            }
          >
            {loadingStudents ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading student roster...</div>
            ) : classStudents.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No students enrolled in this class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Roll No.</th>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Present</th>
                      <th className="py-3 px-4 text-center">Absent</th>
                      <th className="py-3 px-4 text-center">Not Marked</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {classStudents.map((s) => {
                      const status = attendanceState[s.id] || "NOT_MARKED";
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            {s.roll_number || "—"}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-500">{s.admission_number}</td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            {s.full_name || s.user?.username}
                          </td>

                          {/* Present Radio Pill */}
                          <td className="py-3 px-4 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`status_${s.id}`}
                                checked={status === "PRESENT"}
                                onChange={() => setStudentStatus(s.id, "PRESENT")}
                                className="sr-only"
                              />
                              <span
                                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                  status === "PRESENT"
                                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                Present
                              </span>
                            </label>
                          </td>

                          {/* Absent Radio Pill */}
                          <td className="py-3 px-4 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`status_${s.id}`}
                                checked={status === "ABSENT"}
                                onChange={() => setStudentStatus(s.id, "ABSENT")}
                                className="sr-only"
                              />
                              <span
                                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                  status === "ABSENT"
                                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                Absent
                              </span>
                            </label>
                          </td>

                          {/* Not Marked Radio Pill */}
                          <td className="py-3 px-4 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`status_${s.id}`}
                                checked={status === "NOT_MARKED"}
                                onChange={() => setStudentStatus(s.id, "NOT_MARKED")}
                                className="sr-only"
                              />
                              <span
                                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                  status === "NOT_MARKED"
                                    ? "bg-slate-600 text-white border-slate-600 shadow-sm"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                Not Marked
                              </span>
                            </label>
                          </td>

                          {/* Remarks */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Optional remarks"
                              value={remarksState[s.id] || ""}
                              onChange={(e) => setStudentRemark(s.id, e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REPORTS & HISTORY (Student, Teacher, Admin) */}
      {/* ======================================================== */}
      {(isStudent || activeTab === "history") && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Attendance Percentage"
              value={summaryData?.attendance_percentage !== undefined ? `${summaryData.attendance_percentage}%` : "—"}
              icon={CalendarCheck}
              accent="brand"
            />
            <StatCard
              label="Total School Days"
              value={summaryData?.total_days ?? historyRows.length}
              icon={Calendar}
              accent="blue"
            />
            <StatCard
              label="Days Present"
              value={summaryData?.present_days ?? historyRows.filter((r) => r.status === "PRESENT").length}
              icon={Check}
              accent="green"
            />
            <StatCard
              label="Days Absent"
              value={
                summaryData?.breakdown?.find((b) => b.status === "ABSENT")?.count ??
                historyRows.filter((r) => r.status === "ABSENT").length
              }
              icon={X}
              accent="rose"
            />
          </div>

          {/* History Filters */}
          {!isStudent && (
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Date</label>
                  <input
                    type="date"
                    value={historyFilters.date}
                    onChange={(e) => setHistoryFilters((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={historyFilters.status}
                    onChange={(e) => setHistoryFilters((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LEAVE">Leave</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setHistoryFilters({ date: "", status: "", school_class: "" })}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Attendance Records Table */}
          <Card title={isStudent ? "My Attendance Log" : "Recorded Attendance Logs"}>
            <DataTable
              columns={historyColumns}
              rows={historyRows}
              loading={historyLoading}
              emptyText="No attendance records found."
            />
          </Card>
        </div>
      )}
    </div>
  );
}
