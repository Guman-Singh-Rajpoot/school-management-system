import { useEffect, useState } from "react";
import { useParams, useReactive } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Plus, Eye, Trash, Calendar, GraduationCap } from "lucide-react";
import Modal from "../components/Modal";
import MarkCreate from "./MarkCreate";
import ReportCard from "./ReportCard";

export default function MarksList() {
  const { user } = useAuth();
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  const canManage =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  async function load() {
    try {
      setLoading(true);
      setError("");
      let url = "/api/exams/marks/";
      const params = new URLSearchParams();
      if (examFilter) params.append("exam_subject", examFilter);
      if (studentFilter) params.append("student", studentFilter);
      if (params.toString()) {
        url += "?" + params.toString();
      }
      const res = await api.get(url);
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

  // Load available exams and students for filters
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [examRes, studentRes] = await Promise.allSettled([
          api.get("/api/exams/exams/"),
          api.get("/api/students/", { params: { page_size: 100 } }),
        ]);
        if (examRes.status === "fulfilled") {
          const data = Array.isArray(examRes.data)
            ? examRes.data
            : examRes.data?.results || [];
          setExams(data);
        }
        if (studentRes.status === "fulfilled") {
          const data = Array.isArray(studentRes.data)
            ? studentRes.data
            : studentRes.data?.results || [];
          setStudents(data);
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      }
    }
    loadOptions();
  }, []);

  const columns = [
    {
      key: "student_name",
      header: "Student",
      render: (row) => row.student_name || `${row.student?.first_name || ''} ${row.student?.last_name || ''}`.trim() || row.student?.admission_number || "-",
    },
    {
      key: "subject_name",
      header: "Subject",
    },
    {
      key: "exam_subject_name",
      header: "Exam",
      render: (row) => row.exam_subject_name || "-",
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
        const percentage = row.marks_obtained && row.max_marks
          ? ((Number(row.marks_obtained) / Number(row.max_marks)) * 100).toFixed(2)
          : "-";
        return `${percentage}%`;
      },
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
              to "/admin/marks/" + row.id
              className="mr-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm text-brand-600"
              title="View mark"
            >
              <Eye size={16} />
            </Link>
          );
          buttons.push(
            <Link
              key="edit"
              to "/admin/marks/create/" + row.id
              className="ml-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
              title="Edit mark"
            >
              <Trash size={16} />
            </Link>
          );
        }

        return <div className="flex items-center gap-1">{buttons}</div>;
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

      {/* API Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Student Marks</h2>
          {canManage && (
            <Link
              to="/admin/marks/create"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
            >
              <Plus size={16} /> Enter Marks
            </Link>
          )}
          <div className="flex gap-2">
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="rounded border p-1 w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              onChange={(e) => setStudentFilter(e.target.value)}
              className="rounded border p-1 w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.admission_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={marks}
          loading={loading}
          emptyText={
            canManage
              ? "No marks found. Enter marks using the form above."
              : "No marks visible."
          }
        />
      </Card>

      {/* Marks Enter Form - visible to Admin/Owner */}
      {canManage && (
        <Modal
          open={false}
          onClose={() => {}}
          title="Enter Marks"
          wide
        >
          <MarkCreate onCancel={() => {}} onCreated={() => load()} />
        </Modal>
      )}

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