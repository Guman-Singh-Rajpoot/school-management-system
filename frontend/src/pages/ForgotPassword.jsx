import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { GraduationCap, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (!identifier.trim()) {
      setError('Please enter your email or phone number.');
      return;
    }

    try {
      setLoading(true);

      await api.post('/auth/password-reset/request/', {
        identifier: identifier.trim(),
      });

      setSuccess(
        'If an account exists with this email or phone number, a password recovery code has been sent.'
      );
    } catch (err) {
      console.error(err);

      const data = err.response?.data;

      if (data) {
        if (typeof data === 'string') {
          setError(data);
        } else {
          const messages = Object.entries(data)
            .map(([field, message]) => {
              const text = Array.isArray(message)
                ? message.join(', ')
                : message;

              return `${field}: ${text}`;
            })
            .join('\n');

          setError(messages || 'Password recovery failed.');
        }
      } else {
        setError(
          'Unable to connect to the server. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">

          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-3">
            <GraduationCap size={26} />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Forgot Password
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            Enter your registered email or phone number to recover your account.
          </p>

        </div>


        {/* Error */}
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-3 py-2 whitespace-pre-line">
            {error}
          </div>
        )}


        {/* Success */}
        {success && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400 rounded-lg px-3 py-2">
            {success}
          </div>
        )}


        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>

            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
              Email or Phone
            </label>

            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="Email or phone number"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

          </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading
              ? 'Sending...'
              : 'Recover Password'}
          </button>

        </form>


        {/* Back to Login */}
        <div className="mt-6 text-center">

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>

        </div>

      </div>

    </div>
  );
}