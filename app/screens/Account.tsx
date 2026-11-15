"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { authError, useAuth } from "../context/AuthContext";
import { link, navigate, type Route } from "../lib/router";
import { backendRequest } from "../services/account/backendClient";
import { discardPendingChanges, getAccountState, getServerAccountState, retryAccountSync, subscribeAccount } from "../services/account/accountStore";
import { importGuestWithConsent } from "../services/account/guestImport";

export function AccountGate({ children }: { children: ReactNode }) {
  const auth = useAuth(), { t } = useTranslation();
  if (auth.loading) return <div className="app-screen" role="status">{t("Loading…")}</div>;
  if (!auth.user) return <div className="app-screen account-panel"><h1>{t("Sign in to your account")}</h1><a className="chip" href={link("/auth/login")}>{t("Sign in")}</a><a className="chip" href={link("/dashboard")}>{t("Continue as Guest")}</a></div>;
  return children;
}

export function SyncBanner() {
  const auth = useAuth(), { t } = useTranslation();
  const state = useSyncExternalStore(subscribeAccount, getAccountState, getServerAccountState);
  const [error, setError] = useState("");
  if (!auth.user || (!auth.syncing && !auth.error && !state.error && !state.pending)) return null;
  const run = (task: Promise<unknown>) => { setError(""); void task.catch(e => setError(authError(e))); };
  return <aside className="account-sync" aria-live="polite">
    <span>{t(state.conflict ? "Changes on another device need your choice." : state.error || auth.error || (auth.syncing ? "Loading account data…" : "Saving account changes…"))}</span>
    {(state.error || auth.error) && <button className="chip" onClick={() => run(state.hydrated ? retryAccountSync(state.conflict) : auth.refresh())}>{t(state.conflict ? "Save my pending changes" : "Retry sync")}</button>}
    {state.conflict && <button className="chip" onClick={() => run(discardPendingChanges())}>{t("Keep server data")}</button>}
    {state.error && <small>{t("Pending changes are held in this tab. Keep it open to retry before signing out.")}</small>}
    {error && <span role="alert">{t(error)}</span>}
  </aside>;
}

