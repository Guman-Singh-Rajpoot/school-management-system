import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, Eye, EyeOff, User, Lock } from "lucide-react";

const ROLE_HOME = {
  ADMIN: "/admin",
  OWNER: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
};



export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      if (!result) {
        setError("Login failed. No response received.");
        return;
      }

      if (result.success === false) {
        setError(
          result.error ||
            result.message ||
            "Invalid username, email, phone or password."
        );
        return;
      }

      // Get logged-in user
      let loggedInUser = result.user || null;

      if (!loggedInUser) {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          try {
            loggedInUser = JSON.parse(savedUser);
          } catch (parseError) {
            console.error("Error parsing saved user:", parseError);
          }
        }
      }

      console.log("LOGGED IN USER:", loggedInUser);

      if (!loggedInUser) {
        setError(
          "Login succeeded, but user information was not returned."
        );
        return;
      }

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

      const destination = ROLE_HOME[role];

      if (!destination) {
        setError(
          `Invalid user role: ${role}. Please contact the administrator.`
        );
        return;
      }

      console.log(`Login successful. Redirecting ${role} to ${destination}`);

      // If the account was created with a temporary password, force change first.
      if (loggedInUser?.must_change_password) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      const responseData = err?.response?.data;
      let errorMessage = "Login failed. Please check your credentials.";

      if (responseData) {
        if (typeof responseData === "string") {
          errorMessage = responseData;
        } else if (responseData.detail) {
          errorMessage = String(responseData.detail);
        } else if (responseData.message) {
          errorMessage = String(responseData.message);
        } else if (responseData.error) {
          errorMessage = String(responseData.error);
        } else if (responseData.non_field_errors) {
          errorMessage = Array.isArray(responseData.non_field_errors)
            ? responseData.non_field_errors.join(" ")
            : String(responseData.non_field_errors);
        } else if (responseData.username) {
          errorMessage = Array.isArray(responseData.username)
            ? responseData.username.join(" ")
            : String(responseData.username);
        } else if (responseData.password) {
          errorMessage = Array.isArray(responseData.password)
            ? responseData.password.join(" ")
            : String(responseData.password);
        }
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
        {/* LOGO */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-3 shadow-md shadow-brand-500/20">
            <GraduationCap size={26} />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 dark:text-white text-center">
            School Management System
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sign in to your account
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identifier */}
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
            >
              Username / Email / Phone
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </span>
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
            >
              Password
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
              className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900/50"
            >
              {error}
            </div>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors shadow-sm"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* ADMINISTRATIVE NOTICE */}
        <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          Account credentials are created and managed by the school administrator.
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">New School? Register Your School</p>
          <Link to="/owner-register" className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg px-4 py-2 transition-colors">
            Admin Sign Up / Register Your School
          </Link>
        </div>

      </div>
    </div>
  );
}