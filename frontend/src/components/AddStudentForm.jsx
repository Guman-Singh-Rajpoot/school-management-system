import { useEffect, useState } from 'react';
import api from '../api/client';

const initial = {
  username: '', email: '', first_name: '', last_name: '', password: '',
  admission_number: '', roll_number: '', gender: 'M', date_of_birth: '',
  admission_date: '', session: '', school_class: '', section: '',
  mobile_number: '', father_name: '', mother_name: '',
};

export default function AddStudentForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(initial);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/academics/sessions/').then((res) => setSessions(res.data.results || res.data || []));
  }, []);

  useEffect(() => {
    if (!form.session) return setClasses([]);
    api
      .get('/academics/classes/', { params: { session: form.session } })
      .then((res) => setClasses(res.data.results || res.data || []));
  }, [form.session]);

  useEffect(() => {
    if (!form.school_class) return setSections([]);
    api
      .get('/academics/sections/', { params: { school_class: form.school_class } })
      .then((res) => setSections(res.data.results || res.data || []));
  }, [form.school_class]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (!payload.section) delete payload.section;
      await api.post('/students/', payload);
      onCreated();
    } catch (err) {
      const data = err.response?.data;
      setError(data ? JSON.stringify(data) : 'Failed to create student.');
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
          <label className={label}>Admission number *</label>
          <input required className={input} value={form.admission_number} onChange={(e) => update('admission_number', e.target.value)} />
        </div>
        <div>
          <label className={label}>Roll number</label>
          <input className={input} value={form.roll_number} onChange={(e) => update('roll_number', e.target.value)} />
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
          <label className={label}>Admission date *</label>
          <input required type="date" className={input} value={form.admission_date} onChange={(e) => update('admission_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>Mobile number</label>
          <input className={input} value={form.mobile_number} onChange={(e) => update('mobile_number', e.target.value)} />
        </div>
        <div>
          <label className={label}>Session</label>
          <select className={input} value={form.session} onChange={(e) => update('session', e.target.value)}>
            <option value="">—</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Class</label>
          <select className={input} value={form.school_class} onChange={(e) => update('school_class', e.target.value)}>
            <option value="">—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Section</label>
          <select className={input} value={form.section} onChange={(e) => update('section', e.target.value)}>
            <option value="">—</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Father's name</label>
          <input className={input} value={form.father_name} onChange={(e) => update('father_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Mother's name</label>
          <input className={input} value={form.mother_name} onChange={(e) => update('mother_name', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 break-words">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Add student'}
        </button>
      </div>
    </form>
  );
}
