import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function MarksList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const examFilter = searchParams.get("exam") || "";
  const studentFilter = searchParams.get("student") || "";

  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = ["ADMIN", "OWNER", "TEACHER"].includes(
    String(user?.role || "").toUpperCase()
  );

  function updateFilters(next) {
    const merged = { exam: examFilter, student: studentFilter, ...next };
    const params = new URLSearchParams();
    if (merged.exam) params.set("exam", merged.exam);
    if (merged.student) params.set("student", merged.student);
    setSearchParams(params, { replace: true });
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (examFilter) params["exam_subject__exam"] = examFilter;
      if (studentFilter) params["student"] = studentFilter;
      const res = await api.get("/api/exams/marks/", { params });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setMarks(data);
    } catch (err) {
      console.error("Failed to load marks:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to load marks. Please try again."
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
  }, [examFilter, studentFilter]);

  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      const [examRes, studentRes] = await Promise.allSettled([
        api.get("/api/exams/exams/"),
        api.get("/api/students/", { params: { page_size: 100 } }),
      ]);
      if (examRes.status === "fulfilled") {
        const data = Array.isArray(examRes.value.data)
          ? examRes.value.data
          : examRes.value.data?.results || [];
        setExams(data);
      }
      if (studentRes.status === "fulfilled") {
        const data = Array.isArray(studentRes.value.data)
          ? studentRes.value.data
          : studentRes.value.data?.results || [];
        setStudents(data);
      }
    }
    loadOptions();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this mark?")) {
      return;
    }
    try {
      await api.delete(`/api/exams/marks/${id}/`);
      await load();
    } catch (err) {
      console.error("Failed to delete mark:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to delete the mark."
      );
    }
  };

  const columns = [
    {
      key: "student_name",
      header: "Student",
      render: (row) => row.student_name || "-",
    },
    {
      key: "subject_name",
      header: "Subject",
      render: (row) => row.subject_name || "-",
    },
    {
      key: "exam_name",
      header: "Exam",
      render: (row) => row.exam_name || "-",
    },
    {
      key: "marks_obtained",
      header: "Marks Obtained",
    },
    {
      key: "max_marks",
      header: "Max Marks",
    },
    {
      key: "percentage",
      header: "Percentage",
      render: (row) => {
        const percentage =
          row.marks_obtained && row.max_marks
            ? ((Number(row.marks_obtained) / Number(row.max_marks)) * 100).toFixed(2)
            : null;
        return percentage ? `${percentage}%` : "-";
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        if (!canManage) return null;

        return (
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/marks/${row.id}/edit`}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
              title="Edit mark"
            >
              <Pencil size={16} />
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(row.id)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
              title="Delete mark"
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
        <h1 className="text-2xl font-semibold">Marks Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Enter and view student marks per subject and examination.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-medium">Student Marks</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={examFilter}
              onChange={(e) => updateFilters({ exam: e.target.value })}
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.exam_type})
                </option>
              ))}
            </select>

            <select
              value={studentFilter}
              onChange={(e) => updateFilters({ student: e.target.value })}
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.admission_number}
                </option>
              ))}
            </select>

            {canManage && (
              <Link
                to={
                  examFilter
                    ? `/admin/marks/create?exam=${examFilter}`
                    : "/admin/marks/create"
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
              >
                <Plus size={16} /> Enter Marks
              </Link>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={marks}
          loading={loading}
          emptyText={
            canManage
              ? "No marks found. Enter marks using the button above."
              : "No marks visible."
          }
        />
      </Card>

      <Card title="Results Overview">
        <p className="text-sm text-slate-500">
          ADMIN and OWNER can enter marks for any student. Teachers can enter marks
          for their assigned classes and subjects. Students can view their own report
          cards.
        </p>
      </Card>
    </div>
  );
}
