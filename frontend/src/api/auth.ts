import { authClient, clearSession, setSession } from "./http";

type Credentials = {
  username: string;
  password: string;
};

type AuthResponse = {
  user: { id: number; username: string };
  accessToken: string;
  refreshToken: string;
};

export async function registerUser(credentials: Credentials) {
  const { data } = await authClient.post<AuthResponse>("/auth/register", credentials);
  setSession(data);
  return data;
}

export async function loginUser(credentials: Credentials) {
  const { data } = await authClient.post<AuthResponse>("/auth/login", credentials);
  setSession(data);
  return data;
}

export async function logoutUser() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (refreshToken) {
    try {
      await authClient.post("/auth/logout", { refreshToken });
    } catch (err) {
      console.warn("Odhlášení selhalo", err);
    }
  }
  clearSession();
}

export async function fetchCurrentUser() {
  const stored = localStorage.getItem("user");
  if (stored) return JSON.parse(stored);
  try {
    const { data } = await authClient.get<{ user: { id: number; username: string } }>("/auth/me", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });
    setSession({ user: data.user });
    return data.user;
  } catch (err) {
    clearSession();
    return null;
  }
}
