import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Pencil, Trash2, X } from "lucide-react";

const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function flattenErrors(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;
  return (
    Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ") || fallback
  );
}

const emptySlot = {
  section: "",
  subject: "",
  teacher: "",
  day_of_week: "",
  start_time: "",
  end_time: "",
};

export default function TimetableList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFilter = searchParams.get("section") || "";
  const teacherFilter = searchParams.get("teacher") || "";

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [form, setForm] = useState(emptySlot);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const role = String(user?.role || "").toUpperCase();
  const isAdminOwner = ["ADMIN", "OWNER"].includes(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";

  function updateFilters(next) {
    const merged = { section: sectionFilter, teacher: teacherFilter, ...next };
    const params = new URLSearchParams();
    if (merged.section) params.set("section", merged.section);
    if (merged.teacher) params.set("teacher", merged.teacher);
    setSearchParams(params, { replace: true });
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (sectionFilter) params["section"] = sectionFilter;
      if (teacherFilter) params["teacher"] = teacherFilter;
      const res = await api.get("/api/timetable/", { params });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSlots(data);
    } catch (err) {
      console.error("Failed to load timetable:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to load timetable. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(timeout);
  }, [sectionFilter, teacherFilter]);

  useEffect(() => {
    async function loadOptions() {
      const [sectionRes, subjectRes, teacherRes] = await Promise.allSettled([
        api.get("/api/academics/sections/"),
        api.get("/api/academics/subjects/"),
        api.get("/api/teachers/"),
      ]);
      if (sectionRes.status === "fulfilled") {
        const data = sectionRes.value.data;
        setSections(Array.isArray(data) ? data : data?.results || []);
      }
      if (subjectRes.status === "fulfilled") {
        const data = subjectRes.value.data;
        setSubjects(Array.isArray(data) ? data : data?.results || []);
      }
      if (teacherRes.status === "fulfilled") {
        const data = teacherRes.value.data;
        setTeachers(Array.isArray(data) ? data : data?.results || []);
      }
    }
    loadOptions();
  }, []);

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      section: Number(form.section),
      subject: Number(form.subject),
      teacher: Number(form.teacher),
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
    };

    try {
      if (editingId) {
        await api.patch(`/api/timetable/${editingId}/`, payload);
      } else {
        await api.post("/api/timetable/", payload);
      }
      setForm(emptySlot);
      setEditingId(null);
      await load();
    } catch (err) {
      console.error("Failed to save slot:", err);
      setFormError(
        flattenErrors(err.response?.data, "Failed to save the timetable slot.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditSlot = (slot) => {
    setEditingId(slot.id);
    setForm({
      section: slot.section ?? "",
      subject: slot.subject ?? "",
      teacher: slot.teacher ?? "",
      day_of_week: slot.day_of_week ?? "",
      start_time: slot.start_time ?? "",
      end_time: slot.end_time ?? "",
    });
    setFormError("");
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm("Are you sure you want to delete this slot?")) {
      return;
    }
    try {
      await api.delete(`/api/timetable/${id}/`);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptySlot);
      }
      await load();
    } catch (err) {
      console.error("Failed to delete slot:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to delete the slot."
      );
    }
  };

  const columns = [
    {
      key: "day_display",
      header: "Day",
      render: (row) =>
        row.day_display ||
        DAYS.find((d) => d.value === row.day_of_week)?.label ||
        "-",
    },
    {
      key: "subject_name",
      header: "Subject",
      render: (row) => row.subject_name || "-",
    },
    {
      key: "teacher_name",
      header: "Teacher",
      render: (row) => row.teacher_name || "-",
    },
    {
      key: "section_name",
      header: "Class/Section",
      render: (row) => row.section_name || "-",
    },
    {
      key: "start_time",
      header: "Start",
      render: (row) => row.start_time || "-",
    },
    {
      key: "end_time",
      header: "End",
      render: (row) => row.end_time || "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        if (!isAdminOwner) return null;

        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleEditSlot(row)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
              title="Edit slot"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteSlot(row.id)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
              title="Delete slot"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timetable Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          View and manage weekly timetable slots.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-medium">Weekly Slots</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={sectionFilter}
              onChange={(e) => updateFilters({ section: e.target.value })}
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Classes</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class_room_name ? `${s.class_room_name} - ${s.name}` : s.name}
                </option>
              ))}
            </select>

            <select
              value={teacherFilter}
              onChange={(e) => updateFilters({ teacher: e.target.value })}
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.employee_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={slots}
          loading={loading}
          emptyText={
            isAdminOwner
              ? "No timetable slots found. Add one below."
              : isTeacher
              ? "No slots for your schedule."
              : isStudent
              ? "No timetable for your class."
              : "No timetable visible."
          }
        />
      </Card>

      {isAdminOwner && (
        <Card
          title={editingId ? "Edit Slot" : "Add Slot"}
          action={
            editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptySlot);
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <X size={14} /> Cancel edit
              </button>
            ) : null
          }
        >
          {formError && (
            <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-xs">
              {formError}
            </div>
          )}
          <form
            onSubmit={handleSaveSlot}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <select
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class_room_name ? `${s.class_room_name} - ${s.name}` : s.name}
                </option>
              ))}
            </select>

            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>

            <select
              value={form.teacher}
              onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.employee_id}
                </option>
              ))}
            </select>

            <select
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select day</option>
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Start time"
            />

            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              required
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="End time"
            />

            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 lg:col-span-3 rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update Slot" : "Add Slot"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
