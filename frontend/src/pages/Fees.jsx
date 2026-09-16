import { useEffect, useState } from "react";
import { Plus, IndianRupee } from "lucide-react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

function money(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Fees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Assign-fee form state
  const [assignOpen, setAssignOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [assignForm, setAssignForm] = useState({ student: "", fee_structure: "" });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Record-payment form state
  const [payOpen, setPayOpen] = useState(false);
  const [payFee, setPayFee] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", remarks: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  async function loadFees() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/fees/student-fees/");
      const data = response.data;
      setFees(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to load fees:", err);
      setError(err.response?.data?.detail || "Unable to load fee records.");
      setFees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFees();
  }, []);

  useEffect(() => {
    if (!assignOpen || !isAdmin) return;
    api.get("/students/").then((res) => setStudents(res.data?.results || res.data || []));
    api.get("/fees/fee-structures/").then((res) => setStructures(res.data?.results || res.data || []));
  }, [assignOpen, isAdmin]);

  async function handleAssign(e) {
    e.preventDefault();
    setAssignSaving(true);
    setAssignError("");
    try {
      await api.post("/fees/student-fees/", assignForm);
      setAssignOpen(false);
      setAssignForm({ student: "", fee_structure: "" });
      await loadFees();
    } catch (err) {
      const data = err.response?.data;
      setAssignError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to assign fee."
      );
    } finally {
      setAssignSaving(false);
    }
  }

  function openPay(fee) {
    setPayFee(fee);
    setPayForm({ amount: "", method: "CASH", remarks: "" });
    setPayError("");
    setPayOpen(true);
  }

  async function handlePay(e) {
    e.preventDefault();
    setPaySaving(true);
    setPayError("");
    try {
      await api.post("/fees/payments/", {
        student_fee: payFee.id,
        amount: payForm.amount,
        method: payForm.method,
        remarks: payForm.remarks,
      });
      setPayOpen(false);
      await loadFees();
    } catch (err) {
      const data = err.response?.data;
      setPayError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to record payment."
      );
    } finally {
      setPaySaving(false);
    }
  }

  const columns = [
    { key: "student", header: "Student", render: (row) => row.student_name || `#${row.student}` },
    { key: "fee_type", header: "Fee Type", render: (row) => row.fee_type || "-" },
    { key: "net_payable", header: "Total Fee", render: (row) => money(row.net_payable) },
    { key: "paid_amount", header: "Paid", render: (row) => money(row.paid_amount) },
    {
      key: "pending_amount",
      header: "Pending",
      render: (row) => (
        <span className={Number(row.pending_amount) > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
          {money(row.pending_amount)}
        </span>
      ),
    },
    { key: "due_date", header: "Due Date", render: (row) => row.due_date || "-" },
    {
      key: "last_payment",
      header: "Last Payment",
      render: (row) => {
        const last = (row.payments || [])[0];
        return last ? formatDateTime(last.created_at) : "-";
      },
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <button
                onClick={() => openPay(row)}
                disabled={Number(row.pending_amount) <= 0}
                className="text-brand-600 hover:underline text-sm font-medium disabled:opacity-40 disabled:no-underline"
              >
                Record Payment
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Fee Collection</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage student fees and payment records.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAssignOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Assign Fee
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card>
        <DataTable columns={columns} rows={fees} loading={loading} emptyText="No fee records found." />
      </Card>

      {/* ASSIGN FEE MODAL */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Fee to Student">
        <form onSubmit={handleAssign} className="space-y-4">
          {assignError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{assignError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            <select
              required
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={assignForm.student}
              onChange={(e) => setAssignForm((f) => ({ ...f, student: e.target.value }))}
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.admission_number} ({s.admission_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fee Structure</label>
            <select
              required
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={assignForm.fee_structure}
              onChange={(e) => setAssignForm((f) => ({ ...f, fee_structure: e.target.value }))}
            >
              <option value="">Select fee structure</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fee_type} — {money(s.amount)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignSaving}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {assignSaving ? "Saving..." : "Assign"}
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={payFee ? `Record Payment — ${payFee.student_name || "Student"}` : "Record Payment"}
      >
        {payFee && (
          <form onSubmit={handlePay} className="space-y-4">
            {payError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{payError}</div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500">Total Fee</p>
                <p className="font-semibold mt-1">{money(payFee.net_payable)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500">Pending</p>
                <p className="font-semibold mt-1">{money(payFee.pending_amount)}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Amount (₹)</label>
              <div className="relative">
                <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payFee.pending_amount}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
              <select
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={payForm.method}
                onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Remarks (optional)</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={payForm.remarks}
                onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>

            <p className="text-xs text-slate-400">
              Payment date and time are recorded automatically by the server.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paySaving}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {paySaving ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
