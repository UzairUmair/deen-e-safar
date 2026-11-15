import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Reload this graph after setting public configuration; no production service is contacted.
let account: typeof import("../../app/services/account/accountStore");
let client: typeof import("../../app/services/account/backendClient");
let bookmarks: typeof import("../../app/services/guest/bookmarkStorage");
let preferences: typeof import("../../app/services/guest/preferencesStorage");
let migration: typeof import("../../app/services/account/guestImport");
let profile, rows, calls: { path: string; method: string; body: Record<string, unknown>; token: string }[], fail = false, conflict = false;
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  client = await import("../../app/services/account/backendClient"); account = await import("../../app/services/account/accountStore");
  bookmarks = await import("../../app/services/guest/bookmarkStorage"); preferences = await import("../../app/services/guest/preferencesStorage"); migration = await import("../../app/services/account/guestImport");
  calls = []; rows = []; fail = false; conflict = false;
  profile = { id: "profile-alice", name: "Alice", role: "user", email: "alice@example.test", version: 0, preferences: preferences.preferencesStore.get() };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname, method = init.method || "GET", body = init.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path, method, body, token: init.headers["Authorization"] });
    if (fail) throw new TypeError("Failed to fetch");
    if (conflict && method === "PATCH") return new Response(JSON.stringify({ error: { code: "VERSION_CONFLICT", message: "A newer version exists." } }), { status: 409 });
    let data;
    if (path === "/api/users/me") { if (method === "PATCH") profile = { ...profile, version: profile.version + 1, preferences: { ...profile.preferences, ...body.preferences } }; data = profile; }
    else if (path === "/api/bookmarks") { if (method === "POST") rows.push({ ...body, id: "bookmark-1", createdAt: "2026-11-15T00:00:00Z" }); data = rows; if (method === "POST") data = rows.at(-1); }
    else if (path.includes("guest-import")) data = { imported: true };
    else data = [];
    return new Response(JSON.stringify({ data, meta: { nextCursor: null } }), { status: 200 });
  }));
});
afterEach(() => { client.bindBackendSession(null); account.setAccountIdentity(null); account.releaseGuestWrites(); vi.unstubAllEnvs(); });
async function login(uid = "alice") { client.bindBackendSession(uid, async () => "controlled-token-for-" + uid); account.setAccountIdentity(uid); await account.hydrateAccount(); }
const eventually = (run: () => void) => vi.waitFor(run, { timeout: 3000 });

describe("account storage boundary", () => {
  it("accepts explicit API origins and rejects paths, credentials and insecure production URLs", () => {
    expect(client.apiOrigin("https://api.example.test/")).toBe("https://api.example.test");
    expect(client.apiOrigin("https://api.example.test/api")).toBe(""); expect(client.apiOrigin("https://user:placeholder@api.example.test")).toBe("");
    vi.stubEnv("NODE_ENV", "production"); expect(client.apiOrigin("http://127.0.0.1:4000")).toBe("");
  });
  it("keeps guest data untouched and private data out of localStorage across account switches", async () => {
    bookmarks.toggleVerseBookmark(1, 1); const guest = localStorage.getItem(bookmarks.bookmarkStore.key);
    await login(); expect(bookmarks.bookmarkStore.get().quran).toEqual([]);
    bookmarks.toggleVerseBookmark(2, 255);
    await eventually(() => expect(account.getAccountState().pending).toBe(0));
    expect(calls.find(c => c.method === "POST")?.token).toBe("Bearer controlled-token-for-alice");
    expect(localStorage.getItem(bookmarks.bookmarkStore.key)).toBe(guest);
    expect(Object.values(localStorage).join("")).not.toContain('"surah":2');
    account.setAccountIdentity("bob"); expect(bookmarks.bookmarkStore.get().quran).toEqual([]);
    client.bindBackendSession(null); account.setAccountIdentity(null); account.releaseGuestWrites();
    expect(bookmarks.bookmarkStore.get().quran).toMatchObject([{ surah: 1, ayah: 1 }]);
  });
  it("preserves failed writes for explicit retry without rolling back to guest storage", async () => {
    await login(); fail = true; preferences.updatePreferences({ theme: "dark" });
    await eventually(() => expect(account.getAccountState().error).toBeTruthy());
    expect(account.getAccountState().pending).toBe(1); expect(preferences.preferencesStore.get().theme).toBe("dark");
    fail = false; await account.retryAccountSync(); await eventually(() => expect(account.getAccountState().pending).toBe(0));
    expect(profile.preferences.theme).toBe("dark"); expect(localStorage.getItem(preferences.preferencesStore.key)).toBeNull();
  });
  it("does not overwrite version conflicts until the user chooses retry or server data", async () => {
    await login(); conflict = true; preferences.updatePreferences({ language: "ur" });
    await eventually(() => expect(account.getAccountState().conflict).toBe(true));
    const count = calls.length; await new Promise(resolve => setTimeout(resolve, 250)); expect(calls).toHaveLength(count);
    conflict = false; await account.discardPendingChanges(); expect(preferences.preferencesStore.get().language).toBe("en");
    expect(account.getAccountState().pending).toBe(0);
  });
  it("requires consent for import and retains the original guest copy", async () => {
    bookmarks.toggleVerseBookmark(18, 10); const before = localStorage.getItem(bookmarks.bookmarkStore.key); await login();
    await expect(migration.importGuestWithConsent(false)).rejects.toThrow("Consent");
    expect(calls.some(c => c.path.includes("guest-import"))).toBe(false);
    await migration.importGuestWithConsent(true);
    expect(calls.find(c => c.path.includes("guest-import"))?.body).toMatchObject({ consent: true, bookmarks: [{ contentType: "quran", contentRef: "18:10" }] });
    expect(localStorage.getItem(bookmarks.bookmarkStore.key)).toBe(before);
  });
  it("aborts stale requests and cannot reveal another user’s response", async () => {
    await login(); let release: (value: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>(resolve => { release = resolve; }));
    const pending = client.backendRequest("/api/users/me"); const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve(); client.bindBackendSession("bob", async () => "controlled-bob-token"); account.setAccountIdentity("bob");
    release!(new Response(JSON.stringify({ data: profile }), { status: 200 })); await rejected;
    expect(account.getAccountProfile()).toBeNull();
  });
});
