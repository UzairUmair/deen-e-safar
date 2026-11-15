export function apiOrigin(value: string) {
  try {
    const url = new URL(value.replace(/\/+$/, ""));
    if (url.origin !== value.replace(/\/+$/, "") || url.username || url.password) return "";
    if (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) return url.origin;
  } catch { /* An absent or invalid public origin leaves guest mode available. */ }
  return "";
}
export const API_BASE = apiOrigin(process.env.NEXT_PUBLIC_API_BASE_URL || "");
export class BackendError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
type Session = { uid: string; token: (refresh?: boolean) => Promise<string>; controller: AbortController };
let session: Session | null = null;
export function bindBackendSession(uid: string | null, token?: Session["token"]) {
  if (session?.uid === uid) { if (token) session.token = token; return; }
  session?.controller.abort();
  session = uid && token ? { uid, token, controller: new AbortController() } : null;
}
export const backendSessionUid = () => session?.uid || null;
export async function backendRequest<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; public?: boolean } = {}): Promise<{ data: T; meta?: { nextCursor: string | null } }> {
  if (!API_BASE) throw new BackendError(503, "BACKEND_NOT_CONFIGURED", "Account syncing is not configured.");
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  const owner = session;
  if (!options.public && !owner) throw new BackendError(401, "AUTH_REQUIRED", "Sign in to continue.");
  const signals = [options.signal, !options.public && owner?.controller.signal].filter(Boolean) as AbortSignal[];
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) { if (signal.aborted) controller.abort(); else signal.addEventListener("abort", abort, { once: true }); }
  const timeout = setTimeout(abort, path === "/api/ai/chat" ? 25000 : 12000);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = options.public ? null : await owner!.token(attempt === 1);
      if (!options.public && session !== owner) throw new DOMException("Account changed", "AbortError");
      const response = await fetch(API_BASE + path, {
        method: options.method || "GET", signal: controller.signal, credentials: "omit", cache: "no-store",
        headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      const result = await response.json().catch(() => null);
      if (!options.public && session !== owner) throw new DOMException("Account changed", "AbortError");
      if (response.status === 401 && !attempt && owner) continue;
      if (!response.ok) throw new BackendError(response.status, result?.error?.code || "REQUEST_FAILED", result?.error?.message || "Account request failed. Please retry.");
      if (!result || !("data" in result)) throw new BackendError(502, "INVALID_RESPONSE", "Account service returned an invalid response.");
      return result;
    }
    throw new BackendError(401, "INVALID_TOKEN", "Sign in again.");
  } finally { clearTimeout(timeout); signals.forEach(signal => signal.removeEventListener("abort", abort)); }
}
