import { useState } from 'react';
import api from '../api/client';

const initial = {
  username: '', email: '', first_name: '', last_name: '', password: '',
  employee_id: '', gender: 'M', date_of_birth: '', qualification: '',
  experience_years: 0, department: '', joining_date: '', address: '',
};

export default function AddTeacherForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/teachers/', form);
      onCreated();
    } catch (err) {
      const data = err.response?.data;
      setError(data ? JSON.stringify(data) : 'Failed to create teacher.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';
  const label = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Username *</label>
          <input required className={input} value={form.username} onChange={(e) => update('username', e.target.value)} />
        </div>
        <div>
          <label className={label}>Email *</label>
          <input required type="email" className={input} value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className={label}>First name *</label>
          <input required className={input} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Last name *</label>
          <input required className={input} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={label}>Password *</label>
          <input required minLength={8} type="password" className={input} value={form.password} onChange={(e) => update('password', e.target.value)} />
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Employee ID *</label>
          <input required className={input} value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)} />
        </div>
        <div>
          <label className={label}>Gender *</label>
          <select required className={input} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </div>
        <div>
          <label className={label}>Date of birth *</label>
          <input required type="date" className={input} value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
        </div>
        <div>
          <label className={label}>Joining date *</label>
          <input required type="date" className={input} value={form.joining_date} onChange={(e) => update('joining_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>Qualification *</label>
          <input required className={input} value={form.qualification} onChange={(e) => update('qualification', e.target.value)} />
        </div>
        <div>
          <label className={label}>Department *</label>
          <input required className={input} value={form.department} onChange={(e) => update('department', e.target.value)} />
        </div>
        <div>
          <label className={label}>Experience (years)</label>
          <input type="number" min="0" className={input} value={form.experience_years} onChange={(e) => update('experience_years', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={label}>Address</label>
          <input className={input} value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 break-words">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Add teacher'}
        </button>
      </div>
    </form>
  );
}
