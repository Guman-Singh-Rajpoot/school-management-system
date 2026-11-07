
import axios from "axios";

/*
|--------------------------------------------------------------------------
| Axios API Client
|--------------------------------------------------------------------------
| All API requests go through this instance.
|
| React:
|   api.get("/students/")
|
| Django:
|   /api/students/
|--------------------------------------------------------------------------
*/

function getBaseURL() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  // In development, default to "/api" which Vite proxies to http://127.0.0.1:8000
  if (import.meta.env.DEV) {
    return "/api";
  }
   return "http://localhost:8000/api";
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
| Automatically attach JWT access token for authenticated endpoints.
| Omit for login, refresh, register, and health checks to avoid sending
| expired tokens that cause 401s on unauthenticated views.
|--------------------------------------------------------------------------
*/

api.interceptors.request.use(
  (config) => {
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

    /*
    |--------------------------------------------------------------------------
    | Server not reachable
    |--------------------------------------------------------------------------
    */

    if (!error.response) {
      console.error("API server is not reachable.");
      return Promise.reject(error);
    }

    /*
    |--------------------------------------------------------------------------
    | Only handle 401
    |--------------------------------------------------------------------------
    */

    if (
      error.response.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    /*
    |--------------------------------------------------------------------------
    | Don't refresh the login/refresh endpoint itself
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | No refresh token
    |--------------------------------------------------------------------------
    */

    if (!refreshToken) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");

      window.location.href = "/login";

      return Promise.reject(error);
    }

    /*
    |--------------------------------------------------------------------------
    | If another request is refreshing, wait
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Start refresh
    |--------------------------------------------------------------------------
    */

    isRefreshing = true;

    try {
      /*
      IMPORTANT:
      Use the same Axios instance so the request goes through
      the Vite -> Django /api proxy.
      */

      const response = await api.post("/auth/refresh/", {
        refresh: refreshToken,
      });

      const newAccessToken = response.data?.access;

      if (!newAccessToken) {
        throw new Error(
          "Refresh API did not return an access token."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Save new access token
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        "access_token",
        newAccessToken
      );

      /*
      |--------------------------------------------------------------------------
      | Resolve queued requests
      |--------------------------------------------------------------------------
      */

      processQueue(null, newAccessToken);

      /*
      |--------------------------------------------------------------------------
      | Retry original request
      |--------------------------------------------------------------------------
      */

      originalRequest.headers = originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      return api(originalRequest);

    } catch (refreshError) {
      console.error(
        "Token refresh failed:",
        refreshError
      );

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

