import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { GraduationCap, ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      setValidationError('No password reset token was provided in the link.');
      return;
    }

    async function validateToken() {
      try {
        setValidating(true);
        const res = await api.post('/auth/password-reset/validate/', { token });
        if (res.data?.valid) {
          setTokenValid(true);
          setUsername(res.data.username || '');
        } else {
          setTokenValid(false);
          setValidationError(res.data?.detail || 'This reset link is invalid or expired.');
        }
      } catch (err) {
        setTokenValid(false);
        setValidationError(err.response?.data?.detail || 'This reset link is invalid or has expired.');
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/auth/password-reset/confirm/', {
        token,
        password,
        password_confirm: passwordConfirm,
      });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      if (data?.detail) {
        setError(data.detail);
      } else if (data?.password) {
        setError(Array.isArray(data.password) ? data.password.join(' ') : data.password);
      } else if (data?.password_confirm) {
        setError(Array.isArray(data.password_confirm) ? data.password_confirm.join(' ') : data.password_confirm);
      } else {
        setError('Failed to reset password. Please try requesting a new link.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-3 shadow-md shadow-brand-500/20">
            <GraduationCap size={26} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Set New Password
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
            {username ? `Create a new password for @${username}` : 'Create a secure new password for your account'}
          </p>
        </div>

        {/* Loading validation */}
        {validating && (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Validating security token...
          </div>
        )}

        {/* Invalid Token State */}
        {!validating && !tokenValid && !success && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Reset Link Invalid or Expired</p>
                <p className="mt-1 text-xs">{validationError}</p>
              </div>
            </div>
            <Link
              to="/forgot-password"
              className="block w-full py-2.5 px-4 text-center rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white transition-colors"
            >
              Request a New Link
            </Link>
            <div className="text-center pt-2">
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Back to Login
              </Link>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center text-green-600 dark:text-green-400">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Password Updated!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your password has been securely reset. You can now log in using your new credentials.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        )}

        {/* Password Reset Form */}
        {!validating && tokenValid && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors shadow-sm"
            >
              {saving ? 'Resetting Password...' : 'Save New Password'}
            </button>

            <div className="pt-2 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">
                <ArrowLeft size={16} />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
