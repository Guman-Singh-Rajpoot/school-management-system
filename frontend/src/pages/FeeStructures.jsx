import { useEffect, useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

export default function FeeStructures() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    fee_type: "",
    amount: "",
    school_class: "",
    session: "",
    due_day: "",
    late_fee_amount: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadStructures() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/fees/fee-structures/");
      const data = response.data;
      setStructures(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to load fee structures:", err);
      setError(
        err.response?.data?.detail ||
          "Unable to load fee structures."
      );
      setStructures([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStructures();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/academics/classes/").then((res) =>
      setForm((prev) => ({ ...prev, school_class: "" }))
    );
  }, [isAdmin]);

  function openCreate() {
    setEditingId(null);
    setForm({
      fee_type: "",
      amount: "",
      school_class: "",
      session: "",
      due_day: "",
      late_fee_amount: "",
      active: true,
    });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      fee_type: row.fee_type,
      amount: row.amount,
      school_class: row.school_class?.id || "",
      session: row.session?.id || "",
      due_day: row.due_day || "",
      late_fee_amount: row.late_fee_amount || "",
      active: row.active,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this fee structure? This cannot be undone."))
      return;
    try {
      await api.delete(`/fees/fee-structures/${id}/`);
      await loadStructures();
    } catch (err) {
      window.alert(
        err.response?.data?.detail || "Failed to delete fee structure."
      );
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const method = editingId
        ? `/fees/fee-structures/${editingId}/`
        : "/fees/fee-structures/";
      const url = method.startsWith("/")
        ? method
        : `/fees/fee-structures/${editingId}/`;
      const patchUrl = editingId
        ? `/fees/fee-structures/${editingId}/`
        : "/fees/fee-structures/";
      const response = editingId
        ? await api.patch(patchUrl, form)
        : await api.post("/fees/fee-structures/", form);
      setFormOpen(false);
      await loadStructures();
    } catch (err) {
      const data = err.response?.data;
      setFormError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to save fee structure."
      );
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "fee_type", header: "Fee Type", render: (row) => row.fee_type || "-" },
    { key: "amount", header: "Amount", render: (row) => `₹${Number(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { key: "school_class_name", header: "Class", render: (row) => row.school_class_name || "-" },
    { key: "session_name", header: "Session", render: (row) => row.session_name || "-" },
    { key: "due_day", header: "Due Day", render: (row) => row.due_day || "-" },
    { key: "late_fee_amount", header: "Late Fee", render: (row) => `₹${Number(row.late_fee_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    {
      key: "active",
      header: "Active",
      render: (row) =>
        row.active
          ? '<span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Yes</span>'
          : '<span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">No</span>',
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(row)}
                  className="text-brand-600 hover:text-brand-700 text-sm"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Fee Structures</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Master fee categories per class and session.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add Fee Structure
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card>
        <DataTable columns={columns} rows={structures} loading={loading} emptyText="No fee structures found." />
      </Card>

      {/* CREATE / EDIT MODAL */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit Fee Structure" : "Add Fee Structure"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fee Type</label>
            <input
              required
              type="text"
              name="fee_type"
              value={form.fee_type}
              onChange={(e) => setForm((f) => ({ ...f, fee_type: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹)</label>
            <input
              required
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select
              required
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={form.school_class}
              onChange={(e) => setForm((f) => ({ ...f, school_class: e.target.value }))}
            >
              <option value="">Select class</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Session</label>
            <select
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={form.session}
              onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}
            >
              <option value="">Select session</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Due Day</label>
            <input
              type="number"
              name="due_day"
              min="1"
              max="31"
              step="1"
              value={form.due_day}
              onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Late Fee Amount (₹)</label>
            <input
              type="number"
              name="late_fee_amount"
              min="0"
              step="0.01"
              value={form.late_fee_amount}
              onChange={(e) => setForm((f) => ({ ...f, late_fee_amount: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Active</label>
            <select
              name="active"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}