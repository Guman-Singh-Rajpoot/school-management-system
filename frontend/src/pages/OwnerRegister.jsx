import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const INITIAL_FORM = {
  school_name: '',
  registration_number: '',
  affiliation_number: '',
  address: '',
  city: '',
  state: '',
  pin_code: '',
  school_email: '',
  school_contact_number: '',
  owner_full_name: '',
  owner_username: '',
  owner_email: '',
  owner_phone: '',
  password: '',
  password_confirm: '',
};

export default function OwnerRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  }

  function validateForm() {
    const required = [
      'school_name',
      'owner_full_name',
      'owner_username',
      'owner_email',
      'password',
      'password_confirm',
    ];
    for (const field of required) {
      if (!formData[field]?.trim()) {
        return `Please fill in the ${field.replace('_', ' ')}.`;
      }
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (formData.password !== formData.password_confirm) {
      return 'Passwords do not match.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setLoading(true);
      const payload = { ...formData };
      await api.post('/auth/owner-register/', payload);
      setSuccess('School and owner registration successful. You can now log in.');
      setFormData(INITIAL_FORM);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      console.error('Owner registration error:', err);
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const messages = Object.values(data).flat().join(' ');
        setError(messages || 'Registration failed.');
      } else {
        setError('Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold mb-4 text-center">School Owner Registration</h2>
      {error && <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">{error}</div>}
      {success && <div className="mb-4 p-2 bg-green-100 text-green-800 rounded">{success}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* School Information */}
        <div>
          <label className="block font-medium" htmlFor="school_name">School Name *</label>
          <input
            type="text"
            id="school_name"
            name="school_name"
            value={formData.school_name}
            onChange={handleChange}
            className="mt-1 w-full border rounded p-2"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium" htmlFor="registration_number">Registration Number</label>
            <input
              type="text"
              id="registration_number"
              name="registration_number"
              value={formData.registration_number}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="affiliation_number">Affiliation Number</label>
            <input
              type="text"
              id="affiliation_number"
              name="affiliation_number"
              value={formData.affiliation_number}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
        </div>
        <div>
          <label className="block font-medium" htmlFor="address">Address</label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="mt-1 w-full border rounded p-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium" htmlFor="city">City</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="state">State</label>
            <input
              type="text"
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="pin_code">PIN Code</label>
            <input
              type="text"
              id="pin_code"
              name="pin_code"
              value={formData.pin_code}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium" htmlFor="school_email">School Email</label>
            <input
              type="email"
              id="school_email"
              name="school_email"
              value={formData.school_email}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="school_contact_number">School Contact Number</label>
            <input
              type="text"
              id="school_contact_number"
              name="school_contact_number"
              value={formData.school_contact_number}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
        </div>
        {/* Owner Information */}
        <div>
          <label className="block font-medium" htmlFor="owner_full_name">Owner Full Name *</label>
          <input
            type="text"
            id="owner_full_name"
            name="owner_full_name"
            value={formData.owner_full_name}
            onChange={handleChange}
            className="mt-1 w-full border rounded p-2"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium" htmlFor="owner_username">Username *</label>
            <input
              type="text"
              id="owner_username"
              name="owner_username"
              value={formData.owner_username}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
              required
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="owner_email">Email *</label>
            <input
              type="email"
              id="owner_email"
              name="owner_email"
              value={formData.owner_email}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
              required
            />
          </div>
        </div>
        <div>
          <label className="block font-medium" htmlFor="owner_phone">Phone Number</label>
          <input
            type="text"
            id="owner_phone"
            name="owner_phone"
            value={formData.owner_phone}
            onChange={handleChange}
            className="mt-1 w-full border rounded p-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium" htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
              required
            />
          </div>
          <div>
            <label className="block font-medium" htmlFor="password_confirm">Confirm Password *</label>
            <input
              type="password"
              id="password_confirm"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              className="mt-1 w-full border rounded p-2"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
        >
          {loading ? 'Registering...' : 'Register School & Owner'}
        </button>
      </form>
    </div>
  );
}
