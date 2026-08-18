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
