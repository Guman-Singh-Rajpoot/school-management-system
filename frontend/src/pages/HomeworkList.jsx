import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function HomeworkList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classFilter = searchParams.get("class") || "";
  const sectionFilter = searchParams.get("section") || "";

  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const role = String(user?.role || "").toUpperCase();
  const canManage = ["ADMIN", "OWNER", "TEACHER"].includes(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT";

  function updateFilters(next) {
    const merged = { class: classFilter, section: sectionFilter, ...next };
    const params = new URLSearchParams();
    if (merged.class) params.set("class", merged.class);
    if (merged.section) params.set("section", merged.section);
    setSearchParams(params, { replace: true });
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (sectionFilter) params["section"] = sectionFilter;
      else if (classFilter) params["section__class_room"] = classFilter;
      const res = await api.get("/api/homework/", { params });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setHomework(data);
    } catch (err) {
      console.error("Failed to load homework:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to load homework. Please try again."
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
  }, [classFilter, sectionFilter]);

  useEffect(() => {
    async function loadOptions() {
      const [classRes, sectionRes] = await Promise.allSettled([
        api.get("/api/academics/classes/"),
        api.get("/api/academics/sections/"),
      ]);
      if (classRes.status === "fulfilled") {
        const data = classRes.value.data;
        setClasses(Array.isArray(data) ? data : data?.results || []);
      }
      if (sectionRes.status === "fulfilled") {
        const data = sectionRes.value.data;
        setSections(Array.isArray(data) ? data : data?.results || []);
      }
    }
    loadOptions();
  }, []);

  const visibleSections = sections.filter(
    (s) => !classFilter || String(s.class_room) === String(classFilter)
  );

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this homework?")) {
      return;
    }
    try {
      await api.delete(`/api/homework/${id}/`);
      await load();
    } catch (err) {
      console.error("Failed to delete homework:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to delete the homework."
      );
    }
  };

  const columns = [
    {
      key: "title",
      header: "Title",
    },
    {
      key: "subject_name",
      header: "Subject",
      render: (row) => row.subject_name || "-",
    },
    {
      key: "section",
      header: "Class/Section",
      render: (row) => row.section_name || "-",
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (row) => row.due_date || "-",
    },
    {
      key: "teacher_name",
      header: "Teacher",
      render: (row) => row.teacher_name || "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        if (!canManage) return null;

        return (
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/homework/${row.id}/edit`}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
              title="Edit homework"
            >
              <Pencil size={16} />
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(row.id)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
              title="Delete homework"
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
        <h1 className="text-2xl font-semibold">Homework Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Assign, view, and manage homework for classes and sections.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-medium">Homework</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={classFilter}
              onChange={(e) =>
                updateFilters({ class: e.target.value, section: "" })
              }
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(e) => updateFilters({ section: e.target.value })}
              className="rounded border p-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Sections</option>
              {visibleSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class_room_name ? `${s.class_room_name} - ${s.name}` : s.name}
                </option>
              ))}
            </select>

            {canManage && (
              <Link
                to="/admin/homework/create"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
              >
                <Plus size={16} /> Create Homework
              </Link>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={homework}
          loading={loading}
          emptyText={
            canManage
              ? "No homework found. Create one to get started."
              : isTeacher
              ? "No homework assigned to your classes yet."
              : isStudent
              ? "No homework for your class/section."
              : "No homework visible."
          }
        />
      </Card>

      <Card title="Access Notes">
        <p className="text-xs text-slate-500">
          ADMIN/Owner: manage all homework. Teachers: manage homework for their
          assigned classes. Students: view homework for their class and section.
        </p>
      </Card>
    </div>
  );
}
