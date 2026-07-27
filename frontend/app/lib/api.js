// Shared fetch wrapper for every authenticated call. `credentials: "include"`
// is what makes the browser send/accept the httpOnly session cookie set by
// the backend's /auth/* routes — every other component that talks to the
// API should go through this rather than calling fetch directly.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")
      : detail || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, detail);
  }

  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: (path) => apiFetch(path, { method: "DELETE" }),
};

export function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed || "guest")}`;
}
