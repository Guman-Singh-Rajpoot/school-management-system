import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { FolderOpen, Upload, Eye, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DocumentsList() {
  const { user } = useAuth();
  const { id: studentId, teacherId } = useParams();
  const [searchParams] = useSearchParams();
  const [listType, setListType] = useState(
    studentId ? "student" : teacherId ? "teacher" : "all"
  );
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isStudent = ["STUDENT"].includes(String(user?.role || "").toUpperCase());
  const isTeacher = ["TEACHER"].includes(String(user?.role || "").toUpperCase());
  const isAdminOwner =
    ["ADMIN", "OWNER"].includes(String(user?.role || "").toUpperCase());

  async function load() {
    try {
      setLoading(true);
      setError("");
      let url = "/api/documents/generated/";
      const params = new URLSearchParams();

      if (listType === "student" && studentId) {
        params.append("student", studentId);
      } else if (listType === "teacher" && teacherId) {
        url = "/api/teachers/documents/";
        // Teacher documents are filtered separately
        const res = await api.get(url);
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setDocuments(data);
        return;
      }

      if (searchParams.get("document_type")) {
        params.append("document_type", searchParams.get("document_type"));
      }

      const res = await api.get(url, { params });
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setDocuments(data);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to load documents. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [studentId, teacherId, listType, searchParams]);

  const columns = [
    {
      key: "doc_type",
      header: "Document Type",
      render: (row) =>
        row.get_doc_type_display || row.doc_type || "-",
    },
    {
      key: "file_name",
      header: "File Name",
      render: (row) => row.file?.name || row.file_name || "-",
    },
    {
      key: "uploaded_by",
      header: "Uploaded By",
      render: (row) =>
        row.uploaded_by_name || row.uploaded_by?.get_full_name || "-",
    },
    {
      key: "uploaded_at",
      header: "Uploaded On",
      render: (row) => row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString() : "-",
    },
    {
      key: "verified",
      header: "Verified",
      render: (row) => {
        if (row.verified === true) return <span className="bg-emerald-500 text-white text-xs font-medium rounded px-1.5 py-0.5">Yes</span>;
        if (row.verified === false) return <span className="bg-rose-500 text-white text-xs font-medium rounded px-1.5 py-0.5">No</span>;
        return "-";
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const buttons = [];

        if (isAdminOwner) {
          buttons.push(
            <Link
              key="view"
              to "/admin/students/" + studentId + "/documents/" + row.id
              className="mr-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
              title="View document"
            >
              <Eye size={14} />
            </Link>
          );
          buttons.push(
            <button
              onClick={() => window.confirm("Are you sure you want to delete this document?")}
              className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-red-500"
              title="Delete document"
            >
              <Trash2 size={14} />
            </button>
          );
        } else if (isStudent && row.student && row.student.user === user) {
          buttons.push(
            <Link
              key="view"
              href={row.file?.url || "#"}
              className="mr-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-brand-600"
              title="View document"
            >
              <Eye size={14} />
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
        <h1 className="text-2xl font-semibold">
          {listType === "student"
            ? `Student Documents - ${studentId ? "Loading..." : "N/A"}`
            : listType === "teacher"
            ? `Teacher Documents - ${teacherId ? "Loading..." : "N/A"}`
            : "Documents"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Manage and view school documents.
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
          rows={documents}
          loading={loading}
          emptyText={
            isStudent
              ? "No documents found for this student."
              : isTeacher
              ? "No documents found for this teacher."
              : "No documents found."
          }
        />
      </Card>

      {/* Upload modal for Admin/Owner */}
      {isAdminOwner && listType !== "teacher" && (
        <Modal
          open={false}
          onClose={() => {}}
          title="Upload Document"
          wide
        >
          <div className="space-y-4">
            <select
              className="rounded border p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              onChange={(e) => {
                // Handle doc type selection
              }}
            >
              <option value="AADHAAR">Aadhaar</option>
              <option value="BIRTH_CERT">Birth Certificate</option>
              <option value="TRANSFER_CERT">Transfer Certificate</option>
              <option value="MIGRATION_CERT">Migration Certificate</option>
              <option value="MARKSHEET">Marksheet</option>
              <option value="CHARACTER_CERT">Character Certificate</option>
              <option value="INCOME_CERT">Income Certificate</option>
              <option value="CASTE_CERT">Caste Certificate</option>
              <option value="PASSPORT_PHOTO">Passport Photo</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              type="file"
              className="rounded border p-2 w-full"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </div>
        </Modal>
      )}

      <Card title="Filter">
        <select
          onChange={(e) => setListType(e.target.value)}
          className="rounded border p-2 w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Documents</option>
          <option value="student">Student Documents</option>
          <option value="teacher">Teacher Documents</option>
        </select>
      </Card>
    </div>
  );
}