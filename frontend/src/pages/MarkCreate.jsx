import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import Card from "../components/Card";
import { CheckCircle, XCircle } from "lucide-react";

function flattenErrors(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.detail === "string") return data.detail;
  return (
    Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ") || fallback
  );
}

export default function MarkCreate() {
  const navigate = useNavigate();
  // /admin/marks/create            -> create (optionally ?exam=<examId>)
  // /admin/marks/:id/edit          -> edit
  const { id: markId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const examIdParam = searchParams.get("exam") || "";

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
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
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(examIdParam);

  async function fetchExamSubjects(examId) {
    if (!examId) return [];
    const res = await api.get("/api/exams/exam-subjects/", {
      params: { exam: examId },
    });
    return Array.isArray(res.data) ? res.data : res.data?.results || [];
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingData(true);
      setError("");
      try {
        const [studentsRes, gradesRes, examsRes] = await Promise.allSettled([
          api.get("/api/students/", { params: { page_size: 200 } }),
          api.get("/api/exams/grades/"),
          api.get("/api/exams/exams/"),
        ]);

        if (cancelled) return;

        if (studentsRes.status === "fulfilled") {
          const data = studentsRes.value.data;
          setStudents(Array.isArray(data) ? data : data?.results || []);
        }
        if (gradesRes.status === "fulfilled") {
          const data = gradesRes.value.data;
          setGrades(Array.isArray(data) ? data : data?.results || []);
        }
        if (examsRes.status === "fulfilled") {
          const data = examsRes.value.data;
          setExams(Array.isArray(data) ? data : data?.results || []);
        }

        if (markId) {
          const markRes = await api.get(`/api/exams/marks/${markId}/`);
          const fetched = markRes.data;
          if (cancelled) return;

          // Load the subject list for the exam this mark belongs to so
          // the dropdown is populated, then preselect the current values.
          let subjectList = [];
          try {
            const subjRes = await api.get(
              `/api/exams/exam-subjects/${fetched.exam_subject}/`
            );
            subjectList = await fetchExamSubjects(subjRes.data.exam);
          } catch (err) {
            console.error("Failed to load exam subjects for mark:", err);
          }
          if (cancelled) return;

          setExamSubjects(subjectList);
          setMark({
            student: fetched.student ?? "",
            exam_subject: fetched.exam_subject ?? "",
            marks_obtained: fetched.marks_obtained ?? "",
            grade: fetched.grade ?? "",
            remarks: fetched.remarks ?? "",
          });
        } else if (selectedExam) {
          const subjectList = await fetchExamSubjects(selectedExam);
          if (cancelled) return;
          setExamSubjects(subjectList);
        }
      } catch (err) {
        console.error("Failed to load mark form data:", err);
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              err.response?.data?.message ||
              "Unable to load the mark form. Please try again."
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
  }, [markId, selectedExam]);

  const handleExamChange = (value) => {
    setSelectedExam(value);
    setMark((prev) => ({ ...prev, exam_subject: "" }));
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("exam", value);
    } else {
      params.delete("exam");
    }
    setSearchParams(params, { replace: true });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (markId) {
        await api.patch(`/api/exams/marks/${markId}/`, {
          marks_obtained: mark.marks_obtained,
          grade: mark.grade || null,
          remarks: mark.remarks,
        });
      } else {
        await api.post("/api/exams/marks/", {
          student: mark.student,
          exam_subject: mark.exam_subject,
          marks_obtained: mark.marks_obtained,
          grade: mark.grade || null,
          remarks: mark.remarks,
        });
      }

      setSuccess(true);
      navigate("/admin/marks");
    } catch (err) {
      console.error("Failed to save mark:", err);
      setError(
        flattenErrors(err.response?.data, "Failed to save mark. Please try again.")
      );
      setLoading(false);
    }
  };

  const editing = Boolean(markId);

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">
          {editing ? "Edit Mark" : "Enter Mark"}
        </h1>

        {loadingData && (
          <p className="mt-2 text-sm text-slate-500">Loading form data…</p>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Student
            </label>
            <select
              value={mark.student}
              onChange={(e) => setMark({ ...mark, student: e.target.value })}
              required
              disabled={editing || loadingData}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.admission_number}
                </option>
              ))}
            </select>
          </div>

          {!editing && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Examination
              </label>
              <select
                value={selectedExam}
                onChange={(e) => handleExamChange(e.target.value)}
                required
                disabled={loadingData}
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} ({exam.exam_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Examination Subject
            </label>
            <select
              value={mark.exam_subject}
              onChange={(e) => setMark({ ...mark, exam_subject: e.target.value })}
              required
              disabled={editing || loadingData}
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            >
              <option value="">Select exam subject</option>
              {examSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_name || sub.subject}
                  {sub.max_marks ? ` (Max ${sub.max_marks})` : ""}
                </option>
              ))}
            </select>
            {!editing && selectedExam && examSubjects.length === 0 && !loadingData && (
              <p className="text-xs text-amber-600 mt-1">
                No subjects have been assigned to this exam yet.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Marks Obtained
              </label>
              <input
                type="number"
                step="0.01"
                value={mark.marks_obtained}
                onChange={(e) =>
                  setMark({ ...mark, marks_obtained: e.target.value })
                }
                required
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
                value={mark.grade ?? ""}
                onChange={(e) => setMark({ ...mark, grade: e.target.value })}
                className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">No grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
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
                setMark({ ...mark, remarks: e.target.value })
              }
              rows="2"
              className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., Good performance"
            ></textarea>
          </div>

          <button
            type="submit"
            className="mt-4 rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50"
            disabled={loading || loadingData}
          >
            {loading ? "Saving..." : editing ? "Update Mark" : "Save Mark"}
          </button>
        </form>
      </Card>

      {success && (
        <div className="mt-3 p-3 rounded bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle size={12} /> Mark saved successfully.
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded bg-red-50 text-red-700 text-sm flex items-center gap-2">
          <XCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
