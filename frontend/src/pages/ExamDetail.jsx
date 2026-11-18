import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Pencil, Trash2 } from "lucide-react";

export default function ExamDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [examSubjects, setExamSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  async function loadExam() {
    try {
      setLoading(true);
      setError("");
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

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this exam?")) {
      return;
    }
    try {
      await api.delete(`/api/exams/exams/${id}/`);
      navigate("/admin/examinations");
    } catch (err) {
      console.error("Failed to delete exam:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to delete the exam."
      );
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Exam Details</h1>
        <p className="text-slate-500">Loading exam...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-8">
        <h1 className="text-xl">Exam Details</h1>
        <p className="text-slate-500">Exam not found or unable to load.</p>
        {error && (
          <p className="mt-2 text-red-600 text-sm">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold">Exam Details</h1>
          {canManage && (
            <div className="flex items-center gap-2">
              <Link
                to={`/admin/examinations/${id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Edit exam"
              >
                <Pencil size={16} /> Edit
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Delete exam"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 my-4">
          <div>
            <p className="font-medium">Exam Name</p>
            <p className="mt-1">{exam.name}</p>
          </div>
          <div>
            <p className="font-medium">Type</p>
            <p className="mt-1">{exam.exam_type}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-medium">Class</p>
            <p className="mt-1">{exam.school_class_name || "-"}</p>
          </div>
          <div>
            <p className="font-medium">Session</p>
            <p className="mt-1">{exam.session_name || "-"}</p>
          </div>
        </div>

        <div>
          <p className="font-medium">Dates</p>
          <p className="mt-1">
            {exam.start_date} - {exam.end_date}
          </p>
        </div>

        {exam.room && (
          <div className="mt-4">
            <p className="font-medium">Room</p>
            <p className="mt-1">{exam.room}</p>
          </div>
        )}
      </Card>

      <Card title="Exam Subjects">
        <DataTable
          columns={[
            { key: "subject_name", header: "Subject" },
            { key: "max_marks", header: "Max Marks" },
            { key: "passing_marks", header: "Passing Marks" },
            {
              key: "date",
              header: "Date",
              render: (row) => row.date || "-",
            },
          ]}
          rows={examSubjects}
          loading={loading}
          emptyText="No subjects assigned to this exam."
        />
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
