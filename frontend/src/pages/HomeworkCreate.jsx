import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { Plus, Eye, Trash, Calendar } from "lucide-react";

export default function HomeworkCreate() {
  const { user } = useAuth();
  const router = useRouter();
  const examId = router.query.examId || null;

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  const isTeacher = ["TEACHER"].includes(String(user?.role || "").toUpperCase());
  const isStudent = ["STUDENT"].includes(String(user?.role || "").toUpperCase());

  const [homework, setHomework] = useState({
    title: "",
    description: "",
    section: "",
    subject: "",
    due_date: "",
  });

  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);

  async function loadSections() {
    try {
      const res = await api.get("/academics/sections/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSections(data);
    } catch (err) {
      console.error("Failed to load sections:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjects() {
    try {
      const res = await api.get("/academics/subjects/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSubjects(data);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }

  async function loadTeachers() {
    try {
      const res = await api.get("/teachers/");
      const data = Array.isArray(res.data) ? res.data?.results || res.data || [] : [];
      setTeachers(data);
    } catch (err) {
      console.error("Failed to load teachers:", err);
    }
  }

  async function loadExams() {
    try {
      const res = await api.get("/api/exams/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setExams(data);
    } catch (err) {
      console.error("Failed to load exams:", err);
    }
  }

  useEffect(() => {
    loadSections();
    loadSubjects();
    loadTeachers();
    loadExams();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        title: homework.title,
        description: homework.description,
        section: homework.section,
        subject: homework.subject,
        due_date: homework.due_date,
        teacher: user.teacher_profile?.id || null,
      };

      if (examId) {
        await api.post(`/api/exams/exams/${examId}/homework/`, payload);
      } else {
        await api.post("/api/homework/", payload);
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error("Failed to create homework:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to create homework. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Homework</h1>
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
          <Eye size={12} /> Homework created successfully.
        </div>
      )}

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={homework.title}
              onChange={(e) =>
                setHomework({ ...homework, title: e.target.value.trim() })}
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
                setHomework({ ...homework, description: e.target.value.trim() })}
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
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_room?.name || s.name} - {s.name}
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
              <label className="block text-sm font-medium mb-1">Teacher (Admin only)</label>
              <select
                value={homework.teacher || ""}
                onChange={(e) =>
                  setHomework({ ...homework, teacher: e.target.value })}
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.employee_id} ({t.employee_id})
                  </option>
                ))}
              </select>
            </div>
            )}
            
            {examId && (
              <p className="text-xs text-slate-500 mt-2">
                Homework assigned for exam: {exams.find((e) => e.id == examId)?.name || "Unknown exam"}
              </p>
            )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create Homework"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}