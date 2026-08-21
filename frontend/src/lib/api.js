import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8001").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

// Stable guest id so anonymous analyses stay owned by this browser.
function getGuestId() {
  let id = localStorage.getItem("baseline_guest_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 14);
    localStorage.setItem("baseline_guest_id", id);
  }
  return id;
}

export const client = axios.create({
  baseURL: API,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  config.headers["X-Guest-Id"] = getGuestId();
  return config;
});

// Silent session refresh: the access_token cookie expires after 7 days, but the
// refresh_token cookie is valid for 30. Without this, a signed-in user would look
// logged out after 7 days even though their session should still be renewable.
// POST /api/auth/refresh was already implemented backend-side with zero caller.
const AUTH_EXEMPT_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/google"];
let refreshPromise = null;

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isExempt = AUTH_EXEMPT_PATHS.some((p) => config?.url?.startsWith(p));
    if (response?.status === 401 && config && !config._retried && !isExempt) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = client.post("/auth/refresh").finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        return client(config);
      } catch (_) {
        // Refresh itself failed (refresh_token also expired/missing) -- fall
        // through to the original 401 so callers see the real "not signed in" state.
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export async function track(event, props = {}) {
  try {
    await client.post("/analytics", { event, props });
  } catch (_) {
    /* analytics failures must never break UX */
  }
}
