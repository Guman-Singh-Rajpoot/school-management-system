import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Eye, Trash, Calendar } from "lucide-react";

export default function ExamDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [examSubjects, setExamSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  async function loadExam() {
    try {
      const res = await api.get(`/api/exams/exams/${id}/`);
      setExam(res.data);

      const subjRes = await api.get("/api/exams/exam-subjects/", {
        params: { exam: id },
      });
      const subjData = Array.isArray(subjRes.data)
        ? subjRes.data
        : subjRes.data?.results || [];
      setExamSubjects(subjData);
    } catch (err) {
      console.error("Failed to load exam:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to load exam details."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadExam();
    }
  }, [id]);

  if (!exam) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Exam Details</h1>
        {id ? <p className="text-slate-500">Loading exam...</p> : <p>Select an exam.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-2xl font-semibold">Exam Details</h1>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-medium">Exam Name</p>
            <p className="mt-1">{exam.name}</p>
          </div>
          <div>
            <p className="font-medium">Type</p>
            <p className="mt-1">
              {exam.get_exam_type_display ? exam.get_exam_type_display() : exam.exam_type}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-medium">Class</p>
            <p className="mt-1">{exam.school_class_name || exam.school_class?.name || "-"}</p>
          </div>
          <div>
            <p className="font-medium">Session</p>
            <p className="mt-1">{exam.session_name || exam.session?.name || "-"}</p>
          </div>
        </div>

        <div>
          <p className="font-medium">Dates</p>
          <p className="mt-1">
            {exam.start_date} - {exam.end_date}
          </p>
        </div>

        {exam.room && (
          <div>
            <p className="font-medium">Room</p>
            <p className="mt-1">{exam.room}</p>
          </div>
        )}

        <Card title="Exam Subjects">
          <DataTable
            columns={[
              { key: "subject", header: "Subject" },
              { key: "max_marks", header: "Max Marks" },
              { key: "passing_marks", header: "Passing Marks" },
              { key: "date", header: "Date" },
              { key: "actions", header: "Actions" },
            ]}
            rows={examSubjects.map((sub) => ({
              ...sub,
              subject_name: sub.subject_name || "-",
            }))}
            loading={loading}
            emptyText="No subjects assigned to this exam."
          />
        </Card>
      </Card>

      {canManage && (
        <div>
          <Link
            to "/admin/examinations/" + id + "/edit"
            className="mr-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm text-brand-600"
            title="Edit exam"
          >
            <Eye size={16} /> Edit
          </Link>
          <Link
            onClick={
              () =>
                window.confirm(
                  "Are you sure you want to delete this exam?"
                )
            }
            className="ml-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500"
            title="Delete exam"
          >
            <Trash size={16} /> Delete
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}