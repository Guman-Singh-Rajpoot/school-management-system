import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useRouter } from "react-router-dom";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { Users, Calendar, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function MarkCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const examId = router.query.examId || null;
  const markId = router.query.markId || null;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [mark, setMark] = useState({
    student: "",
    exam_subject: "",
    marks_obtained: "",
    grade: "",
    remarks: "",
  });

  const [students, setStudents] = useState([]);
  const [examSubjects, setExamSubjects] = useState([]);
  const [grades, setGrades] = useState([]);

  async function loadStudents() {
    try {
      const res = await api.get("/api/students/", { params: { page_size: 200 } });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setStudents(data);
    } catch (err) {
      console.error("Failed to load students:", err);
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

  async function loadGrades() {
    try {
      const res = await api.get("/api/exams/grades/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setGrades(data);
    } catch (err) {
      console.error("Failed to load grades:", err);
    }
  }

  useEffect(() => {
    loadStudents();
    loadExamSubjects();
    loadGrades();
  }, [examId]);

  if (!students.length || !examSubjects.length) {
    return (
      <div className="p-8">
        <h2>Loading mark entry form...</h2>
        <p>Please wait while data loads.</p>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (markId) {
        await api.patch(`/api/exams/marks/${markId}/`, {
          marks_obtained: mark.marks_obtained,
          grade: mark.grade,
          remarks: mark.remarks,
        });
      } else {
        await api.post("/api/exams/marks/", {
          student: mark.student,
          exam_subject: mark.exam_subject,
          marks_obtained: mark.marks_obtained,
          grade: mark.grade,
          remarks: mark.remarks,
        });
      }

      setSuccess(true);
      navigate("/admin/marks");
    } catch (err) {
      console.error("Failed to save mark:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to save mark. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">
          {markId ? "Edit Mark" : "Enter Mark"}
        </h1>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Student
            </label>
            <select
              value={mark.student}
              onChange={(e) => setMark({ ...mark, student: e.target.value })}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.admission_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Examination Subject
            </label>
            <select
              value={mark.exam_subject}
              onChange={(e) => setMark({ ...mark, exam_subject: e.target.value })}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select exam subject</option>
              {examSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_name || sub.subject} - {examId ? "Exam" : "Subject"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Marks Obtained
              </label>
              <input
                type="number"
                value={mark.marks_obtained}
                onChange={(e) =>
                  setMark({ ...mark, marks_obtained: e.target.value.trim() })
                }
                min="0"
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., 75"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Grade
              </label>
              <select
                value={mark.grade}
                onChange={(e) => setMark({ ...mark, grade: e.target.value })}
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select grade</option>
                {/* Grades will be populated from the API */}
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Remarks
            </label>
            <textarea
              value={mark.remarks}
              onChange={(e) =>
                setMark({ ...mark, remarks: e.target.value.trim() })
              }
              rows="2"
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., Good performance"
            ></textarea>
          </div>

          <button
            type="submit"
            className="mt-4 rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Mark"}
          </button>
        </form>
      </Card>

      {success && (
        <div className="mt-3 p-3 rounded bg-green-50 text-green-700 text-sm">
          <CheckCircle size={12} /> Mark saved successfully.
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded bg-red-50 text-red-700 text-sm">
          <XCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}