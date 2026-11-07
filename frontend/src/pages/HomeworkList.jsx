import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Plus, Eye, Trash, Calendar, Users } from "lucide-react";
import Modal from "../components/Modal";
import { useRouter } from "react-router-dom";

export default function HomeworkList() {
  const { user } = useAuth();
  const router = useRouter();
  const classId = router.query.classId || null;
  const sectionId = router.query.sectionId || null;

  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  const isTeacher = ["TEACHER"].includes(String(user?.role || "").toUpperCase());
  const isStudent = ["STUDENT"].includes(String(user?.role || "").toUpperCase());

  async function load() {
    try {
      setLoading(true);
      setError("");
      let url = "/api/homework/";
      const params = new URLSearchParams();

      if (classId) params.append("section", classId);
      if (sectionId) params.append("section", sectionId);

      const res = await api.get(url, { params });
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
  }, [classId, sectionId]);

  const columns = [
    {
      key: "title",
      header: "Title",
    },
    {
      key: "subject_name",
      header: "Subject",
    },
    {
      key: "section",
      header: "Class/Section",
      render: (row) =>
        row.section_name || row.section?.name || "-",
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
        const buttons = [];

        if (canManage) {
          buttons.push(
            <Link
              key="view"
              to "/admin/homework/" + row.id
              className="mr-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
              title="View homework"
            >
              <Eye size={16} />
            </Link>
          );
          buttons.push(
            <Link
              key="edit"
              to `/admin/homework/create/${row.id}`
              className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
              title="Edit homework"
            >
              <Trash size={16} />
            </Link>
          );
        }

        if (isTeacher) {
          // Teachers can view their own homework
          if (row.teacher && row.teacher.user === user) {
            buttons.push(
              <Link
                key="edit"
                to "/admin/homework/" + row.id
                className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
                title="View/Edit"
              >
                <Eye size={16} />
              </Link>
            );
          }
        }

        if (isStudent) {
          // Students can view homework for their class/section
          const rowSection = row.section?.id;
          const userSection = user.student_profile?.section?.id;
          if (rowSection === userSection) {
            buttons.push(
              <Link
                key="submit"
                to "/student/homework/" + row.id
                className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-green-600"
                title="Submit"
              >
                <Plus size={16} />
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
        <h1 className="text-2xl font-semibold">Homework Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Assign, view, and manage homework for classes and sections.
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
          rows={homework}
          loading={loading}
          emptyText={
            canManage
              ? "No homework found. Create new homework using the form below."
              : isTeacher
              ? "No homework assigned to your classes yet."
              : isStudent
              ? "No homework for your class/section."
              : "No homework visible."
          }
        />
      </Card>

      {/* Create homework form for Admin/Owner/Teacher */}
      {canManage && (
        <Modal
          open={false}
          onClose={() => {}}
          title="Create Homework"
          wide
        >
          <div className="grid grid-cols-2 gap-4">
            <select
              className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select class</option>
              {/* Classes would be populated */}
            </select>

            <select
              className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select section</option>
            </select>
          </div>

          <select
            className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select subject</option>
          </select>

          <input
            type="text"
            placeholder="Homework title"
            className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder="Description"
            className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="date"
            className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            className="rounded border p-2 w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Due date option</option>
          </select>

          <div className="mt-4">
            <button
              className="rounded bg-brand-600 px-4 py-2 text-white font-medium hover:bg-brand-700 transition"
            >
              Create Homework
            </button>
          </div>
        </Modal>
      )}

      <Card title="Access Notes">
        <p className="text-xs text-slate-500">
          ADMIN/Owner: manage all homework. Teachers: view homework for assigned classes.
          Students: view homework for their class and submit submissions.
        </p>
      </Card>
    </div>
  );
}