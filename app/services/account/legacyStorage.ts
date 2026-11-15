import { getAccountUid, guestWritesBlocked, readAccountValue, subscribeAccount, writeLegacyValue } from "./accountStore";
const remoteKeys = new Set(["deen-lessons", "deen-notes", "deen-library-saved"]);
type LegacyStore<T> = { get: () => T; server: () => T; subscribe: (listener: () => void) => () => void; set: (next: T | ((value: T) => T), owner: string | null) => void };
const stores = new Map<string, LegacyStore<unknown>>();
export function legacyStore<T>(key: string, fallback: T): LegacyStore<T> {
  if (stores.has(key)) return stores.get(key) as LegacyStore<T>;
  let cachedKey: string | undefined, cached: T;
  const listeners = new Set<() => void>();
  const storageKey = () => getAccountUid() ? `deen-account:${encodeURIComponent(getAccountUid()!)}:${key}` : key;
  const invalidate = () => { cachedKey = undefined; listeners.forEach(l => l()); };
  subscribeAccount(invalidate);
  let listening = false;
  const store: LegacyStore<T> = {
    get() {
      if (getAccountUid() && remoteKeys.has(key)) return readAccountValue("legacy:" + key, fallback);
      const name = storageKey();
      if (cachedKey !== name) {
        cached = fallback;
        try { const raw = window.localStorage.getItem(name); if (raw !== null) cached = JSON.parse(raw); } catch { /* Defaults remain usable without storage. */ }
        cachedKey = name;
      }
      return cached;
    },
    server: () => fallback,
    subscribe(listener) {
      listeners.add(listener);
      if (!listening && typeof window !== "undefined") {
        listening = true;
        window.addEventListener("storage", event => { if (!event.key || event.key === storageKey()) invalidate(); });
        window.addEventListener("deen-data", invalidate);
      }
      return () => listeners.delete(listener);
    },
    set(next, owner) {
      if (getAccountUid() !== owner || guestWritesBlocked()) return;
      const value = typeof next === "function" ? (next as (value: T) => T)(store.get()) : next;
      if (owner && remoteKeys.has(key)) { writeLegacyValue(key, value, fallback); return; }
      try {
        window.localStorage.setItem(storageKey(), JSON.stringify(value));
        cachedKey = undefined;
        window.dispatchEvent(new CustomEvent("deen-data"));
      } catch { /* The calling feature can still continue without persistence. */ }
    },
  };
  stores.set(key, store as LegacyStore<unknown>);
  return store;
}
