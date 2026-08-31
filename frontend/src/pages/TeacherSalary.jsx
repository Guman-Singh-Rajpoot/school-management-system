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

export default function TeacherSalary() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Define-salary form state
  const [defineOpen, setDefineOpen] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [defineForm, setDefineForm] = useState({ teacher: "", salary_month: "", amount: "" });
  const [defineSaving, setDefineSaving] = useState(false);
  const [defineError, setDefineError] = useState("");

  // Record-payment form state
  const [payOpen, setPayOpen] = useState(false);
  const [paySalary, setPaySalary] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", payment_method: "BANK_TRANSFER", reference_number: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  async function loadSalaries() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/teachers/salaries/");
      const data = response.data;
      setSalaries(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to load salaries:", err);
      setError(err.response?.data?.detail || "Unable to load salary records.");
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalaries();
  }, []);

  useEffect(() => {
    if (!defineOpen || !isAdmin) return;
    api.get("/teachers/").then((res) => setTeachers(res.data?.results || res.data || []));
  }, [defineOpen, isAdmin]);

  async function handleDefine(e) {
    e.preventDefault();
    setDefineSaving(true);
    setDefineError("");
    try {
      const month = defineForm.salary_month ? `${defineForm.salary_month}-01` : "";
      await api.post("/teachers/salaries/", { ...defineForm, salary_month: month });
      setDefineOpen(false);
      setDefineForm({ teacher: "", salary_month: "", amount: "" });
      await loadSalaries();
    } catch (err) {
      const data = err.response?.data;
      setDefineError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to define salary."
      );
    } finally {
      setDefineSaving(false);
    }
  }

  function openPay(salary) {
    setPaySalary(salary);
    setPayForm({ amount: "", payment_method: "BANK_TRANSFER", reference_number: "" });
    setPayError("");
    setPayOpen(true);
  }

  async function handlePay(e) {
    e.preventDefault();
    setPaySaving(true);
    setPayError("");
    try {
      await api.post("/teachers/salary-payments/", {
        teacher_salary: paySalary.id,
        amount: payForm.amount,
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number,
      });
      setPayOpen(false);
      await loadSalaries();
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
    { key: "teacher", header: "Teacher", render: (row) => row.teacher_name || `#${row.teacher}` },
    { key: "employee_id", header: "Employee ID", render: (row) => row.employee_id || "-" },
    {
      key: "salary_month",
      header: "Month",
      render: (row) =>
        row.salary_month
          ? new Date(row.salary_month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
          : "-",
    },
    { key: "amount", header: "Salary", render: (row) => money(row.amount) },
    { key: "paid_amount", header: "Paid", render: (row) => money(row.paid_amount) },
    {
      key: "remaining_amount",
      header: "Pending",
      render: (row) => (
        <span className={Number(row.remaining_amount) > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
          {money(row.remaining_amount)}
        </span>
      ),
    },
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
                disabled={Number(row.remaining_amount) <= 0}
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
          <h1 className="text-2xl font-semibold">Teacher Salary</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Define monthly salary and record payments.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setDefineOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Define Salary
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card>
        <DataTable columns={columns} rows={salaries} loading={loading} emptyText="No salary records found." />
      </Card>

      {/* DEFINE SALARY MODAL */}
      <Modal open={defineOpen} onClose={() => setDefineOpen(false)} title="Define Monthly Salary">
        <form onSubmit={handleDefine} className="space-y-4">
          {defineError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{defineError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Teacher</label>
            <select
              required
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={defineForm.teacher}
              onChange={(e) => setDefineForm((f) => ({ ...f, teacher: e.target.value }))}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.employee_id} ({t.employee_id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <input
              required
              type="month"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={defineForm.salary_month}
              onChange={(e) => setDefineForm((f) => ({ ...f, salary_month: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Salary Amount (₹)</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={defineForm.amount}
              onChange={(e) => setDefineForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDefineOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={defineSaving}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {defineSaving ? "Saving..." : "Define"}
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={paySalary ? `Record Payment — ${paySalary.teacher_name || "Teacher"}` : "Record Payment"}
      >
        {paySalary && (
          <form onSubmit={handlePay} className="space-y-4">
            {payError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{payError}</div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500">Monthly Salary</p>
                <p className="font-semibold mt-1">{money(paySalary.amount)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500">Pending</p>
                <p className="font-semibold mt-1">{money(paySalary.remaining_amount)}</p>
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
                  max={paySalary.remaining_amount}
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
                value={payForm.payment_method}
                onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reference number (optional)</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={payForm.reference_number}
                onChange={(e) => setPayForm((f) => ({ ...f, reference_number: e.target.value }))}
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
