import { Search, Plus, FolderOpen, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/client';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import AddStudentForm from '../components/AddStudentForm';
import DocumentsPanel from '../components/DocumentsPanel';

import { useAuth } from '../context/AuthContext';

const DOC_TYPES = [
  ['AADHAAR', 'Aadhaar'],
  ['BIRTH_CERT', 'Birth Certificate'],
  ['TRANSFER_CERT', 'Transfer Certificate'],
  ['MIGRATION_CERT', 'Migration Certificate'],
  ['MARKSHEET', 'Marksheet'],
  ['CHARACTER_CERT', 'Character Certificate'],
  ['INCOME_CERT', 'Income Certificate'],
  ['CASTE_CERT', 'Caste Certificate'],
  ['PASSPORT_PHOTO', 'Passport Photo'],
  ['OTHER', 'Other'],
];

export default function StudentsList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [docsStudent, setDocsStudent] = useState(null);

  const isAdmin = user?.role === 'ADMIN';

  async function load() {
    try {
      setLoading(true);
      setError('');

      const res = await api.get('/students/', {
        params: search.trim()
          ? { search: search.trim() }
          : {},
      });

      /*
       * Django REST Framework normally returns:
       *
       * {
       *   count: ...,
       *   next: ...,
       *   previous: ...,
       *   results: [...]
       * }
       *
       * But this also supports a plain array.
       */
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];

      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Unable to load students. Please try again.';

      setError(message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timeout);

    // load intentionally depends on search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(row) {
    if (!isAdmin) {
      setError('Only Admin can delete students.');
      return;
    }

    const studentName =
      row.full_name ||
      `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
      row.admission_number ||
      'this student';

    const confirmed = window.confirm(
      `Remove ${studentName}'s student record?`
    );

    if (!confirmed) return;

    try {
      setError('');

      await api.delete(`/students/${row.id}/`);

      /*
       * Remove the deleted student immediately from the UI.
       * Then reload from backend to keep frontend synchronized.
       */
      setStudents((current) =>
        current.filter((student) => student.id !== row.id)
      );

      await load();
    } catch (err) {
      console.error('Failed to delete student:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Unable to delete student. Please try again.';

      setError(message);
    }
  }

  const columns = [
    {
      key: 'admission_number',
      header: 'Admission No.',
    },

    {
      key: 'full_name',
      header: 'Name',
      render: (row) => {
        /*
         * Prefer serializer's full_name.
         * Fall back to first_name/last_name if full_name
         * isn't returned by the backend.
         */
        if (row.full_name) {
          return row.full_name;
        }

        return (
          `${row.first_name || ''} ${row.middle_name || ''} ${
            row.last_name || ''
          }`
            .replace(/\s+/g, ' ')
            .trim() || '-'
        );
      },
    },

    {
      key: 'class_name',
      header: 'Class',
      render: (row) =>
        row.class_name ||
        row.school_class_name ||
        row.school_class?.name ||
        row.school_class?.class_name ||
        '-',
    },

    {
      key: 'section_name',
      header: 'Section',
      render: (row) =>
        row.section_name ||
        row.section?.name ||
        row.section?.section_name ||
        '-',
    },

    {
      key: 'mobile_number',
      header: 'Mobile',
      render: (row) =>
        row.mobile_number ||
        row.user?.phone ||
        row.user?.phone_number ||
        '-',
    },

    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.status || '-'}
        </span>
      ),
    },

    {
      key: 'actions',
      header: 'Documents / Actions',
      render: (row) => (
        <div className="flex items-center gap-1">

          {/* Documents */}
          <button
            onClick={() => setDocsStudent(row)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
            title="View / upload documents"
          >
            <FolderOpen size={16} />
          </button>

          {/* Delete - Admin only */}
          {isAdmin && (
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-red-500"
              title="Delete student"
            >
              <Trash2 size={16} />
            </button>
          )}

        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-semibold">
            Students
          </h1>

          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage student records, enrollment, and documents.
          </p>
        </div>

        {/* Add Student - Admin only */}
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus size={16} />
            Add student
          </button>
        )}
        <button
  onClick={() => navigate(`/admin/students/${row.id}`)}
  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
  title="View student"
>
  <Eye size={16} />
</button>

      </div>

      {/* API Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Students table */}
      <Card
        action={
          <div className="relative">

            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, admission no, mobile…"
              className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

          </div>
        }
      >

        <DataTable
          columns={columns}
          rows={students}
          loading={loading}
          emptyText={
            search.trim()
              ? 'No students found matching your search.'
              : 'No students found. Add a student above.'
          }
        />

      </Card>

      {/* Add Student Modal */}
      {isAdmin && (
        <Modal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add student"
          wide
        >
          <AddStudentForm
            onCancel={() => setAddOpen(false)}
            onCreated={() => {
              setAddOpen(false);
              load();
            }}
          />
        </Modal>
      )}

      {/* Student Documents */}
      <Modal
        open={!!docsStudent}
        onClose={() => setDocsStudent(null)}
        title={
          docsStudent
            ? `Documents — ${
                docsStudent.full_name ||
                `${docsStudent.first_name || ''} ${
                  docsStudent.last_name || ''
                }`.trim() ||
                docsStudent.admission_number
              }`
            : ''
        }
        wide
      >
        {docsStudent && (
          <DocumentsPanel
            endpoint="students"
            ownerField="student"
            ownerId={docsStudent.id}
            docTypes={DOC_TYPES}
          />
        )}
      </Modal>

    </div>
  );
}

