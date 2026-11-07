import { useEffect, useState } from 'react';
import api from '../api/client';

const initial = {
  username: '', email: '', first_name: '', last_name: '', password: '', phone: '',
  whatsapp_number: '', must_change_password: true,
  employee_id: '', gender: 'M', date_of_birth: '', qualification: '',
  experience_years: 0, department: '', joining_date: '', address: '',
  classes: [], sections: [], subjects: [],
};

export default function AddTeacherForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(initial);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([
      api.get('/academics/classes/'),
      api.get('/academics/sections/'),
      api.get('/academics/subjects/'),
    ]).then(([clsRes, secRes, subRes]) => {
      setAvailableClasses(clsRes.value?.data?.results || clsRes.value?.data || []);
      setAvailableSections(secRes.value?.data?.results || secRes.value?.data || []);
      setAvailableSubjects(subRes.value?.data?.results || subRes.value?.data || []);
    });
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArrayItem(key, id) {
    setForm((f) => {
      const current = f[key] || [];
      const updated = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...f, [key]: updated };
    });
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
      if (data && typeof data === 'object') {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join('\n');
        setError(msg);
      } else {
        setError('Failed to create teacher account.');
      }
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';
  const label = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
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
        <div>
          <label className={label}>Phone</label>
          <input className={input} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Phone number" />
        </div>
        <div>
          <label className={label}>WhatsApp number</label>
          <input className={input} value={form.whatsapp_number} onChange={(e) => update('whatsapp_number', e.target.value)} placeholder="Defaults to phone if empty" />
        </div>
        <div className="col-span-2">
          <label className={label}>Password * (min 8 characters)</label>
          <input required minLength={8} type="password" className={input} value={form.password} onChange={(e) => update('password', e.target.value)} />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.must_change_password}
              onChange={(e) => update('must_change_password', e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Force password change on teacher's first login
            </span>
          </label>
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
        <div>
          <label className={label}>Address</label>
          <input className={input} value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Class Assignments */}
      <div>
        <label className={label}>Assign Classes</label>
        <div className="flex flex-wrap gap-2 pt-1">
          {availableClasses.map((c) => {
            const selected = form.classes.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleArrayItem('classes', c.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  selected
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {c.name}
              </button>
            );
          })}
          {availableClasses.length === 0 && <span className="text-xs text-slate-400">No classes found</span>}
        </div>
      </div>

      {/* Section Assignments */}
      {availableSections.length > 0 && (
        <div>
          <label className={label}>Assign Sections</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {availableSections.map((s) => {
              const selected = form.sections.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleArrayItem('sections', s.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subject Assignments */}
      {availableSubjects.length > 0 && (
        <div>
          <label className={label}>Assign Subjects</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {availableSubjects.map((sub) => {
              const selected = form.subjects.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => toggleArrayItem('subjects', sub.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? 'Creating Account…' : 'Create Teacher Account'}
        </button>
      </div>
    </form>
  );
}
