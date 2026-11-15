"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { firebaseConfigured } from "../lib/firebaseConfig";
import { API_BASE, backendRequest, bindBackendSession } from "../services/account/backendClient";
import { getAccountProfile, hydrateAccount, releaseGuestWrites, setAccountIdentity, subscribeAccount, type AccountProfile } from "../services/account/accountStore";
import type { AuthDriver, AuthIdentity } from "../services/account/authTypes";
type Context = {
  configured: boolean; loading: boolean; syncing: boolean; user: AuthIdentity | null; profile: AccountProfile | null; error: string; notice: string;
  login: (email: string, password: string) => Promise<void>; signup: (name: string, email: string, password: string) => Promise<void>; google: () => Promise<void>; logout: () => Promise<void>;
  refresh: () => Promise<void>; verifyEmail: () => Promise<void>; resetEmail: (email: string) => Promise<void>; linkGoogle: () => Promise<void>;
  saveName: (name: string) => Promise<void>; deleteAccount: (password?: string) => Promise<void>; action: (mode: string, code: string, password?: string) => Promise<string>;
};
const unavailable = async () => { throw new Error("Sign-in is unavailable. Continue as Guest."); };
const AuthContext = createContext<Context>({ configured: false, loading: false, syncing: false, user: null, profile: null, error: "", notice: "", login: unavailable, signup: unavailable, google: unavailable, logout: unavailable, refresh: unavailable, verifyEmail: unavailable, resetEmail: unavailable, linkGoogle: unavailable, saveName: unavailable, deleteAccount: unavailable, action: unavailable });
export const useAuth = () => useContext(AuthContext);
export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const known: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.", "auth/wrong-password": "Email or password is incorrect.", "auth/user-not-found": "Email or password is incorrect.",
    "auth/email-already-in-use": "This email already has an account. Try signing in.", "auth/weak-password": "Use a stronger password that meets the account policy.",
    "auth/account-exists-with-different-credential": "This email uses another sign-in method. Sign in with that method, then link Google from Account.",
    "auth/credential-already-in-use": "This Google account is already linked to another account.", "auth/provider-already-linked": "Google is already linked to this account.",
    "auth/popup-blocked": "Allow the sign-in popup and try again.", "auth/popup-closed-by-user": "The sign-in window was closed. Try again when ready.",
    "auth/too-many-requests": "Too many attempts. Please wait and retry.", "auth/network-request-failed": "The connection failed. Please retry.",
    "auth/unauthorized-domain": "Sign-in is unavailable on this domain. Continue as Guest.", "auth/operation-not-allowed": "This sign-in method is not enabled yet.",
    "auth/invalid-api-key": "Sign-in is unavailable. Continue as Guest.", "auth/invalid-action-code": "This action link is invalid or expired.", "auth/expired-action-code": "This action link is invalid or expired.",
    "auth/requires-recent-login": "Sign in again before this account change.", REAUTH_REQUIRED: "Sign in again before this account change.",
  };
  return known[code] || (code && code.startsWith("auth/") ? "Sign-in failed. Please retry." : error instanceof Error ? error.message : "The request failed. Please retry.");
}
export function AuthProvider({ children, driver: supplied }: { children: ReactNode; driver?: AuthDriver }) {
  const [driver, setDriver] = useState<AuthDriver | null>(supplied || null);
  const [user, setUser] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(Boolean(supplied || (firebaseConfigured && API_BASE)));
  const [syncing, setSyncing] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const turn = useRef(0);
  const profile = useSyncExternalStore(subscribeAccount, getAccountProfile, () => null);
  const configured = Boolean(supplied || (firebaseConfigured && API_BASE));
  useLayoutEffect(() => { if (!user) releaseGuestWrites(); }, [user]);
  const synchronize = useCallback(async (identity: AuthIdentity, epoch: number) => {
    setSyncing(true); setError("");
    try {
      await identity.getToken(true);
      await backendRequest<AccountProfile>("/api/auth/sync", { method: "POST", body: {} });
      await hydrateAccount();
    } catch (failure) { if (epoch === turn.current) setError(authError(failure)); }
    finally { if (epoch === turn.current) setSyncing(false); }
  }, []);
  useEffect(() => {
    if (!supplied && !configured) { setLoading(false); return; }
    let cancelled = false, unsubscribe = () => {};
    const start = async () => {
      try {
        const sdk = supplied || await import("../lib/firebaseClient").then(m => m.createFirebaseDriver());
        if (cancelled) return;
        setDriver(sdk);
        unsubscribe = sdk.subscribe(identity => {
          const epoch = ++turn.current;
          bindBackendSession(identity?.uid || null, identity?.getToken);
          setAccountIdentity(identity?.uid || null);
          setUser(identity); setLoading(false); setError("");
          if (identity) void synchronize(identity, epoch); else setSyncing(false);
        }, failure => { setError(authError(failure)); setLoading(false); });
      } catch (failure) { if (!cancelled) { setError(authError(failure)); setLoading(false); } }
    };
    void start();
    // This is a session generation counter; cleanup deliberately invalidates the latest turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { cancelled = true; turn.current++; unsubscribe(); bindBackendSession(null); setAccountIdentity(null); releaseGuestWrites(); };
  }, [supplied, configured, synchronize]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { void hydrateAccount().catch(() => {}); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [user]);
  const value = useMemo<Context>(() => {
    const sdk = () => { if (!driver) throw new Error("Sign-in is unavailable. Continue as Guest."); return driver; };
    const refresh = async () => {
      const identity = await sdk().refresh();
      if (identity) { setUser(identity); bindBackendSession(identity.uid, identity.getToken); await synchronize(identity, turn.current); }
    };
    const logout = async () => {
      turn.current++; bindBackendSession(null); setAccountIdentity(null); setUser(null); setError(""); setSyncing(false);
      await sdk().logout();
    };
    return { configured, loading, syncing, user, profile, error, notice,
      login: (email, password) => sdk().login(email, password), google: () => sdk().google(),
      signup: async (name, email, password) => { const warning = await sdk().signup(name, email, password); if (warning) setNotice(warning); await refresh(); },
      logout, refresh, verifyEmail: () => sdk().verifyEmail(), resetEmail: email => sdk().resetEmail(email), linkGoogle: async () => { await sdk().linkGoogle(); await refresh(); },
      saveName: async name => { await backendRequest("/api/users/me", { method: "PATCH", body: { name, preferences: { displayName: name.slice(0, 60) }, expectedVersion: profile?.version, mutationId: crypto.randomUUID() } }); await sdk().setName(name); await hydrateAccount(); await refresh(); },
      deleteAccount: async password => { await sdk().reauthenticate(password); await backendRequest("/api/users/me", { method: "DELETE", body: {} }); await logout(); },
      action: (mode, code, password) => sdk().action(mode, code, password),
    };
  }, [driver, configured, loading, syncing, user, profile, error, notice, synchronize]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