export function AuthScreen({ route }: { route: Route }) {
  const auth = useAuth(), { t } = useTranslation();
  const mode = route.segments[1] || "login";
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [name, setName] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const actionMode = route.query.get("mode") || "", code = route.query.get("oobCode") || "";
  async function run(task: () => Promise<unknown>, redirect = false) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); if (redirect) navigate("/account/dashboard"); }
    catch (e) { setError(authError(e)); } finally { setBusy(false); }
  }
  const title = mode === "signup" ? "Create an account" : mode === "reset" ? "Reset password" : mode === "action" ? "Complete email action" : "Sign in to your account";
  return <div className="app-screen account-panel"><h1>{t(title)}</h1>
    {!auth.configured && <p role="status">{t("Sign-in is unavailable. Continue as Guest.")}</p>}
    {auth.user && mode !== "action" ? <p><a href={link("/account")}>{t("Open Account")}</a></p> : <>
      <form className="account-form" onSubmit={e => { e.preventDefault(); void run(async () => {
        if (mode === "action") setNotice(await auth.action(actionMode, code, password));
        else if (mode === "reset") { await auth.resetEmail(email); setNotice("If an account exists, a password reset email has been sent."); }
        else if (mode === "signup") await auth.signup(name.trim(), email.trim(), password);
        else await auth.login(email.trim(), password);
      }, mode === "login" || mode === "signup"); }}>
        {mode === "signup" && <label>{t("Name")}<input required maxLength={60} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}
        {mode !== "action" && <label>{t("Email")}<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {(mode !== "reset" && (mode !== "action" || actionMode === "resetPassword")) && <label>{t("Password")}<input required type="password" minLength={mode === "signup" || mode === "action" ? 8 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <button className="chip selected" disabled={busy || auth.loading || !auth.configured}>{t(busy ? "Please wait…" : mode === "action" ? "Confirm" : mode === "reset" ? "Send reset email" : mode === "signup" ? "Create account" : "Sign in")}</button>
      </form>
      {(mode === "login" || mode === "signup") && <button className="chip" disabled={busy || auth.loading || !auth.configured} onClick={() => void run(auth.google, true)}>{t("Continue with Google")}</button>}
      <nav className="chip-row" aria-label={t("Account options")}><a href={link("/auth/login")}>{t("Sign in")}</a><a href={link("/auth/signup")}>{t("Create account")}</a><a href={link("/auth/reset")}>{t("Forgot password?")}</a></nav>
    </>}
    {(error || auth.error) && <p role="alert">{t(error || auth.error)}</p>}{(notice || auth.notice) && <p role="status">{t(notice || auth.notice)}</p>}
    <p><a href={link("/dashboard")}>{t("Continue as Guest")}</a></p>
  </div>;
}

type Attempt = { id: string; quizId: string; score: number; total: number; createdAt: string };
export default function Account() {
  const auth = useAuth(), { t } = useTranslation();
  const [name, setName] = useState(auth.profile?.name || auth.user?.displayName || "");
  const [consent, setConsent] = useState(false), [deleting, setDeleting] = useState(false), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]), [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => { setName(auth.profile?.name ?? auth.user?.displayName ?? ""); }, [auth.profile?.name, auth.user?.displayName]);
  async function run(task: () => Promise<unknown>, success = "Saved.") {
    setBusy(true); setError(""); setNotice("");
    try { await task(); setNotice(success); } catch (e) { setError(authError(e)); } finally { setBusy(false); }
  }
  async function loadAttempts(after?: string) {
    const result = await backendRequest<Attempt[]>("/api/quiz-attempts?limit=20" + (after ? "&cursor=" + after : ""));
    setAttempts(rows => after ? [...rows, ...result.data] : result.data); setCursor(result.meta?.nextCursor || null);
  }
  useEffect(() => { if (auth.user) void loadAttempts().catch(() => {}); }, [auth.user]);
  return <AccountGate><div className="app-screen account-panel"><h1>{t("Account")}</h1><p>{auth.user?.email}</p><a href={link("/account/dashboard")}>{t("Dashboard")}</a>
    <section className="widget"><h2>{t("Profile")}</h2><form className="account-form" onSubmit={e => { e.preventDefault(); void run(() => auth.saveName(name.trim())); }}><label>{t("Name")}<input maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label><button className="chip" disabled={busy || !auth.profile}>{t("Save profile")}</button></form>
      <p>{t(auth.user?.emailVerified ? "Email verified" : "Verify your email to use the AI assistant.")}</p>
      {!auth.user?.emailVerified && <div className="chip-row"><button className="chip" disabled={busy} onClick={() => void run(auth.verifyEmail, "Verification email sent.")}>{t("Send verification email")}</button><button className="chip" disabled={busy} onClick={() => void run(auth.refresh, "Account refreshed.")}>{t("I have verified my email")}</button></div>}
      {!auth.user?.providers.includes("google.com") && <button className="chip" disabled={busy} onClick={() => void run(auth.linkGoogle, "Google linked.")}>{t("Link Google account")}</button>}
      <p><a href={link("/preferences")}>{t("Preferences")}</a></p>
    </section>
    <section className="widget"><h2>{t("Import guest data")}</h2><p>{t("Import saved references, reading position, lessons and notes into this account. Existing account reading positions and notes take priority. Guest preferences stay on this device.")}</p><label className="account-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t("I consent to importing this browser’s guest data into this account.")} <strong>{auth.user?.email}</strong></label><button className="chip" disabled={busy || !consent || !auth.profile} onClick={() => void run(() => importGuestWithConsent(consent), "Guest data imported. The guest copy remains on this device.")}>{t("Import selected guest data")}</button></section>
    <section className="widget"><h2>{t("Quiz history")}</h2><button className="chip" disabled={busy} onClick={() => void run(() => loadAttempts(), "History refreshed.")}>{t("Refresh history")}</button>{attempts.map(a => <p key={a.id}>{a.quizId} · {a.score}/{a.total} · {new Date(a.createdAt).toLocaleDateString()}</p>)}{cursor && <button className="chip" onClick={() => void run(() => loadAttempts(cursor), "History loaded.")}>{t("Load more")}</button>}</section>
    {auth.profile?.role === "admin" && <AdminReview />}
    <section className="widget"><h2>{t("Session and data")}</h2><button className="chip" disabled={busy} onClick={() => void run(async () => { await auth.logout(); navigate("/dashboard"); }, "Signed out.")}>{t("Sign out")}</button><p>{t("Account changes waiting to sync are kept only in this tab. Signing out discards unsent changes.")}</p>
      <button className="chip" disabled={busy} onClick={() => setDeleting(!deleting)}>{t("Delete account")}</button>
      {deleting && <form className="account-form" onSubmit={e => { e.preventDefault(); void run(async () => { await auth.deleteAccount(password); navigate("/dashboard"); }, "Account deleted."); }}><p>{t("This permanently deletes your account and all its saved data. Confirm your identity to continue.")}</p>{auth.user?.providers.includes("password") && <label>{t("Current password")}<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}<button className="chip" disabled={busy}>{t("Confirm permanent deletion")}</button></form>}
    </section>{notice && <p role="status">{t(notice)}</p>}{error && <p role="alert">{t(error)}</p>}
  </div></AccountGate>;
}

