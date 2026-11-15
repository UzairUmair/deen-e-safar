// Hash-based routing. Application routes look like paths (#/quran/2?ayah=5); a few older
// screens still use their original form (#course?path=seerah) and old links are redirected.
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

const scrollPositions = new Map<string, number>();
let entry = "";
let pendingScroll: number | undefined;
let lastScroll = 0;
const newEntry = () => `deen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const savedPosition = (id: string): number | undefined => {
  try {
    const value = sessionStorage.getItem(`deen-scroll:${id}`);
    const number = value === null ? NaN : Number(value);
    return Number.isFinite(number) && number >= 0 ? number : undefined;
  } catch { return undefined; }
};

/** Restore history entries after the destination layout exists, including lazy home scenes. */
export function useRouteScroll(screenKey: string) {
  const bootstrap = useRef<{ key: string; top?: number } | null>(null);
  useLayoutEffect(() => {
    bootstrap.current ??= { key: screenKey, top: savedPosition(history.state?.deenEntry) };
    const saved = bootstrap.current.key === screenKey ? bootstrap.current.top : undefined;
    if (pendingScroll === undefined && saved === undefined) return;
    const top: number = pendingScroll ?? saved;
    pendingScroll = undefined;
    const restore = () => window.scrollTo({ top, behavior: "instant" });
    restore();
    if (top === 0) return;
    const observer = new ResizeObserver(() => {
      restore();
      if (document.documentElement.scrollHeight - innerHeight >= top) observer.disconnect();
    });
    observer.observe(document.getElementById("main") || document.body);
    const timeout = window.setTimeout(() => observer.disconnect(), 2000);
    return () => { observer.disconnect(); clearTimeout(timeout); };
  }, [screenKey]);
}

export type Route = { name: string; segments: string[]; query: URLSearchParams; hash: string };

const PATH_ROUTES = new Set(["quran", "prayer", "duas", "dashboard", "ai", "bookmarks", "preferences", "hadith"]);

/** Accepts a path ("/quran/2") or a pre-v2 name ("reader?surah=2&ayah=5") and returns the current form, without "#". */
export function normalizeTarget(target: string) {
  const value = target.replace(/^#/, "");
  if (value.startsWith("/")) return value;
  const [name, query = ""] = value.split("?");
  if (!name || name === "home") return "/";
  if (name === "reader") {
    const params = new URLSearchParams(query);
    const ayah = params.get("ayah");
    return `/quran/${params.get("surah") || "1"}${ayah && ayah !== "1" ? `?ayah=${ayah}` : ""}`;
  }
  if (name === "auth") return "/auth/login";
  if (PATH_ROUTES.has(name)) return `/${name}${query ? `?${query}` : ""}`;
  return value;
}

export function parseHash(hash: string): Route {
  const value = hash.replace(/^#/, "");
  const [path, query = ""] = value.split("?");
  const segments = path.split("/").filter(Boolean);
  return { name: segments[0] || "home", segments, query: new URLSearchParams(query), hash: value };
}

/** href for an <a>. */
export const link = (target: string) => "#" + normalizeTarget(target);

export function navigate(target: string) {
  window.location.hash = normalizeTarget(target);
}

function subscribe(listener: () => void) {
  const before = history.scrollRestoration;
  history.scrollRestoration = "manual";
  if (!entry) {
    entry = history.state?.deenEntry || newEntry();
    history.replaceState({ ...history.state, deenEntry: entry }, "");
    lastScroll = window.scrollY;
  }
  let timer = 0;
  const persist = () => {
    clearTimeout(timer);
    lastScroll = window.scrollY;
    try { sessionStorage.setItem(`deen-scroll:${entry}`, String(lastScroll)); } catch { /* Scroll remains usable without storage. */ }
  };
  const save = () => {
    lastScroll = window.scrollY;
    clearTimeout(timer);
    timer = window.setTimeout(persist, 120);
  };
  const onChange = () => {
    const current = window.location.hash.replace(/^#/, "");
    const normalized = normalizeTarget(current);
    // Old bookmarks and links keep working: rewrite them in place, without a history entry.
    if (current && normalized !== current) window.location.replace("#" + normalized);
    else {
      persist();
      scrollPositions.set(entry, lastScroll);
      const destination = history.state?.deenEntry;
      const destinationScroll = scrollPositions.get(destination) ?? savedPosition(destination);
      const returning = destination && destination !== entry && destinationScroll !== undefined;
      entry = returning ? destination : newEntry();
      pendingScroll = returning ? destinationScroll : 0;
      lastScroll = pendingScroll || 0;
      history.replaceState({ ...history.state, deenEntry: entry }, "");
      listener();
    }
  };
  window.addEventListener("scroll", save, { passive: true });
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("scroll", save);
    window.removeEventListener("pagehide", persist);
    window.removeEventListener("beforeunload", persist);
    persist();
    history.scrollRestoration = before;
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return parseHash(normalizeTarget(hash));
}
