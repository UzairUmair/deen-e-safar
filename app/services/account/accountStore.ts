// Identity-scoped, in-memory cloud adapter. Guest localStorage is never imported here.
import { backendRequest, BackendError } from "./backendClient";
import type { Preferences } from "../guest/preferencesStorage";
import type { ReadingProgress } from "../guest/readingProgressStorage";
type Profile = { id: string; name: string; email: string; photoURL: string; role: "user" | "admin"; preferences: Preferences; version: number };
type Bookmark = { id: string; contentType: "quran" | "dua" | "hadith"; contentRef: string; createdAt: string };
type Position = { surahNumber: number; ayahNumber: number; updatedAt: string; version: number };
type Lesson = { lessonId: string; note: string; status: string; version: number };
type Intent = { key: string; run: (override: boolean) => Promise<void> };
type SyncState = { uid: string | null; hydrated: boolean; pending: number; error: string; conflict: boolean };
const listeners = new Set<() => void>();
const values = new Map<string, unknown>();
const bookmarkIds = new Map<string, string>();
const positions = new Map<number, ReadingProgress>();
const versions = new Map<string, number>();
let state: SyncState = { uid: null, hydrated: false, pending: 0, error: "", conflict: false };
let generation = 0, queue: Intent[] = [], running = false, timer: ReturnType<typeof setTimeout>;
let guestBlocked = false;
let profile: Profile | null = null;
export const subscribeAccount = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getAccountState = () => state;
export const getAccountUid = () => state.uid;
const serverState: SyncState = { uid: null, hydrated: false, pending: 0, error: "", conflict: false };
export const getServerAccountState = () => serverState;
export const getAccountProfile = () => profile;
export const guestWritesBlocked = () => guestBlocked;
function emit(patch: Partial<SyncState> = {}) { state = { ...state, ...patch }; listeners.forEach(l => l()); }
export function setAccountIdentity(uid: string | null) {
  if (uid === state.uid) return;
  generation++; clearTimeout(timer); queue = []; running = false;
  values.clear(); positions.clear(); versions.clear(); bookmarkIds.clear(); profile = null;
  guestBlocked = uid === null;
  emit({ uid, hydrated: false, pending: 0, error: "", conflict: false });
}
export function releaseGuestWrites() { guestBlocked = false; }
export function readAccountValue<T>(name: string, fallback: T): T { return values.has(name) ? values.get(name) as T : fallback; }
export const readSurahPosition = (surah: number) => positions.get(surah) || null;
const refKey = (type: string, ref: string) => type + ":" + ref;
function applyBookmarks(rows: Bookmark[]) {
  bookmarkIds.clear(); rows.forEach(row => bookmarkIds.set(refKey(row.contentType, row.contentRef), row.id));
  values.set("bookmarks", {
    quran: rows.filter(b => b.contentType === "quran").map(b => { const [surah, ayah] = b.contentRef.split(":").map(Number); return { surah, ayah, addedAt: b.createdAt }; }),
    duas: rows.filter(b => b.contentType === "dua").map(b => ({ id: b.contentRef, addedAt: b.createdAt })),
  });
  values.set("legacy:deen-library-saved", rows.filter(b => b.contentType === "hadith").map(b => "hadith:" + b.contentRef));
}
async function allBookmarks() {
  const rows: Bookmark[] = []; let cursor: string | null = null;
  do { const result = await backendRequest<Bookmark[]>("/api/bookmarks?limit=50" + (cursor ? "&cursor=" + cursor : "")); rows.push(...result.data); cursor = result.meta?.nextCursor || null; } while (cursor && rows.length < 6500);
  return rows;
}
export async function hydrateAccount() {
  const epoch = generation;
  if (!state.uid) return;
  const [user, bookmarks, reading, learning] = await Promise.all([
    backendRequest<Profile>("/api/users/me"), allBookmarks(), backendRequest<Position[]>("/api/reading-progress"), backendRequest<Lesson[]>("/api/learning-progress"),
  ]);
  if (epoch !== generation || queue.length || running) return;
  profile = user.data; versions.set("preferences", user.data.version); values.set("preferences", user.data.preferences);
  applyBookmarks(bookmarks); positions.clear();
  for (const row of reading.data) { versions.set("reading:" + row.surahNumber, row.version); positions.set(row.surahNumber, { surah: row.surahNumber, ayah: row.ayahNumber, updatedAt: row.updatedAt }); }
  values.set("reading-progress", reading.data[0] ? positions.get(reading.data[0].surahNumber) : null);
  values.set("legacy:deen-lessons", learning.data.filter(l => l.status === "completed").map(l => l.lessonId));
  values.set("legacy:deen-notes", Object.fromEntries(learning.data.filter(l => l.note).map(l => [l.lessonId, l.note])));
  learning.data.forEach(l => versions.set("lesson:" + l.lessonId, l.version));
  emit({ hydrated: true, error: "", conflict: false, pending: 0 });
}
function enqueue(intent: Intent) {
  // Coalesce only unsent intents with the same key; never cancel an acknowledged write.
  const index = queue.findIndex((item, i) => item.key === intent.key && (!running || i > 0));
  if (index >= 0) queue[index] = intent; else queue.push(intent);
  emit({ pending: queue.length });
  clearTimeout(timer); timer = setTimeout(() => { if (!state.error) void flush(); }, 180);
}
async function flush(override = false) {
  if (running || !state.uid || !state.hydrated) return;
  running = true; const epoch = generation;
  try {
    while (queue.length && epoch === generation) {
      await queue[0].run(override);
      if (epoch !== generation) return;
      queue.shift(); emit({ pending: queue.length, error: "", conflict: false });
    }
  } catch (error) {
    if (epoch === generation) emit({ error: error instanceof Error ? error.message : "Account syncing failed.", conflict: error instanceof BackendError && error.status === 409 });
  } finally {
    if (epoch === generation) { running = false; if (!queue.length) void hydrateAccount().catch(error => { if (epoch === generation) emit({ error: error.message }); }); }
  }
}
export async function retryAccountSync(override = false) {
  emit({ error: "", conflict: false });
  if (!state.hydrated) return hydrateAccount();
  return flush(override);
}
export async function discardPendingChanges() { queue = []; emit({ pending: 0, error: "", conflict: false }); await hydrateAccount(); }
function difference(old: unknown, next: unknown): Record<string, unknown> {
  const patch = {};
  for (const [key, value] of Object.entries(next as object)) {
    const previous = (old as object)?.[key];
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    patch[key] = value && typeof value === "object" && !Array.isArray(value) && previous ? difference(previous, value) : value;
  }
  return patch;
}
function bookmarkDiff(old: { contentType: string; contentRef: string }[], next: { contentType: string; contentRef: string }[]) {
  const previous = new Set(old.map(b => refKey(b.contentType, b.contentRef))), current = new Set(next.map(b => refKey(b.contentType, b.contentRef)));
  const added = next.filter(b => !previous.has(refKey(b.contentType, b.contentRef))), removed = old.filter(b => !current.has(refKey(b.contentType, b.contentRef)));
  enqueue({ key: crypto.randomUUID(), run: async () => {
    for (const bookmark of added) { const { data } = await backendRequest<Bookmark>("/api/bookmarks", { method: "POST", body: bookmark }); bookmarkIds.set(refKey(bookmark.contentType, bookmark.contentRef), data.id); }
    for (const bookmark of removed) {
      const key = refKey(bookmark.contentType, bookmark.contentRef); let id = bookmarkIds.get(key);
      if (!id) { const rows = await allBookmarks(); id = rows.find(b => refKey(b.contentType, b.contentRef) === key)?.id; }
      if (id) try { await backendRequest("/api/bookmarks/" + id, { method: "DELETE" }); } catch (error) { if (!(error instanceof BackendError && error.status === 404)) throw error; }
      bookmarkIds.delete(key);
    }
  } });
}
type BookmarkState = { quran: { surah: number; ayah: number }[]; duas: { id: string }[] };
const flatten = (data: BookmarkState) => [...data.quran.map(b => ({ contentType: "quran", contentRef: `${b.surah}:${b.ayah}` })), ...data.duas.map(b => ({ contentType: "dua", contentRef: b.id }))];
export function writeAccountValue<T>(name: string, next: T, fallback: T): boolean {
  if (!state.uid || !state.hydrated) return false;
  const old = readAccountValue(name, fallback);
  if (name === "bookmarks") bookmarkDiff(flatten(old as BookmarkState), flatten(next as BookmarkState));
  else if (name === "preferences") {
    const patch = difference(old, next), mutationId = crypto.randomUUID();
    enqueue({ key: mutationId, run: async override => {
      if (override) versions.set("preferences", (await backendRequest<Profile>("/api/users/me")).data.version);
      const result = await backendRequest<Profile>("/api/users/me", { method: "PATCH", body: { preferences: patch, expectedVersion: versions.get("preferences") || 0, mutationId } });
      versions.set("preferences", result.data.version);
    } });
  } else if (name === "reading-progress" && next) {
    const reading = next as ReadingProgress, key = "reading:" + reading.surah, mutationId = crypto.randomUUID();
    positions.set(reading.surah, reading);
    enqueue({ key, run: async override => {
      if (override) versions.set(key, (await backendRequest<Position | null>(`/api/reading-progress/${reading.surah}`)).data?.version || 0);
      const result = await backendRequest<Position>(`/api/reading-progress/${reading.surah}`, { method: "PUT", body: { ayahNumber: reading.ayah, expectedVersion: versions.get(key) || 0, mutationId } });
      versions.set(key, result.data.version);
    } });
  }
  values.set(name, next); emit(); return true;
}
export function writeLegacyValue<T>(key: string, next: T, fallback: T): boolean {
  if (!state.uid || !state.hydrated) return false;
  const name = "legacy:" + key, old = readAccountValue<T>(name, fallback);
  if (key === "deen-library-saved") {
    const rows = value => (value as string[]).filter(id => id.startsWith("hadith:")).map(id => ({ contentType: "hadith", contentRef: id.slice(7) }));
    bookmarkDiff(rows(old), rows(next));
  } else if (key === "deen-lessons" || key === "deen-notes") {
    const changes: Record<string, { status?: string; note?: string }> = {};
    if (key === "deen-lessons") {
      for (const id of next as string[]) if (!(old as string[]).includes(id)) changes[id] = { status: "completed" };
      for (const id of old as string[]) if (!(next as string[]).includes(id)) changes[id] = { status: "in_progress" };
    } else for (const [id, note] of Object.entries(next as Record<string, string>)) if ((old as Record<string, string>)[id] !== note) changes[id] = { note };
    for (const [id, patch] of Object.entries(changes)) {
      const mutationId = crypto.randomUUID();
      enqueue({ key: "lesson:" + id + ":" + key, run: async override => {
        if (override) { const rows = await backendRequest<Lesson[]>("/api/learning-progress"); versions.set("lesson:" + id, rows.data.find(l => l.lessonId === id)?.version || 0); }
        const row = await backendRequest<Lesson>("/api/learning-progress/" + id, { method: "PUT", body: { ...patch, expectedVersion: versions.get("lesson:" + id) || 0, mutationId } });
        versions.set("lesson:" + id, row.data.version);
      } });
    }
  }
  values.set(name, next); emit(); return true;
}
export function submitAccountQuiz(quizId: string, answers: number[]) {
  if (!state.uid || !state.hydrated) return;
  const submissionId = crypto.randomUUID();
  enqueue({ key: submissionId, run: async () => { await backendRequest("/api/quiz-attempts", { method: "POST", body: { quizId, answers, submissionId } }); } });
}
export type { Profile as AccountProfile };
