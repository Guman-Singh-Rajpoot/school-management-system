import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useRouter } from "react-router-dom";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Users, Calendar, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function ExamCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Preserve existing exam ID if editing
  const router = useRouter();
  const examId = router.query.id || null;

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

  async function loadExam() {
    if (!examId) return;
    try {
      const res = await api.get(`/api/exams/exams/${examId}/`);
      setExam({
        name: res.data.name,
        exam_type: res.data.exam_type,
        school_class: res.data.school_class?.id || "",
        session: res.data.session?.id || "",
        start_date: res.data.start_date,
        end_date: res.data.end_date,
        room: res.data.room || "",
      });
      // Load existing exam subjects
      const subjRes = await api.get("/api/exams/exam-subjects/", {
        params: { exam: examId },
      });
      const subjData = Array.isArray(subjRes.data)
        ? subjRes.data
        : subjRes.data?.results || [];
      setExamSubjects(subjData);
    } catch (err) {
      console.error("Failed to load exam:", err);
    }
  }

  useEffect(() => {
    loadSubjects();
    loadExam();
  }, [examId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create or update exam
      let examData;
      if (examId) {
        examData = await api.put(`/api/exams/exams/${examId}/`, {
          name: exam.name,
          exam_type: exam.exam_type,
          school_class: exam.school_class,
          session: exam.session,
          start_date: exam.start_date,
          end_date: exam.end_date,
          room: exam.room,
        });
      } else {
        examData = await api.post("/api/exams/exams/", {
          name: exam.name,
          exam_type: exam.exam_type,
          school_class: exam.school_class,
          session: exam.session,
          start_date: exam.start_date,
          end_date: exam.end_date,
          room: exam.room,
        });
      }

      setSuccess(true);
      load();
      navigate("/admin/examinations");
    } catch (err) {
      console.error("Failed to save exam:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to save exam. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Add exam subject
  const [newSubject, setNewSubject] = useState({
    subject: "",
    max_marks: 100,
    passing_marks: 33,
    date: "",
  });

  const addSubject = async () => {
    if (!newSubject.subject || !examId) return;
    try {
      await api.post("/api/exams/exam-subjects/", {
        exam: examId,
        subject: newSubject.subject,
        max_marks: Number(newSubject.max_marks),
        passing_marks: Number(newSubject.passing_marks),
        date: newSubject.date,
      });
      setExamSubjects((prev) => [...prev, { ...newSubject, id: uuidv4() }]);
      setNewSubject({
        subject: "",
        max_marks: 100,
        passing_marks: 33,
        date: "",
      });
      load();
    } catch (err) {
      console.error("Failed to add subject:", err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">
          {examId ? "Edit Exam" : "Create Exam"}
        </h1>

        {/* Exam Form */}
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Exam Name
            </label>
            <input
              type="text"
              value={exam.name}
              onChange={(e) =>
                setExam({ ...exam, name: e.target.value.trim() })
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
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select class</option>
                {/* Subjects will populate classes */}
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
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select session</option>
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
                setExam({ ...exam, room: e.target.value.trim() })
              }
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Exam room/hall"
            />
          </div>

          <button
            type="submit"
            className="mt-4 rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Exam"}
          </button>
        </form>

        {/* Exam Subject Assignment Section */}
        {examId && (
          <div className="mt-6 pt-4 border-t">
            <h2 className="text-sm font-medium mb-3">Exam Subjects</h2>
            <p className="text-xs text-slate-500 mb-2">
              Assign subjects to this examination with max marks and passing marks.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <select
                value={newSubject.subject}
                onChange={(e) => setNewSubject({ ...newSubject, subject: e.target.value })}
                className="rounded border p-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={newSubject.max_marks}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, max_marks: Number(e.target.value) })
                }
                min="1"
                className="rounded border p-1 w-20 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Max marks"
              />

              <input
                type="number"
                value={newSubject.passing_marks}
                onChange={(e) =>
                  setNewSubject({
                    ...newSubject,
                    passing_marks: Number(e.target.value),
                  })
                }
                min="1"
                className="rounded border p-1 w-20 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Passing marks"
              />

              <input
                type="date"
                value={newSubject.date}
                onChange={(e) => setNewSubject({ ...newSubject, date: e.target.value })}
                className="rounded border p-1 w- full focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <button
                onClick={addSubject}
                className="mt-2 rounded bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 transition disabled:opacity-50"
                disabled={!newSubject.subject || !examId}
              >
                <Plus size={14} /> Add Subject
              </button>
            </div>

            {/* Existing exam subjects list */}
            {examSubjects.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Assigned subjects:</p>
                <div className="space-y-1">
                  {examSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-2 rounded bg-slate-50 dark:bg-slate-800 text-xs"
                    >
                      {subjects.find((s) => s.id === sub.subject)?.name || sub.subject}
                      &nbsp;|
                      {sub.max_marks} max &nbsp;| &nbsp;{sub.passing_marks} pass
                      {sub.date && ` &nbsp;| &nbsp;Date: ${sub.date}`}
                      <span
                        onClick={() => {
                          // Remove subject - call delete endpoint
                          api.delete(`/api/exams/exam-subjects/${sub.id}/`);
                          setExamSubjects(
                            examSubjects.filter((s) => s.id !== sub.id)
                          );
                        }}
                        className="text-red-500 cursor-pointer underline"
                      >
                        Remove
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="mt-3 p-3 rounded bg-green-50 text-green-700 text-sm">
            <CheckCircle size={12} /> Exam saved successfully.
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded bg-red-50 text-red-700 text-sm">
            <XCircle size={12} /> {error}
          </div>
        )}
      </Card>
    </div>
  );
}