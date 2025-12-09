import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

type SessionPayload = {
  accessToken?: string;
  refreshToken?: string;
  user?: { id: number; username: string };
};

const AUTH_BASE = import.meta.env.VITE_AUTH_SERVICE_URL || "http://localhost:4002";
const BANK_BASE = import.meta.env.VITE_BANK_SERVICE_URL || "http://localhost:4000";
const ANALYTICS_BASE = import.meta.env.VITE_ANALYTICS_SERVICE_URL || "http://localhost:4001";

// Samostatní klienti pro Auth/Bank/Analytics; tokeny přidáváme interceptorům níže.
export const authClient = axios.create({ baseURL: AUTH_BASE });

let refreshPromise: Promise<string | null> | null = null;

const attachAuthInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("accessToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest: any = error.config;
      if (
        error.response?.status === 401 &&
        !originalRequest?._retry &&
        originalRequest?.url !== "/auth/refresh"
      ) {
        originalRequest._retry = true;
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newAccess}`,
          };
          return instance(originalRequest);
        }
      }
      return Promise.reject(error);
    }
  );
};

export const bankClient = axios.create({ baseURL: BANK_BASE });
export const analyticsClient = axios.create({ baseURL: ANALYTICS_BASE });

attachAuthInterceptor(bankClient);
attachAuthInterceptor(analyticsClient);

export function setSession(data: SessionPayload) {
  if (data.accessToken) {
    localStorage.setItem("accessToken", data.accessToken);
  }
  if (data.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    clearSession();
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = authClient
      .post("/auth/refresh", { refreshToken })
      .then((response) => {
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        setSession({ ...response.data, accessToken, refreshToken: newRefreshToken });
        return accessToken || null;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("accessToken"));
}
