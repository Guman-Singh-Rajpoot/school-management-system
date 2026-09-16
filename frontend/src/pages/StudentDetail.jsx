
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  MapPin,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  CreditCard,
  IndianRupee,
  Pencil,
} from "lucide-react";

import api from "../api/client";
import Card from "../components/Card";
import Modal from "../components/Modal";
import DocumentsPanel from "../components/DocumentsPanel";
import { useAuth } from "../context/AuthContext";

const DOC_TYPES = [
  ["AADHAAR", "Aadhaar"],
  ["BIRTH_CERTIFICATE", "Birth Certificate"],
  ["TRANSFER_CERTIFICATE", "Transfer Certificate"],
  ["MARKSHEET", "Marksheet"],
  ["PHOTO", "Photograph"],
  ["OTHER", "Other"],
];

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "ADMIN";

  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [feesLoading, setFeesLoading] = useState(false);

  const [error, setError] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  // ============================================================
  // LOAD STUDENT
  // ============================================================

  async function loadStudent() {
    if (!id) {
      setError("Student ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/students/${id}/`);

      console.log("Student API response:", response.data);

      setStudent(response.data);
    } catch (err) {
      console.error("Failed to load student:", err);

      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Unable to load student details.";

      setError(message);
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // LOAD FEES
  // ============================================================

  async function loadFees() {
    if (!id) return;

    try {
      setFeesLoading(true);

      const response = await api.get("/fees/student-fees/", {
        params: {
          student: id,
        },
      });

      console.log("Fees API response:", response.data);

      const data = response.data;

      if (Array.isArray(data)) {
        setFees(data);
      } else if (Array.isArray(data?.results)) {
        setFees(data.results);
      } else {
        setFees([]);
      }
    } catch (err) {
      console.warn("Could not load student fees:", err);

      setFees([]);
    } finally {
      setFeesLoading(false);
    }
  }

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadStudent();
    loadFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============================================================
  // EDIT STUDENT
  // ============================================================

  function openEdit() {
    setSaveError("");
    setEditForm({
      gender: student.gender || "",
      date_of_birth: student.date_of_birth || "",
      mobile_number: student.mobile_number || "",
      current_address: student.current_address || "",
      city: student.city || "",
      state: student.state || "",
      father_name: student.father_name || "",
      father_mobile: student.father_mobile || "",
      mother_name: student.mother_name || "",
      mother_mobile: student.mother_mobile || "",
      guardian_name: student.guardian_name || "",
      guardian_mobile: student.guardian_mobile || "",
      session: student.session || "",
      school_class: student.school_class || "",
      section: student.section || "",
      status: student.status || "ACTIVE",
    });
    setEditOpen(true);
  }

  function updateEditField(key, value) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const payload = { ...editForm };
      if (!payload.section) delete payload.section;
      await api.patch(`/students/${id}/`, payload);
      setEditOpen(false);
      await loadStudent();
    } catch (err) {
      const data = err.response?.data;
      setSaveError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!editOpen) return;
    api.get("/academics/sessions/").then((res) =>
      setSessions(res.data?.results || res.data || [])
    );
  }, [editOpen]);

  useEffect(() => {
    if (!editForm.session) return setClasses([]);
    api
      .get("/academics/classes/", { params: { session: editForm.session } })
      .then((res) => setClasses(res.data?.results || res.data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.session]);

  useEffect(() => {
    if (!editForm.school_class) return setSections([]);
    api
      .get("/academics/sections/", { params: { school_class: editForm.school_class } })
      .then((res) => setSections(res.data?.results || res.data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.school_class]);

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ============================================================
  // FORMAT DATE + TIME
  // ============================================================

  function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ============================================================
  // MONEY
  // ============================================================

  function money(value) {
    const amount = Number(value || 0);

    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // ============================================================
  // INFO ITEM
  // ============================================================

  function InfoItem({ icon: Icon, label, value }) {
    return (
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-600 shrink-0">
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p className="text-sm font-medium mt-0.5 break-words">
            {value || "-"}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-semibold">
              Student Details
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Loading student information...
            </p>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-500">
              <RefreshCw
                size={20}
                className="animate-spin"
              />
              Loading...
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error || !student) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-semibold">
              Student Details
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Unable to display student information.
            </p>
          </div>
        </div>

        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle
              size={42}
              className="text-red-500 mb-4"
            />

            <h2 className="text-lg font-semibold">
              Student not found
            </h2>

            <p className="text-sm text-slate-500 mt-2 max-w-md">
              {error ||
                "The requested student record could not be found."}
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={loadStudent}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
              >
                <RefreshCw size={16} />
                Try again
              </button>

              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================
  // STUDENT DATA
  // ============================================================

  const fullName =
    student.full_name ||
    student.user?.full_name ||
    `${student.user?.first_name || ""} ${student.user?.last_name || ""}`.trim() ||
    "Student";

  const admissionNumber = student.admission_number || "-";

  const email = student.user?.email || "-";

  const phone = student.mobile_number || "-";

  const gender = student.gender || "-";

  const dateOfBirth = student.date_of_birth || null;

  const admissionDate = student.admission_date || null;

  const address = student.current_address || "-";

  const fatherName = student.father_name || "-";

  const motherName = student.mother_name || "-";

  const guardianName = student.guardian_name || "-";

  // ============================================================
  // CLASS
  // ============================================================

  const className = student.school_class_name || "-";
  const sectionName = student.section_name || "-";
  const sessionName = student.session_name || "-";

  // ============================================================
  // FEE CALCULATIONS
  // ============================================================

  const totalFees = fees.reduce((sum, fee) => {
    const total = Number(fee.net_payable ?? 0);
    return sum + total;
  }, 0);

  const totalPaid = fees.reduce((sum, fee) => {
    const paid = Number(fee.paid_amount ?? 0);
    return sum + paid;
  }, 0);

  const totalRemaining = fees.reduce((sum, fee) => {
    const remaining = Number(fee.pending_amount ?? 0);
    return sum + remaining;
  }, 0);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div className="flex items-center gap-3">

          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-semibold">
              Student Details
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              View student information, documents and fee records.
            </p>
          </div>

        </div>

        <div className="flex gap-2">

          <button
            onClick={() => {
              loadStudent();
              loadFees();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            onClick={() => setDocsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <FolderOpen size={17} />
            Documents
          </button>

          {isAdmin && (
            <button
              onClick={openEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              <Pencil size={16} />
              Edit
            </button>
          )}

        </div>

      </div>

      {/* PROFILE */}

      <Card>

        <div className="flex flex-col md:flex-row md:items-center gap-5">

          <div className="w-20 h-20 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 shrink-0">
            <User size={40} />
          </div>

          <div className="flex-1">

            <h2 className="text-xl font-semibold">
              {fullName}
            </h2>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2 text-sm text-slate-500 dark:text-slate-400">

              <span>
                Student ID: {admissionNumber}
              </span>

              <span>
                Class: {className}
              </span>

              <span>
                Section: {sectionName}
              </span>

            </div>

          </div>

        </div>

      </Card>

      {/* PERSONAL + ACADEMIC */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card title="Personal Information">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <InfoItem
              icon={User}
              label="Full Name"
              value={fullName}
            />

            <InfoItem
              icon={CreditCard}
              label="Student ID"
              value={admissionNumber}
            />

            <InfoItem
              icon={Calendar}
              label="Date of Birth"
              value={formatDate(dateOfBirth)}
            />

            <InfoItem
              icon={User}
              label="Gender"
              value={gender}
            />

            <InfoItem
              icon={Mail}
              label="Email"
              value={email}
            />

            <InfoItem
              icon={Phone}
              label="Phone"
              value={phone}
            />

          </div>

        </Card>

        <Card title="Academic Information">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <InfoItem
              icon={GraduationCap}
              label="Class"
              value={className}
            />

            <InfoItem
              icon={GraduationCap}
              label="Section"
              value={sectionName}
            />

            <InfoItem
              icon={Calendar}
              label="Academic Session"
              value={sessionName}
            />

            <InfoItem
              icon={Calendar}
              label="Admission Date"
              value={formatDate(admissionDate)}
            />

          </div>

        </Card>

      </div>

      {/* PARENT INFORMATION */}

      <Card title="Parent / Guardian Information">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <InfoItem
            icon={User}
            label="Father's Name"
            value={fatherName}
          />

          <InfoItem
            icon={User}
            label="Mother's Name"
            value={motherName}
          />

          <InfoItem
            icon={User}
            label="Guardian Name"
            value={guardianName}
          />

        </div>

      </Card>

      {/* ADDRESS */}

      <Card title="Address">

        <div className="flex items-start gap-3">

          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-600">
            <MapPin size={18} />
          </div>

          <div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Residential Address
            </p>

            <p className="text-sm font-medium mt-1 whitespace-pre-line">
              {address}
            </p>

          </div>

        </div>

      </Card>

      {/* FEE SUMMARY */}

      <Card title="Fee Summary">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">

            <div className="flex items-center gap-2 text-slate-500">
              <IndianRupee size={18} />
              <span className="text-sm">
                Total Fee
              </span>
            </div>

            <p className="text-2xl font-semibold mt-2">
              {money(totalFees)}
            </p>

          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">

            <div className="flex items-center gap-2 text-slate-500">
              <IndianRupee size={18} />
              <span className="text-sm">
                Paid
              </span>
            </div>

            <p className="text-2xl font-semibold mt-2">
              {money(totalPaid)}
            </p>

          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">

            <div className="flex items-center gap-2 text-slate-500">
              <IndianRupee size={18} />
              <span className="text-sm">
                Remaining
              </span>
            </div>

            <p className="text-2xl font-semibold mt-2">
              {money(totalRemaining)}
            </p>

          </div>

        </div>

      </Card>

      {/* FEE RECORDS */}

      <Card title="Fee Records">

        {feesLoading ? (

          <div className="flex items-center justify-center py-10 text-slate-500">

            <RefreshCw
              size={18}
              className="animate-spin mr-2"
            />

            Loading fee records...

          </div>

        ) : fees.length === 0 ? (

          <div className="text-center py-10 text-slate-500">

            <CreditCard
              size={32}
              className="mx-auto mb-3 opacity-50"
            />

            <p className="text-sm">
              No fee records found for this student.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b border-slate-200 dark:border-slate-700">

                  <th className="text-left px-4 py-3 font-medium">
                    Fee Type
                  </th>

                  <th className="text-left px-4 py-3 font-medium">
                    Total
                  </th>

                  <th className="text-left px-4 py-3 font-medium">
                    Paid
                  </th>

                  <th className="text-left px-4 py-3 font-medium">
                    Remaining
                  </th>

                  <th className="text-left px-4 py-3 font-medium">
                    Due Date
                  </th>

                  <th className="text-left px-4 py-3 font-medium">
                    Created
                  </th>

                </tr>

              </thead>

              <tbody>

                {fees.map((fee) => {

                  const total = Number(fee.net_payable ?? 0);
                  const paid = Number(fee.paid_amount ?? 0);
                  const remaining = Number(fee.pending_amount ?? 0);

                  return (
                    <tr
                      key={fee.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >

                      <td className="px-4 py-3">
                        {fee.fee_type || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {money(total)}
                      </td>

                      <td className="px-4 py-3">
                        {money(paid)}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {money(remaining)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(fee.due_date)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDateTime(fee.created_at)}
                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          </div>

        )}

      </Card>

      {/* DOCUMENTS */}

      <Modal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        title={`Documents — ${fullName}`}
        wide
      >

        <DocumentsPanel
          endpoint="students"
          ownerField="student"
          ownerId={student.id}
          docTypes={DOC_TYPES}
        />

      </Modal>

      {/* EDIT STUDENT */}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit — ${fullName}`}
        wide
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gender</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.gender || ""}
                onChange={(e) => updateEditField("gender", e.target.value)}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date of birth</label>
              <input
                type="date"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.date_of_birth || ""}
                onChange={(e) => updateEditField("date_of_birth", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mobile number</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.mobile_number || ""}
                onChange={(e) => updateEditField("mobile_number", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.status || "ACTIVE"}
                onChange={(e) => updateEditField("status", e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="GRADUATED">Graduated</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
              <textarea
                rows={2}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.current_address || ""}
                onChange={(e) => updateEditField("current_address", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.city || ""}
                onChange={(e) => updateEditField("city", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.state || ""}
                onChange={(e) => updateEditField("state", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Father's name</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.father_name || ""}
                onChange={(e) => updateEditField("father_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Father's mobile</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.father_mobile || ""}
                onChange={(e) => updateEditField("father_mobile", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mother's name</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.mother_name || ""}
                onChange={(e) => updateEditField("mother_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mother's mobile</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.mother_mobile || ""}
                onChange={(e) => updateEditField("mother_mobile", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Guardian's name</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.guardian_name || ""}
                onChange={(e) => updateEditField("guardian_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Guardian's mobile</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.guardian_mobile || ""}
                onChange={(e) => updateEditField("guardian_mobile", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Session</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.session || ""}
                onChange={(e) => updateEditField("session", e.target.value)}
              >
                <option value="">—</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.school_class || ""}
                onChange={(e) => updateEditField("school_class", e.target.value)}
              >
                <option value="">—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Section</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.section || ""}
                onChange={(e) => updateEditField("section", e.target.value)}
              >
                <option value="">—</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

