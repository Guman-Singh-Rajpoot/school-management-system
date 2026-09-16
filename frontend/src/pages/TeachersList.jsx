
import { useEffect, useState } from 'react';
import api from '../api/client';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import AddTeacherForm from '../components/AddTeacherForm';
import DocumentsPanel from '../components/DocumentsPanel';
import {
  Search,
  Plus,
  FolderOpen,
  Trash2,
  Eye,
} from 'lucide-react';


const DOC_TYPES = [
  ['AADHAAR', 'Aadhaar'],
  ['RESUME', 'Resume/CV'],
  ['DEGREE', 'Degree Certificate'],
  ['OTHER', 'Other'],
];

export default function TeachersList() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [docsTeacher, setDocsTeacher] = useState(null);

  function load() {
    setLoading(true);
    api
      .get('/teachers/', { params: { search } })
      .then((res) => setTeachers(res.data.results || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(row) {
    if (!confirm(`Remove ${row.full_name}'s teacher record?`)) return;
    await api.delete(`/teachers/${row.id}/`);
    load();
  }

  const columns = [
    { key: 'employee_id', header: 'Employee ID' },
    { key: 'full_name', header: 'Name' },
    { key: 'department', header: 'Department' },
    { key: 'qualification', header: 'Qualification' },
    {
      key: 'experience_years',
      header: 'Experience',
      render: (row) => `${row.experience_years} yr${row.experience_years === 1 ? '' : 's'}`,
    },
   {
  key: 'actions',
  header: 'Actions',
  render: (row) => (
    <div className="flex items-center gap-1">

      {/* View Teacher */}
      <button
        onClick={() => navigate(`/admin/teachers/${row.id}`)}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
        title="View teacher"
      >
        <Eye size={16} />
      </button>

      {/* Documents */}
      <button
        onClick={() => setDocsTeacher(row)}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
        title="Upload / download documents"
      >
        <FolderOpen size={16} />
      </button>

      {/* Delete */}
      <button
        onClick={() => handleDelete(row)}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500"
        title="Delete teacher"
      >
        <Trash2 size={16} />
      </button>

    </div>
  ),
},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Teachers</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage teacher records and documents.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={16} /> Add teacher
        </button>
      </div>

      <Card
        action={
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee ID, email…"
              className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        }
      >
        <DataTable columns={columns} rows={teachers} loading={loading} emptyText="No teachers found. Add one above." />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add teacher" wide>
        <AddTeacherForm
          onCancel={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!docsTeacher}
        onClose={() => setDocsTeacher(null)}
        title={docsTeacher ? `Documents — ${docsTeacher.full_name}` : ''}
        wide
      >
        {docsTeacher && (
          <DocumentsPanel
            endpoint="teachers"
            ownerField="teacher"
            ownerId={docsTeacher.id}
            docTypes={DOC_TYPES}
          />
        )}
      </Modal>
    </div>
  );
}
