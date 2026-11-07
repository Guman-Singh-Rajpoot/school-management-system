import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Calendar, Users, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "react-router-dom";

export default function TimetableList() {
  const { user } = useAuth();
  const router = useRouter();
  const sectionId = router.query.sectionId || null;
  const teacherId = router.query.teacherId || null;

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdminOwner =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());
  const isTeacher = ["TEACHER"].includes(String(user?.role || "").toUpperCase());
  const isStudent = ["STUDENT"].includes(String(user?.role || "").toUpperCase());

  async function load() {
    try {
      setLoading(true);
      setError("");
      let url = "/api/timetable/";
      const params = new URLSearchParams();

      if (sectionId) params.append("section", sectionId);
      if (teacherId) params.append("teacher", teacherId);

      const res = await api.get(url, { params });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setSlots(data);
    } catch (err) {
      console.error("Failed to load timetable:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to load timetable. Please try again."
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
  }, [sectionId, teacherId]);

  const columns = [
    {
      key: "day_display",
      header: "Day",
    },
    {
      key: "subject_name",
      header: "Subject",
    },
    {
      key: "teacher_name",
      header: "Teacher",
    },
    {
      key: "section_name",
      header: "Class/Section",
      render: (row) => row.section_name || row.section?.name || "-",
    },
    {
      key: "start_time",
      header: "Start",
      render: (row) => row.start_time || "-",
    },
    {
      key: "end_time",
      header: "End",
      render: (row) => row.end_time || "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const buttons = [];

        if (isAdminOwner) {
          buttons.push(
            <Link
              key="edit"
              to `/admin/timetable/` + row.id
              className="mr-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
              title="Edit slot"
            >
              <Eye size={16} />
            </Link>
          );
          buttons.push(
            <button
              onClick={() =>
                window.confirm("Are you sure you want to delete this slot?")
              }
              className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-red-500"
              title="Delete slot"
            >
              <XCircle size={16} />
            </button>
          );
        }

        if (isTeacher) {
          const teacher = user.teacher_profile;
          if (teacher && row.teacher && row.teacher.id === teacher.id) {
            buttons.push(
              <Link
                key="view"
to "/admin/timetable/" + row.id
                className="mr-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
                title="View schedule"
              >
                <Eye size={16} />
              </Link>
            );
          }
        }

        if (isStudent) {
          const student = user.student_profile;
          if (student && row.section && row.section.id === student.section.id) {
            buttons.push(
              <Link
                key="view"
                to "/student/timetable/" + row.id
                className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-green-600"
                title="View timetable"
              >
                <Eye size={16} />
              </Link>
            );
          }
        }

        return <div className="flex items-center gap-1">{buttons}</div>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timetable Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          View and manage weekly timetable slots.
        </p>
      </div>

      {/* API Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <DataTable
          columns={columns}
          rows={slots}
          loading={loading}
          emptyText={
            isAdminOwner
              ? "No timetable slots found. Create one above."
              : isTeacher
              ? "No slots for your schedule."
              : isStudent
              ? "No timetable for your class."
              : "No timetable visible."
          }
        />
      </Card>

      {/* Create timetable slot for Admin/Owner */}
      {isAdminOwner && (
        <Card>
          <p className="text-xs text-slate-500">
            Use the API directly to create timetable slots via POST /api/timetable/ with:
            section, subject, teacher, day_of_week (0-6), start_time, end_time.
          </p>
        </Card>
      )}

      <Card title="Filter">
        <select
          onChange={(e) => {
            // Filter by section
          }}
          className="rounded border p-2 w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Classes</option>
          {/* Sections would be populated */}
        </select>

        <select
          onChange={(e) => {
            // Filter by teacher
          }}
          className="rounded border p-2 w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Teachers</option>
        </select>
      </Card>
    </div>
  );
}