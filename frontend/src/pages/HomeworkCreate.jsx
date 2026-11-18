import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";

function flattenErrors(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;
  return (
    Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ") || fallback
  );
}

export default function HomeworkCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // /admin/homework/create     -> create
  // /admin/homework/:id/edit   -> edit
  const { id: homeworkId } = useParams();
  const editing = Boolean(homeworkId);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const canManage = ["ADMIN", "OWNER"].includes(
    String(user?.role || "").toUpperCase()
  );

  const [homework, setHomework] = useState({
    title: "",
    description: "",
    section: "",
    subject: "",
    due_date: "",
    teacher: "",
  });

  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingData(true);
      setError("");
      try {
        const [sectionRes, subjectRes, teacherRes] = await Promise.allSettled([
          api.get("/api/academics/sections/"),
          api.get("/api/academics/subjects/"),
          api.get("/api/teachers/"),
        ]);

        if (cancelled) return;

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

        if (homeworkId) {
          const res = await api.get(`/api/homework/${homeworkId}/`);
          if (cancelled) return;
          setHomework({
            title: res.data.title ?? "",
            description: res.data.description ?? "",
            section: res.data.section ?? "",
            subject: res.data.subject ?? "",
            due_date: res.data.due_date ?? "",
            teacher: res.data.teacher ?? "",
          });
        }
      } catch (err) {
        console.error("Failed to load homework data:", err);
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              err.response?.data?.message ||
              "Unable to load the form. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [homeworkId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      title: homework.title,
      description: homework.description,
      section: homework.section,
      subject: homework.subject,
      due_date: homework.due_date,
    };

    // Admin picks the owning teacher; a teacher's own profile is set server-side.
    if (canManage) {
      payload.teacher = homework.teacher || null;
    }

    try {
      if (editing) {
        await api.patch(`/api/homework/${homeworkId}/`, payload);
      } else {
        await api.post("/api/homework/", payload);
      }

      setSuccess(true);
      navigate("/admin/homework");
    } catch (err) {
      console.error("Failed to save homework:", err);
      setError(
        flattenErrors(
          err.response?.data,
          "Failed to save homework. Please try again."
        )
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {editing ? "Edit Homework" : "Create Homework"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Assign homework to a class/section and subject.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950/40 dark:border-green-500 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Homework saved successfully.
        </div>
      )}

      <Card>
        {loadingData && (
          <p className="text-sm text-slate-500 mb-3">Loading form data…</p>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={homework.title}
              onChange={(e) =>
                setHomework({ ...homework, title: e.target.value })}
              required
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., Chapter 1 Exercises"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={homework.description}
              onChange={(e) =>
                setHomework({ ...homework, description: e.target.value })}
              rows={2}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., Exercises 1-10"
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Class/Section</label>
              <select
                value={homework.section}
                onChange={(e) =>
                  setHomework({ ...homework, section: e.target.value })}
                required
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_room_name ? `${s.class_room_name} - ${s.name}` : s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <select
                value={homework.subject}
                onChange={(e) =>
                  setHomework({ ...homework, subject: e.target.value })}
                required
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={homework.due_date}
              onChange={(e) =>
                setHomework({ ...homework, due_date: e.target.value })}
              required
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {canManage && (
            <div>
              <label className="block text-sm font-medium mb-1">Teacher</label>
              <select
                value={homework.teacher}
                onChange={(e) =>
                  setHomework({ ...homework, teacher: e.target.value })}
                required
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.employee_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => navigate("/admin/homework")}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : editing
                ? "Update Homework"
                : "Create Homework"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
