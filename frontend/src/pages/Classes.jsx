import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import api from "../api/client";
import Card from "../components/Card";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { key: "sessions", label: "Sessions" },
  { key: "classes", label: "Classes" },
  { key: "sections", label: "Sections" },
  { key: "subjects", label: "Subjects" },
];

const EMPTY_FORMS = {
  sessions: { name: "", start_date: "", end_date: "", is_current: false },
  classes: { name: "", session: "" },
  sections: { class_room: "", name: "" },
  subjects: { name: "", code: "", school_class: "", is_elective: false },
};

export default function Classes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState("sessions");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORMS.sessions);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/academics/${tab}/`);
      const data = response.data;
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error(`Failed to load ${tab}:`, err);
      setError(err.response?.data?.detail || `Unable to load ${tab}.`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Reference lists for the Class/Section/Subject dropdowns.
  useEffect(() => {
    if (tab === "classes" || tab === "sections" || tab === "subjects") {
      api.get("/academics/sessions/").then((res) => setSessions(res.data?.results || res.data || []));
    }
    if (tab === "sections" || tab === "subjects") {
      api.get("/academics/classes/").then((res) => setClasses(res.data?.results || res.data || []));
    }
  }, [tab]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORMS[tab]);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ ...EMPTY_FORMS[tab], ...row });
    setFormError("");
    setFormOpen(true);
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/academics/${tab}/${row.id}/`);
      await loadRows();
    } catch (err) {
      window.alert(err.response?.data?.detail || "Failed to delete.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await api.patch(`/academics/${tab}/${editingId}/`, form);
      } else {
        await api.post(`/academics/${tab}/`, form);
      }
      setFormOpen(false);
      await loadRows();
    } catch (err) {
      const data = err.response?.data;
      setFormError(
        data && typeof data === "object"
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ")
          : "Failed to save."
      );
    } finally {
      setSaving(false);
    }
  }

  const columnsByTab = {
    sessions: [
      { key: "name", header: "Name" },
      { key: "start_date", header: "Start Date" },
      { key: "end_date", header: "End Date" },
      { key: "is_current", header: "Current", render: (r) => (r.is_current ? "Yes" : "No") },
    ],
    classes: [
      { key: "name", header: "Class" },
      { key: "session_name", header: "Session", render: (r) => r.session_name || "-" },
    ],
    sections: [
      { key: "name", header: "Section" },
      { key: "class_room_name", header: "Class", render: (r) => r.class_room_name || "-" },
    ],
    subjects: [
      { key: "name", header: "Subject" },
      { key: "code", header: "Code" },
      { key: "school_class_name", header: "Class", render: (r) => r.school_class_name || "-" },
      { key: "is_elective", header: "Elective", render: (r) => (r.is_elective ? "Yes" : "No") },
    ],
  };

  const columns = [
    ...columnsByTab[tab],
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-3">
                <button onClick={() => openEdit(row)} className="text-brand-600 hover:text-brand-700">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(row)} className="text-red-600 hover:text-red-700">
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
          <h1 className="text-2xl font-semibold">Academic Structure</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sessions → Classes → Sections → Subjects.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add {TABS.find((t) => t.key === tab)?.label.replace(/s$/, "")}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <Card>
        <DataTable columns={columns} rows={rows} loading={loading} emptyText={`No ${tab} found.`} />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={`${editingId ? "Edit" : "Add"} ${TABS.find((t) => t.key === tab)?.label.replace(/s$/, "")}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          {tab === "sessions" && (
            <>
              <Field label="Name (e.g. 2026-2027)">
                <input
                  required
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Start Date">
                <input
                  required
                  type="date"
                  className="input"
                  value={form.start_date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </Field>
              <Field label="End Date">
                <input
                  required
                  type="date"
                  className="input"
                  value={form.end_date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.is_current}
                  onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))}
                />
                Current session
              </label>
            </>
          )}

          {tab === "classes" && (
            <>
              <Field label="Class Name (e.g. Class 10)">
                <input
                  required
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Session">
                <select
                  className="input"
                  value={form.session || ""}
                  onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}
                >
                  <option value="">—</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {tab === "sections" && (
            <>
              <Field label="Class">
                <select
                  required
                  className="input"
                  value={form.class_room || ""}
                  onChange={(e) => setForm((f) => ({ ...f, class_room: e.target.value }))}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Section Name (e.g. A)">
                <input
                  required
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
            </>
          )}

          {tab === "subjects" && (
            <>
              <Field label="Subject Name">
                <input
                  required
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Code">
                <input
                  required
                  className="input"
                  value={form.code || ""}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </Field>
              <Field label="Class">
                <select
                  required
                  className="input"
                  value={form.school_class || ""}
                  onChange={(e) => setForm((f) => ({ ...f, school_class: e.target.value }))}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.is_elective}
                  onChange={(e) => setForm((f) => ({ ...f, is_elective: e.target.checked }))}
                />
                Elective subject
              </label>
            </>
          )}

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
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
