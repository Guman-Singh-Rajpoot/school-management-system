
import axios from "axios";

/*
|--------------------------------------------------------------------------
| Axios API Client
|--------------------------------------------------------------------------
| All API requests go through this instance.
|
| Both formats are supported:
|   api.get("/students/")
|   api.get("/api/students/")
|
| Both will reach Django as:
|   /api/students/
|--------------------------------------------------------------------------
*/

function getBaseURL() {
  const envUrl = import.meta.env.VITE_API_URL;

  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    // Remove trailing slashes and an optional /api suffix.
    return envUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/api$/i, "");
  }

  // In development, Vite proxies /api to Django.
  if (import.meta.env.DEV) {
    return "";
  }

  // Production fallback: deployed Render backend.
  return "https://school-management-system-backend-13fd.onrender.com";
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

/*
|--------------------------------------------------------------------------
| REQUEST INTERCEPTOR
|--------------------------------------------------------------------------
| Normalize API paths so every relative request has exactly one /api prefix.
| Attach the JWT access token to protected endpoints.
|--------------------------------------------------------------------------
*/

api.interceptors.request.use(
  (config) => {
    if (config.url && !/^https?:\/\//i.test(config.url)) {
      const path = config.url.startsWith("/")
        ? config.url
        : `/${config.url}`;

      config.url =
        path === "/api" || path.startsWith("/api/")
          ? path
          : `/api${path}`;
    }

    const accessToken = localStorage.getItem("access_token");

    const isPublicEndpoint =
      config.url?.includes("/auth/login/") ||
      config.url?.includes("/auth/register/") ||
      config.url?.includes("/auth/refresh/") ||
      config.url?.includes("/auth/password-reset/") ||
      config.url?.includes("/health/");

    if (accessToken && !isPublicEndpoint) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/*
|--------------------------------------------------------------------------
| TOKEN REFRESH
|--------------------------------------------------------------------------
*/

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
}

/*
|--------------------------------------------------------------------------
| RESPONSE INTERCEPTOR
|--------------------------------------------------------------------------
*/

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Server not reachable
    if (!error.response) {
      console.error("API server is not reachable.");
      return Promise.reject(error);
    }

    // Only handle 401 responses.
    if (
      error.response.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    // Do not refresh login or refresh requests themselves.
    if (
      originalRequest.url?.includes("/auth/login/") ||
      originalRequest.url?.includes("/auth/token/") ||
      originalRequest.url?.includes("/auth/refresh/") ||
      originalRequest.url?.includes("/auth/password-reset/")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = localStorage.getItem("refresh_token");

    // No refresh token available.
    if (!refreshToken) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");

      window.location.href = "/login";

      return Promise.reject(error);
    }

    // Wait if another request is already refreshing the token.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;

            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    // Start token refresh.
    isRefreshing = true;

    try {
      const response = await api.post("/auth/refresh/", {
        refresh: refreshToken,
      });

      const newAccessToken = response.data?.access;

      if (!newAccessToken) {
        throw new Error(
          "Refresh API did not return an access token."
        );
      }

      // Save the new access token.
      localStorage.setItem("access_token", newAccessToken);

      // Retry queued requests.
      processQueue(null, newAccessToken);

      // Retry the original request.
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return api(originalRequest);

    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);

      processQueue(refreshError, null);

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");

      window.location.href = "/login";

      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  }
);

/*
|--------------------------------------------------------------------------
| BACKEND HEALTH CHECK
|--------------------------------------------------------------------------
*/

export async function checkBackendHealth() {
  try {
    const response = await api.get("/health/");
    return response.data;
  } catch (error) {
    return {
      status: "unreachable",
      error: error.response?.data || error.message,
    };
  }
}

export default api;
