import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Plus, Eye, Pencil } from "lucide-react";

export default function ExaminationsList() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/exams/exams/");
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setExams(data);
    } catch (err) {
      console.error("Failed to load exams:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to load exams. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const columns = [
    {
      key: "name",
      header: "Exam Name",
    },
    {
      key: "exam_type",
      header: "Type",
    },
    {
      key: "school_class",
      header: "Class",
      render: (row) => row.school_class_name || "-",
    },
    {
      key: "session",
      header: "Session",
      render: (row) => row.session_name || "-",
    },
    {
      key: "start_date",
      header: "Start Date",
      render: (row) => row.start_date || "-",
    },
    {
      key: "end_date",
      header: "End Date",
      render: (row) => row.end_date || "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        if (!canManage) return null;

        return (
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/examinations/${row.id}`}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
              title="View exam"
            >
              <Eye size={16} />
            </Link>
            <Link
              to={`/admin/examinations/${row.id}/edit`}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
              title="Edit exam"
            >
              <Pencil size={16} />
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Examinations</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Exam calendar and management.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Exam List</h2>
          {canManage && (
            <Link
              to="/admin/examinations/create"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
            >
              <Plus size={16} /> Create Exam
            </Link>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={exams}
          loading={loading}
          emptyText={
            canManage
              ? "No examinations found. Create one above."
              : "No examinations visible."
          }
        />
      </Card>

      <Card title="Exam Quick Stats">
        <p className="text-sm text-slate-500">
          Both ADMIN and OWNER roles have full examination management access.
        </p>
      </Card>
    </div>
  );
}
