
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Briefcase,
  GraduationCap,
  Calendar,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Pencil,
  MapPin,
} from 'lucide-react';

import api from '../api/client';
import Card from '../components/Card';
import Modal from '../components/Modal';
import DocumentsPanel from '../components/DocumentsPanel';
import { useAuth } from '../context/AuthContext';

const DOC_TYPES = [
  ['AADHAAR', 'Aadhaar'],
  ['RESUME', 'Resume/CV'],
  ['DEGREE', 'Degree Certificate'],
  ['OTHER', 'Other'],
];

export default function TeacherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docsOpen, setDocsOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ============================================================
  // LOAD TEACHER
  // ============================================================

  async function loadTeacher() {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/teachers/${id}/`);

      setTeacher(response.data);
    } catch (err) {
      console.error('Failed to load teacher:', err);

      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Unable to load teacher details.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadTeacher();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============================================================
  // EDIT TEACHER
  // ============================================================

  function openEdit() {
    setSaveError('');
    setEditForm({
      qualification: teacher.qualification || '',
      experience_years: teacher.experience_years ?? 0,
      department: teacher.department || '',
      aadhaar_number: teacher.aadhaar_number || '',
      pan_number: teacher.pan_number || '',
      bank_account_number: teacher.bank_account_number || '',
      bank_ifsc: teacher.bank_ifsc || '',
      bank_name: teacher.bank_name || '',
      salary: teacher.salary ?? '',
      address: teacher.address || '',
    });
    setEditOpen(true);
  }

  function updateEditField(key, value) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const payload = { ...editForm };
      if (payload.salary === '') delete payload.salary;
      await api.patch(`/teachers/${id}/`, payload);
      setEditOpen(false);
      await loadTeacher();
    } catch (err) {
      const data = err.response?.data;
      setSaveError(
        data && typeof data === 'object'
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' | ')
          : 'Failed to save changes.'
      );
    } finally {
      setSaving(false);
    }
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
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-semibold">
              Teacher Details
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Loading teacher information...
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

  if (error || !teacher) {
    return (
      <div className="space-y-6">
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
              Teacher Details
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Unable to display teacher information.
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
              Teacher not found
            </h2>

            <p className="text-sm text-slate-500 mt-2 max-w-md">
              {error || 'The requested teacher record could not be found.'}
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={loadTeacher}
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
  // SAFE VALUES
  // ============================================================

  const fullName =
    teacher.full_name ||
    `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() ||
    'Teacher';

  const employeeId =
    teacher.employee_id ||
    teacher.employeeId ||
    '-';

  const department =
    teacher.department ||
    '-';

  const qualification =
    teacher.qualification ||
    '-';

  const experience =
    teacher.experience_years ??
    teacher.experienceYears ??
    0;

  const email =
    teacher.user?.email ||
    '-';

  const joiningDate =
    teacher.joining_date ||
    null;

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(value) {
    if (!value) return '-';

    try {
      return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return value;
    }
  }

  // ============================================================
  // INFO ITEM
  // ============================================================

  function InfoItem({
    icon: Icon,
    label,
    value,
  }) {
    return (
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-600">
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p className="text-sm font-medium mt-0.5 break-words">
            {value}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RETURN
  // ============================================================

  return (
    <div className="space-y-6">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <div className="flex items-center justify-between gap-4">
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
              Teacher Details
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              View teacher information and documents.
            </p>
          </div>
        </div>

        <button
          onClick={loadTeacher}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* ========================================================
          PROFILE HEADER
      ======================================================== */}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-5">

          {/* Avatar */}

          <div className="w-20 h-20 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 shrink-0">
            <User size={40} />
          </div>

          {/* Name */}

          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              {fullName}
            </h2>

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2 text-sm text-slate-500 dark:text-slate-400">

              <span>
                Employee ID: {employeeId}
              </span>

              <span>
                Department: {department}
              </span>

              <span>
                Qualification: {qualification}
              </span>

            </div>
          </div>

          {/* Documents */}

          <div className="flex gap-2">
            <button
              onClick={() => setDocsOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
            >
              <FolderOpen size={17} />
              Documents
            </button>

            {isAdmin && (
              <button
                onClick={openEdit}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
              >
                <Pencil size={16} />
                Edit
              </button>
            )}
          </div>

        </div>
      </Card>

      {/* ========================================================
          BASIC INFORMATION
      ======================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card title="Personal Information">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <InfoItem
              icon={User}
              label="Full Name"
              value={fullName}
            />

            <InfoItem
              icon={Briefcase}
              label="Employee ID"
              value={employeeId}
            />

            <InfoItem
              icon={Mail}
              label="Email"
              value={email}
            />

            <InfoItem
              icon={MapPin}
              label="Address"
              value={teacher.address || '-'}
            />

          </div>

        </Card>

        {/* ======================================================
            PROFESSIONAL INFORMATION
        ====================================================== */}

        <Card title="Professional Information">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <InfoItem
              icon={Briefcase}
              label="Department"
              value={department}
            />

            <InfoItem
              icon={GraduationCap}
              label="Qualification"
              value={qualification}
            />

            <InfoItem
              icon={Calendar}
              label="Experience"
              value={`${experience} year${Number(experience) === 1 ? '' : 's'}`}
            />

            <InfoItem
              icon={Calendar}
              label="Joining Date"
              value={formatDate(joiningDate)}
            />

          </div>

        </Card>

      </div>

      {/* ========================================================
          TEACHER SUMMARY
      ======================================================== */}

      <Card title="Teacher Summary">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">
              Employee ID
            </p>

            <p className="text-lg font-semibold mt-1">
              {employeeId}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">
              Department
            </p>

            <p className="text-lg font-semibold mt-1">
              {department}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">
              Experience
            </p>

            <p className="text-lg font-semibold mt-1">
              {experience} yrs
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500">
              Joining Date
            </p>

            <p className="text-lg font-semibold mt-1">
              {formatDate(joiningDate)}
            </p>
          </div>

        </div>

      </Card>

      {/* ========================================================
          ACCOUNT INFORMATION
      ======================================================== */}

      <Card title="Account Information">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <InfoItem
            icon={Mail}
            label="Email"
            value={email}
          />

          <InfoItem
            icon={MapPin}
            label="Address"
            value={teacher.address || '-'}
          />

        </div>

      </Card>

      {/* ========================================================
          DOCUMENTS MODAL
      ======================================================== */}

      <Modal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        title={`Documents — ${fullName}`}
        wide
      >

        <DocumentsPanel
          endpoint="teachers"
          ownerField="teacher"
          ownerId={teacher.id}
          docTypes={DOC_TYPES}
        />

      </Modal>

      {/* EDIT TEACHER */}

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
              <label className="block text-xs font-medium text-slate-500 mb-1">Qualification</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.qualification || ''}
                onChange={(e) => updateEditField('qualification', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.department || ''}
                onChange={(e) => updateEditField('department', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Experience (years)</label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.experience_years ?? 0}
                onChange={(e) => updateEditField('experience_years', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Monthly salary (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.salary ?? ''}
                onChange={(e) => updateEditField('salary', e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
              <textarea
                rows={2}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.address || ''}
                onChange={(e) => updateEditField('address', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Aadhaar number</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.aadhaar_number || ''}
                onChange={(e) => updateEditField('aadhaar_number', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PAN number</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.pan_number || ''}
                onChange={(e) => updateEditField('pan_number', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bank name</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.bank_name || ''}
                onChange={(e) => updateEditField('bank_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bank account number</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.bank_account_number || ''}
                onChange={(e) => updateEditField('bank_account_number', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bank IFSC</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                value={editForm.bank_ifsc || ''}
                onChange={(e) => updateEditField('bank_ifsc', e.target.value)}
              />
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
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

