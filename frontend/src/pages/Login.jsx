import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GraduationCap } from "lucide-react";

const ROLE_HOME = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
};

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      setError("Please enter your username, email or phone number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      console.log("Attempting login:", cleanIdentifier);

      const result = await login(cleanIdentifier, password);

      console.log("LOGIN RESULT:", result);

      // -------------------------------------------------------
      // Check login result
      // -------------------------------------------------------

      if (!result) {
        setError("Login failed. No response received.");
        return;
      }

      if (result.success === false) {
        setError(
          result.error ||
            result.message ||
            "Invalid username/email/phone or password."
        );
        return;
      }

      // -------------------------------------------------------
      // Get logged-in user
      // -------------------------------------------------------

      let loggedInUser = result.user || null;

      // If AuthContext didn't return user,
      // try localStorage.
      if (!loggedInUser) {
        const savedUser = localStorage.getItem("user");

        if (savedUser) {
          try {
            loggedInUser = JSON.parse(savedUser);
          } catch (parseError) {
            console.error(
              "Error parsing saved user:",
              parseError
            );
          }
        }
      }

      console.log("LOGGED IN USER:", loggedInUser);

      // -------------------------------------------------------
      // Validate user
      // -------------------------------------------------------

      if (!loggedInUser) {
        setError(
          "Login succeeded, but user information was not returned."
        );
        return;
      }

      // -------------------------------------------------------
      // Get role
      // -------------------------------------------------------

      const role = String(
        loggedInUser.role ||
          loggedInUser.user_role ||
          loggedInUser.type ||
          ""
      ).toUpperCase();

      console.log("USER ROLE:", role);

      if (!role) {
        setError(
          "Login succeeded, but the user role was not returned by the server."
        );
        return;
      }

      // -------------------------------------------------------
      // Find dashboard
      // -------------------------------------------------------

      const destination = ROLE_HOME[role];

      if (!destination) {
        setError(
          `Invalid user role: ${role}. Please contact the administrator.`
        );
        return;
      }

      // -------------------------------------------------------
      // Redirect
      // -------------------------------------------------------

      console.log(
        `Login successful. Redirecting ${role} to ${destination}`
      );

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      // Django / DRF error handling
      const responseData = err?.response?.data;

      let errorMessage =
        "Login failed. Please check your credentials.";

      if (responseData) {
        if (typeof responseData === "string") {
          errorMessage = responseData;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.non_field_errors) {
          errorMessage = Array.isArray(
            responseData.non_field_errors
          )
            ? responseData.non_field_errors.join(" ")
            : responseData.non_field_errors;
        }
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">

        {/* =====================================================
            LOGO
        ====================================================== */}

        <div className="flex flex-col items-center mb-6">

          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-3">
            <GraduationCap size={26} />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 dark:text-white text-center">
            School Management System
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sign in to your account
          </p>

        </div>

        {/* =====================================================
            LOGIN FORM
        ====================================================== */}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* Identifier */}

          <div>

            <label
              htmlFor="identifier"
              className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
            >
              Username / Email / Phone
            </label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError("");
              }}
              autoComplete="username"
              placeholder="Enter username, email or phone"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />

          </div>

          {/* Password */}

          <div>

            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />

          </div>

          {/* Forgot password */}

          <div className="flex justify-end">

            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Forgot password?
            </Link>

          </div>

          {/* Error */}

          {error && (
            <div
              role="alert"
              className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          {/* Login button */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

        </form>

        {/* =====================================================
            REGISTER
        ====================================================== */}

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">

          Don't have an account?{" "}

          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Register
          </Link>

        </div>

        {/* =====================================================
            ACCOUNT TYPES
        ====================================================== */}

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">

          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-3">
            Available account types
          </p>

          <div className="flex justify-center gap-2 text-xs">

            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
              Student
            </span>

            <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400">
              Teacher
            </span>

            <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">
              Admin
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}