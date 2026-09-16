import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/client";

const AuthContext = createContext(null);


// ============================================================
// GET SAVED USER
// ============================================================

function getSavedUser() {
  try {
    const raw = localStorage.getItem("user");

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Invalid saved user:", error);

    localStorage.removeItem("user");

    return null;
  }
}


// ============================================================
// NORMALIZE USER
// ============================================================

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: user.role
      ? String(user.role).toUpperCase()
      : null,
  };
}


// ============================================================
// AUTH PROVIDER
// ============================================================

export function AuthProvider({ children }) {

  const [user, setUser] = useState(getSavedUser);

  const [loading, setLoading] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(
      localStorage.getItem("access_token")
    );
  });


  // ==========================================================
  // RESTORE LOGIN
  // ==========================================================

  useEffect(() => {

    const accessToken =
      localStorage.getItem("access_token");

    const savedUser = getSavedUser();

    if (accessToken && savedUser) {

      setUser(normalizeUser(savedUser));

      setIsAuthenticated(true);

    } else {

      setUser(null);

      setIsAuthenticated(false);
    }

  }, []);


  // ==========================================================
  // LOGIN
  // ==========================================================

  async function login(identifier, password) {

    setLoading(true);

    try {

      const cleanIdentifier =
        identifier.trim();

      if (!cleanIdentifier) {

        return {
          success: false,
          error: "Username/email/phone is required.",
        };
      }

      if (!password) {

        return {
          success: false,
          error: "Password is required.",
        };
      }


      // ======================================================
      // LOGIN API
      // ======================================================

      const response = await api.post(
        "/auth/login/",
        {
          username: cleanIdentifier,
          password: password,
        }
      );


      const data = response.data;

      console.log(
        "LOGIN RESPONSE:",
        data
      );


      // ======================================================
      // ACCESS TOKEN
      // ======================================================

      if (!data?.access) {

        return {
          success: false,
          error:
            data?.detail ||
            data?.message ||
            "Login failed. Access token was not returned.",
        };
      }


      // ======================================================
      // SAVE ACCESS TOKEN
      // ======================================================

      localStorage.setItem(
        "access_token",
        data.access
      );


      // ======================================================
      // SAVE REFRESH TOKEN
      // ======================================================

      if (data.refresh) {

        localStorage.setItem(
          "refresh_token",
          data.refresh
        );

      } else {

        localStorage.removeItem(
          "refresh_token"
        );
      }


      // ======================================================
      // USER
      // ======================================================

      let loggedInUser =
        data.user || null;


      // ======================================================
      // IF BACKEND DID NOT RETURN USER
      // TRY USER ENDPOINT
      // ======================================================

      if (!loggedInUser) {

        try {

          const userResponse =
            await api.get("/auth/me/");

          loggedInUser =
            userResponse.data;

        } catch (userError) {

          console.error(
            "Unable to fetch logged-in user:",
            userError?.response?.data ||
            userError?.message
          );
        }
      }


      // ======================================================
      // NORMALIZE USER
      // ======================================================

      loggedInUser =
        normalizeUser(loggedInUser);


      // ======================================================
      // USER ROLE REQUIRED
      // ======================================================

      if (!loggedInUser?.role) {

        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          "refresh_token"
        );

        localStorage.removeItem(
          "user"
        );

        setUser(null);

        setIsAuthenticated(false);

        return {
          success: false,
          error:
            "Login succeeded, but the server did not return the user role.",
        };
      }


      // ======================================================
      // SAVE USER
      // ======================================================

      localStorage.setItem(
        "user",
        JSON.stringify(loggedInUser)
      );


      // ======================================================
      // UPDATE STATE
      // ======================================================

      setUser(loggedInUser);

      setIsAuthenticated(true);


      // ======================================================
      // SUCCESS
      // ======================================================

      return {
        success: true,
        user: loggedInUser,
      };


    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );

      console.error(
        "SERVER RESPONSE:",
        error?.response?.data
      );


      const serverData =
        error?.response?.data;


      let errorMessage =
        "Login failed.";


      // ======================================================
      // NETWORK ERROR
      // ======================================================

      if (!error.response) {

        errorMessage =
          "Cannot connect to Django backend. Make sure the backend server is running.";
      }


      // ======================================================
      // SERVER ERROR
      // ======================================================

      else if (
        error.response.status >= 500
      ) {

        errorMessage =
          "Django server error. Check the backend terminal.";
      }


      // ======================================================
      // UNAUTHORIZED
      // ======================================================

      else if (
        error.response.status === 401
      ) {

        errorMessage =
          "Invalid username or password.";
      }


      // ======================================================
      // BAD REQUEST
      // ======================================================

      else if (
        error.response.status === 400
      ) {

        errorMessage =
          serverData?.detail ||
          serverData?.message ||
          "Invalid login information.";
      }


      // ======================================================
      // FORBIDDEN
      // ======================================================

      else if (
        error.response.status === 403
      ) {

        errorMessage =
          "You do not have permission to login.";
      }


      // ======================================================
      // NOT FOUND
      // ======================================================

      else if (
        error.response.status === 404
      ) {

        errorMessage =
          "Login API endpoint was not found.";
      }


      // ======================================================
      // DJANGO VALIDATION ERRORS
      // ======================================================

      if (
        serverData &&
        typeof serverData === "object"
      ) {

        const messages = [];

        Object.entries(serverData).forEach(
          ([field, value]) => {

            if (Array.isArray(value)) {

              messages.push(
                `${field}: ${value.join(", ")}`
              );

            } else {

              messages.push(
                `${field}: ${value}`
              );
            }
          }
        );

        if (messages.length > 0) {

          errorMessage =
            messages.join(" | ");
        }
      }


      return {
        success: false,
        error: errorMessage,
      };


    } finally {

      setLoading(false);
    }
  }


  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function logout() {

    const refreshToken =
      localStorage.getItem("refresh_token");

    try {

      if (refreshToken) {

        await api.post(
          "/auth/logout/",
          {
            refresh: refreshToken,
          }
        );
      }

    } catch (error) {

      console.warn(
        "Logout API failed:",
        error?.response?.data ||
        error?.message
      );

    } finally {

      localStorage.removeItem(
        "access_token"
      );

      localStorage.removeItem(
        "refresh_token"
      );

      localStorage.removeItem(
        "user"
      );

      setUser(null);

      setIsAuthenticated(false);

      setLoading(false);
    }
  }


  // ==========================================================
  // ROLE
  // ==========================================================

  const role = user?.role
    ? String(user.role).toUpperCase()
    : null;


  // ==========================================================
  // AUTH VALUE
  // ==========================================================

  const value = {

    user,

    setUser,

    login,

    logout,

    loading,

    isAuthenticated,

    role,

    isAdmin:
      role === "ADMIN",

    isTeacher:
      role === "TEACHER",

    isStudent:
      role === "STUDENT",
  };


  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


// ============================================================
// USE AUTH
// ============================================================

export function useAuth() {

  const context =
    useContext(AuthContext);

  if (!context) {

    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}


export default AuthContext;