type ReviewRow = { id: string; contentHash?: string; sourceId?: string; reference?: string; text?: string; edition?: string; collection?: string; language?: string; authenticity?: string; sourceURL?: string; reviewStatus?: string; reason?: string; targetType?: string; targetId?: string; status?: string };
function AdminReview() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReviewRow[]>([]), [kind, setKind] = useState("sources"), [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState("");
  const [note, setNote] = useState(""), [license, setLicense] = useState(""), [url, setURL] = useState(""), [attribution, setAttribution] = useState("");
  async function load(type: string, after?: string) { try { setError(""); const result = await backendRequest<ReviewRow[]>(`/api/admin/${type}?limit=20` + (after ? "&cursor=" + after : "")); setKind(type); setRows(old => after ? [...old, ...result.data] : result.data); setCursor(result.meta?.nextCursor || null); } catch (e) { setError(authError(e)); } }
  async function review(row: ReviewRow, status: string) {
    try { setError(""); await backendRequest(`/api/admin/${kind}/${row.id}` + (kind === "sources" ? "/review" : ""), { method: "PATCH", body: kind === "sources" ? { contentHash: row.contentHash, reviewStatus: status, note, ...(status === "approved" ? { licenseMetadata: { status: "approved", license, attribution, url } } : {}) } : { status, note } }); await load(kind); } catch (e) { setError(authError(e)); }
  }
  return <section className="widget account-form"><h2>{t("Content review")}</h2><div className="chip-row"><button className="chip" onClick={() => void load("sources")}>{t("Review sources")}</button><button className="chip" onClick={() => void load("reports")}>{t("Review reports")}</button></div>
    <label>{t("Review note")}<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
    {kind === "sources" && <><label>{t("License")}<input value={license} onChange={e => setLicense(e.target.value)} /></label><label>{t("License URL")}<input type="url" value={url} onChange={e => setURL(e.target.value)} /></label><label>{t("Attribution")}<input value={attribution} onChange={e => setAttribution(e.target.value)} /></label><p>{t("Approval confirms you reviewed this exact source text, its metadata and permission to use it. No source is approved automatically.")}</p></>}
    {rows.map(row => <article key={row.id}><h3>{row.reference || row.targetType}</h3><small>{row.sourceId || row.targetId} · {row.reviewStatus || row.status}</small><p>{row.collection} {row.language} {row.authenticity}</p><p>{row.text || row.reason}</p><p>{row.edition} {row.sourceURL && <a href={row.sourceURL} target="_blank" rel="noreferrer">{t("Read original source")}</a>}</p><div className="chip-row"><button className="chip" disabled={note.trim().length < 5 || (kind === "sources" && (!license || !attribution || !url))} onClick={() => void review(row, kind === "sources" ? "approved" : "resolved")}>{t(kind === "sources" ? "Approve reviewed source" : "Resolve report")}</button><button className="chip" disabled={note.trim().length < 5} onClick={() => void review(row, "rejected")}>{t("Reject")}</button></div></article>)}
    {cursor && <button className="chip" onClick={() => void load(kind, cursor)}>{t("Load more")}</button>}{error && <p role="alert">{t(error)}</p>}
  </section>;
}
