import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import Card from "../components/Card";
import { Plus, CheckCircle, XCircle } from "lucide-react";

function flattenErrors(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;
  return (
    Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ") || fallback
  );
}

export default function ExamCreate() {
  const navigate = useNavigate();
  // Mounted at /admin/examinations/create (no param) or /admin/examinations/:id/edit
  const { id: examId } = useParams();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [exam, setExam] = useState({
    name: "",
    exam_type: "UNIT_TEST",
    school_class: "",
    session: "",
    start_date: "",
    end_date: "",
    room: "",
  });

  const [examSubjects, setExamSubjects] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  async function loadSubjects() {
    try {
      const res = await api.get("/api/academics/subjects/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSubjects(data);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function loadClasses() {
    try {
      const res = await api.get("/api/academics/classes/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setClasses(data);
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  }

  async function loadSessions() {
    try {
      const res = await api.get("/api/academics/sessions/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }

  async function loadExamSubjects() {
    if (!examId) return;
    try {
      const res = await api.get("/api/exams/exam-subjects/", {
        params: { exam: examId },
      });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setExamSubjects(data);
    } catch (err) {
      console.error("Failed to load exam subjects:", err);
    }
  }

  async function loadExam() {
    if (!examId) return;
    try {
      const res = await api.get(`/api/exams/exams/${examId}/`);
      setExam({
        name: res.data.name ?? "",
        exam_type: res.data.exam_type ?? "UNIT_TEST",
        school_class: res.data.school_class ?? "",
        session: res.data.session ?? "",
        start_date: res.data.start_date ?? "",
        end_date: res.data.end_date ?? "",
        room: res.data.room ?? "",
      });
      await loadExamSubjects();
    } catch (err) {
      console.error("Failed to load exam:", err);
      setError("Unable to load the examination. Please try again.");
    }
  }

  useEffect(() => {
    loadSubjects();
    loadClasses();
    loadSessions();
    loadExam();
  }, [examId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      name: exam.name,
      exam_type: exam.exam_type,
      school_class: exam.school_class,
      session: exam.session,
      start_date: exam.start_date,
      end_date: exam.end_date,
      room: exam.room,
    };

    try {
      if (examId) {
        await api.put(`/api/exams/exams/${examId}/`, payload);
        setSuccess(true);
        setLoading(false);
      } else {
        const res = await api.post("/api/exams/exams/", payload);
        // Exam created — move to its edit page so subjects can be assigned.
        navigate(`/admin/examinations/${res.data.id}/edit`);
        return;
      }
    } catch (err) {
      console.error("Failed to save exam:", err);
      setError(flattenErrors(err.response?.data, "Failed to save exam. Please try again."));
      setLoading(false);
    }
  };

  const [newSubject, setNewSubject] = useState({
    subject: "",
    max_marks: 100,
    passing_marks: 33,
    date: "",
  });
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjectError, setSubjectError] = useState("");

  const addSubject = async () => {
    if (!newSubject.subject || !examId) return;
    setAddingSubject(true);
    setSubjectError("");
    try {
      await api.post("/api/exams/exam-subjects/", {
        exam: Number(examId),
        subject: Number(newSubject.subject),
        max_marks: Number(newSubject.max_marks),
        passing_marks: Number(newSubject.passing_marks),
        date: newSubject.date || null,
      });
      setNewSubject({
        subject: "",
        max_marks: 100,
        passing_marks: 33,
        date: "",
      });
      await loadExamSubjects();
    } catch (err) {
      console.error("Failed to add subject:", err);
      setSubjectError(
        flattenErrors(err.response?.data, "Failed to add subject to the exam.")
      );
    } finally {
      setAddingSubject(false);
    }
  };

  const removeSubject = async (id) => {
    try {
      await api.delete(`/api/exams/exam-subjects/${id}/`);
      await loadExamSubjects();
    } catch (err) {
      console.error("Failed to remove subject:", err);
      setSubjectError(
        flattenErrors(err.response?.data, "Failed to remove the subject.")
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">
          {examId ? "Edit Exam" : "Create Exam"}
        </h1>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Exam Name
            </label>
            <input
              type="text"
              value={exam.name}
              onChange={(e) =>
                setExam({ ...exam, name: e.target.value })
              }
              required
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., Midterm Exam"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Exam Type
            </label>
            <select
              value={exam.exam_type}
              onChange={(e) => setExam({ ...exam, exam_type: e.target.value })}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="UNIT_TEST">Unit Test</option>
              <option value="MIDTERM">Midterm</option>
              <option value="FINAL">Final</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Class
              </label>
              <select
                value={exam.school_class}
                onChange={(e) =>
                  setExam({ ...exam, school_class: e.target.value })
                }
                required
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Session
              </label>
              <select
                value={exam.session}
                onChange={(e) =>
                  setExam({ ...exam, session: e.target.value })
                }
                required
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={exam.start_date}
              onChange={(e) => setExam({ ...exam, start_date: e.target.value })}
              required
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              End Date
            </label>
            <input
              type="date"
              value={exam.end_date}
              onChange={(e) => setExam({ ...exam, end_date: e.target.value })}
              required
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Room
            </label>
            <input
              type="text"
              value={exam.room}
              onChange={(e) =>
                setExam({ ...exam, room: e.target.value })
              }
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Exam room/hall"
            />
          </div>

          <button
            type="submit"
            className="mt-4 rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Saving..." : examId ? "Update Exam" : "Save Exam"}
          </button>
        </form>

        {/* Exam Subject Assignment Section — only once the exam exists */}
        {examId && (
          <div className="mt-6 pt-4 border-t">
            <h2 className="text-sm font-medium mb-3">Exam Subjects</h2>
            <p className="text-xs text-slate-500 mb-2">
              Assign subjects to this examination with max marks and passing marks.
            </p>

            {subjectError && (
              <div className="mb-2 p-2 rounded bg-red-50 text-red-700 text-xs">
                {subjectError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <select
                value={newSubject.subject}
                onChange={(e) => setNewSubject({ ...newSubject, subject: e.target.value })}
                className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
                disabled={loadingSubjects}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={newSubject.max_marks}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, max_marks: e.target.value })
                  }
                  min="1"
                  className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Max marks"
                />

                <input
                  type="number"
                  value={newSubject.passing_marks}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      passing_marks: e.target.value,
                    })
                  }
                  min="1"
                  className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Passing marks"
                />
              </div>

              <input
                type="date"
                value={newSubject.date}
                onChange={(e) => setNewSubject({ ...newSubject, date: e.target.value })}
                className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <button
                type="button"
                onClick={addSubject}
                className="rounded bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 inline-flex items-center gap-1.5 justify-center"
                disabled={!newSubject.subject || addingSubject}
              >
                <Plus size={14} /> {addingSubject ? "Adding..." : "Add Subject"}
              </button>
            </div>

            {examSubjects.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Assigned subjects:</p>
                <div className="space-y-1">
                  {examSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-2 rounded bg-slate-50 dark:bg-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <span>
                        {sub.subject_name
                          || subjects.find((s) => String(s.id) === String(sub.subject))?.name
                          || sub.subject}
                        &nbsp;|&nbsp;
                        {sub.max_marks} max &nbsp;|&nbsp; {sub.passing_marks} pass
                        {sub.date && <> &nbsp;|&nbsp; Date: {sub.date}</>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubject(sub.id)}
                        className="text-red-500 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="mt-3 p-3 rounded bg-green-50 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle size={12} /> Exam saved successfully.
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded bg-red-50 text-red-700 text-sm flex items-center gap-2">
            <XCircle size={12} /> {error}
          </div>
        )}
      </Card>
    </div>
  );
}
