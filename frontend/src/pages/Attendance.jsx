import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  PRESENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  LEAVE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  HOLIDAY: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function Attendance() {
  const { user } = useAuth();
  const canMark = user?.role === "ADMIN" || user?.role === "TEACHER";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [students, setStudents] = useState([]);

  const [filters, setFilters] = useState({ date: "", status: "" });

  const [markOpen, setMarkOpen] = useState(false);
  const [markForm, setMarkForm] = useState({
    student: "",
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;
      const response = await api.get("/attendance/", { params });
      const data = response.data;
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to load attendance:", err);
      setError(err.response?.data?.detail || "Unable to load attendance records.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.date, filters.status]);

  useEffect(() => {
    if (!markOpen || !canMark) return;
    api.get("/students/").then((res) => setStudents(res.data?.results || res.data || []));
  }, [markOpen, canMark]);

  function openMark() {
    setMarkForm({
      student: "",
      date: new Date().toISOString().slice(0, 10),
      status: "PRESENT",
      remarks: "",
    });
    setSaveError("");
    setMarkOpen(true);
  }

  async function handleMark(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await api.post("/attendance/", markForm);
      setMarkOpen(false);
      await loadRows();
    } catch (err) {
      const data = err.response?.data;
      setSaveError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to mark attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "student", header: "Student", render: (row) => row.student_name || `#${row.student}` },
    { key: "date", header: "Date" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[row.status] || ""}`}>
          {row.status}
        </span>
      ),
    },
    { key: "remarks", header: "Remarks", render: (row) => row.remarks || "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Student Attendance</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Mark and review daily student attendance.
          </p>
        </div>

        {canMark && (
          <button
            onClick={openMark}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Mark Attendance
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="date"
          className="input max-w-[180px]"
          value={filters.date}
          onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
        />
        <select
          className="input max-w-[180px]"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LEAVE">Leave</option>
          <option value="HOLIDAY">Holiday</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card>
        <DataTable columns={columns} rows={rows} loading={loading} emptyText="No attendance records found." />
      </Card>

      <Modal open={markOpen} onClose={() => setMarkOpen(false)} title="Mark Attendance">
        <form onSubmit={handleMark} className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            <select
              required
              className="input"
              value={markForm.student}
              onChange={(e) => setMarkForm((f) => ({ ...f, student: e.target.value }))}
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.admission_number} ({s.admission_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input
              required
              type="date"
              className="input"
              value={markForm.date}
              onChange={(e) => setMarkForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              className="input"
              value={markForm.status}
              onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Remarks (optional)</label>
            <input
              className="input"
              value={markForm.remarks}
              onChange={(e) => setMarkForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMarkOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Mark"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
