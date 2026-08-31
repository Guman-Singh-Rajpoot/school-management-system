
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

const INITIAL_FORM = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  school_name: '',
  role: 'STUDENT',
  password: '',
  password_confirm: '',
};

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ==========================================================
  // INPUT CHANGE
  // ==========================================================

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    // Remove old error while user is typing
    if (error) {
      setError('');
    }
  }


  // ==========================================================
  // ROLE CHANGE
  // ==========================================================

  function handleRoleChange(role) {
    setFormData((previous) => ({
      ...previous,
      role,
    }));

    setError('');
  }


  // ==========================================================
  // VALIDATION
  // ==========================================================

  function validateForm() {

    if (!formData.first_name.trim()) {
      return 'Please enter your first name.';
    }

    if (!formData.last_name.trim()) {
      return 'Please enter your last name.';
    }

    if (!formData.username.trim()) {
      return 'Please enter a username.';
    }

    if (!formData.email.trim()) {
      return 'Please enter your email address.';
    }

    if (!formData.phone.trim()) {
      return 'Please enter your phone number.';
    }

    if (!formData.school_name.trim()) {
      return 'Please enter your school name.';
    }

    if (!formData.password) {
      return 'Please enter a password.';
    }

    if (formData.password.length < 8) {
      return 'Password must contain at least 8 characters.';
    }

    if (!formData.password_confirm) {
      return 'Please confirm your password.';
    }

    if (
      formData.password !==
      formData.password_confirm
    ) {
      return 'Passwords do not match.';
    }

    return null;
  }


  // ==========================================================
  // SUBMIT REGISTRATION
  // ==========================================================

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


      // ------------------------------------------------------
      // Prepare data
      // ------------------------------------------------------

      const payload = {
        username: formData.username.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        school_name: formData.school_name.trim(),
        role: formData.role,
        password: formData.password,
        password_confirm: formData.password_confirm,
      };


      // ------------------------------------------------------
      // Register
      // ------------------------------------------------------

      await api.post(
        '/auth/register/',
        payload
      );


      // ------------------------------------------------------
      // Success
      // ------------------------------------------------------

      setSuccess(
        'Registration successful. You can now login.'
      );


      // Clear form
      setFormData(INITIAL_FORM);


      // Redirect to login
      setTimeout(() => {
        navigate('/login', {
          replace: true,
        });
      }, 1500);


    } catch (err) {

      console.error(
        'Registration error:',
        err
      );


      const data = err.response?.data;


      // ------------------------------------------------------
      // Backend validation errors
      // ------------------------------------------------------

      if (data) {

        if (typeof data === 'string') {

          setError(data);

        } else if (data.detail) {

          setError(String(data.detail));

        } else if (data.message) {

          setError(String(data.message));

        } else {

          const messages = Object.entries(data)
            .map(([field, message]) => {

              const text = Array.isArray(message)
                ? message.join(', ')
                : typeof message === 'object'
                  ? JSON.stringify(message)
                  : String(message);

              return `${field}: ${text}`;
            })
            .join('\n');

          setError(
            messages ||
            'Registration failed.'
          );
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


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-8">

      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-slate-800">
            Create Account
          </h1>

          <p className="mt-2 text-slate-500">
            Register for the School Management System
          </p>

        </div>


        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-line"
          >
            {error}
          </div>
        )}


        {/* ====================================================
            SUCCESS
        ==================================================== */}

        {success && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            {success}
          </div>
        )}


        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* ==================================================
              ROLE
          ================================================== */}

          <div>

            <label className="block text-sm font-medium text-slate-700 mb-2">
              Account Type
            </label>

            <div className="grid grid-cols-3 gap-3">

              {/* STUDENT */}

              <label
                className={`cursor-pointer rounded-lg border p-4 text-center transition ${
                  formData.role === 'STUDENT'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >

                <input
                  type="radio"
                  name="role"
                  value="STUDENT"
                  checked={
                    formData.role === 'STUDENT'
                  }
                  onChange={() =>
                    handleRoleChange('STUDENT')
                  }
                  className="sr-only"
                />

                <span className="font-medium">
                  Student
                </span>

              </label>


              {/* TEACHER */}

              <label
                className={`cursor-pointer rounded-lg border p-4 text-center transition ${
                  formData.role === 'TEACHER'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 hover:border-green-300'
                }`}
              >

                <input
                  type="radio"
                  name="role"
                  value="TEACHER"
                  checked={
                    formData.role === 'TEACHER'
                  }
                  onChange={() =>
                    handleRoleChange('TEACHER')
                  }
                  className="sr-only"
                />

                <span className="font-medium">
                  Teacher
                </span>

              </label>


              {/* ADMIN */}

              <label
                className={`cursor-pointer rounded-lg border p-4 text-center transition ${
                  formData.role === 'ADMIN'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >

                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={
                    formData.role === 'ADMIN'
                  }
                  onChange={() =>
                    handleRoleChange('ADMIN')
                  }
                  className="sr-only"
                />

                <span className="font-medium">
                  Admin
                </span>

              </label>

            </div>

            <p className="mt-2 text-xs text-slate-500">
              Admin registration must also be authorized by
              the backend. Selecting Admin here must never
              bypass backend permissions.
            </p>

          </div>


          {/* ==================================================
              NAME
          ================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* FIRST NAME */}

            <div>

              <label
                htmlFor="first_name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                First Name
              </label>

              <input
                id="first_name"
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="given-name"
                placeholder="Enter first name"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
              />

            </div>


            {/* LAST NAME */}

            <div>

              <label
                htmlFor="last_name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Last Name
              </label>

              <input
                id="last_name"
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="family-name"
                placeholder="Enter last name"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
              />

            </div>

          </div>


          {/* ==================================================
              USERNAME
          ================================================== */}

          <div>

            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Username
            </label>

            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="username"
              placeholder="Choose a username"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              EMAIL
          ================================================== */}

          <div>

            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="email"
              placeholder="example@email.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              PHONE
          ================================================== */}

          <div>

            <label
              htmlFor="phone"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Phone Number
            </label>

            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="tel"
              placeholder="Enter phone number"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              SCHOOL
          ================================================== */}

          <div>

            <label
              htmlFor="school_name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              School Name
            </label>

            <input
              id="school_name"
              type="text"
              name="school_name"
              value={formData.school_name}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter school name"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              PASSWORD
          ================================================== */}

          <div>

            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              CONFIRM PASSWORD
          ================================================== */}

          <div>

            <label
              htmlFor="password_confirm"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Confirm Password
            </label>

            <input
              id="password_confirm"
              type="password"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
              placeholder="Re-enter password"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />

          </div>


          {/* ==================================================
              SUBMIT
          ================================================== */}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {loading
              ? 'Creating Account...'
              : 'Create Account'}
          </button>

        </form>


        {/* ====================================================
            LOGIN LINK
        ==================================================== */}

        <div className="mt-6 text-center text-sm text-slate-600">

          Already have an account?{' '}

          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Login
          </Link>

        </div>

      </div>

    </div>
  );
}

