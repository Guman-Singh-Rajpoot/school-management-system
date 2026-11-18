import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import { Eye, Trash2 } from "lucide-react";

export default function DocumentsList() {
  const { user } = useAuth();
  const { id: studentId, teacherId } = useParams();
  const [searchParams] = useSearchParams();
  const [listType, setListType] = useState(
    studentId ? "student" : teacherId ? "teacher" : "all"
  );

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
      const params = {};

      if (listType === "student" && studentId) {
        params["student"] = studentId;
      } else if (listType === "teacher") {
        url = "/api/teachers/documents/";
      }

      const documentType = searchParams.get("document_type");
      if (documentType && url === "/api/documents/generated/") {
        params["document_type"] = documentType;
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this document?")) {
      return;
    }
    try {
      await api.delete(`/api/documents/generated/${id}/`);
      await load();
    } catch (err) {
      console.error("Failed to delete document:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to delete the document."
      );
    }
  };

  const fileName = (row) => {
    const path = typeof row.file === "string" ? row.file : "";
    return path.split("/").pop() || "-";
  };

  const columns = [
    {
      key: "document_type",
      header: "Document Type",
      render: (row) => row.document_type_display || row.document_type || "-",
    },
    {
      key: "file",
      header: "File Name",
      render: (row) => fileName(row),
    },
    {
      key: "uploaded_by",
      header: "Uploaded By",
      render: (row) => row.uploaded_by_name || row.uploaded_by || "-",
    },
    {
      key: "uploaded_at",
      header: "Uploaded On",
      render: (row) =>
        row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString() : "-",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => {
        const fileUrl = typeof row.file === "string" ? row.file : "";
        const canDelete = isAdminOwner || isTeacher;

        return (
          <div className="flex items-center gap-1">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
                title="View document"
              >
                <Eye size={14} />
              </a>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDelete(row.id)}
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500"
                title="Delete document"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Manage and view school documents.
        </p>
      </div>

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
              ? "No documents found."
              : isTeacher
              ? "No documents found for this teacher."
              : "No documents found."
          }
        />
      </Card>

      {isAdminOwner && (
        <Card title="Filter">
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value)}
            className="rounded border p-2 w-44 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Documents</option>
            <option value="student">Student Documents</option>
            <option value="teacher">Teacher Documents</option>
          </select>
        </Card>
      )}
    </div>
  );
}
