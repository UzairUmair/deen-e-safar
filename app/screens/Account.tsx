"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { authError, useAuth } from "../context/AuthContext";
import { link, navigate } from "../lib/router";
import { backendRequest } from "../services/account/backendClient";
import { discardPendingChanges, getAccountState, getServerAccountState, retryAccountSync, subscribeAccount } from "../services/account/accountStore";
import { importGuestWithConsent } from "../services/account/guestImport";

import AccountLearning from "./AccountLearning";
import Preferences from "./Preferences";

export function AccountGate({ children }: { children: ReactNode }) {
  const auth = useAuth(), { t } = useTranslation();
  if (auth.loading) return <div className="app-screen" role="status">{t("Loading…")}</div>;
  if (!auth.user) {
    const destination = typeof window === "undefined" ? "/account/dashboard" : window.location.hash.slice(1) || "/account/dashboard";
    return <div className="app-screen account-panel"><h1>{t("Sign in to your account")}</h1><a className="chip" href={link("/auth/login?next=" + encodeURIComponent(destination))}>{t("Sign in")}</a><a className="chip" href={link("/dashboard")}>{t("Continue as Guest")}</a></div>;
  }
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

export { AuthScreen } from "./AuthScreen";

type Attempt = { id: string; quizId: string; score: number; total: number; createdAt: string };
export default function Account() {
  const auth = useAuth(), { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(auth.profile?.name || auth.user?.displayName || "");
  const [consent, setConsent] = useState(false), [deleting, setDeleting] = useState(false), [password, setPassword] = useState("");
  useEffect(() => { if (deleting) dialog.current?.showModal(); else if(dialog.current?.open) dialog.current.close(); }, [deleting]);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [attemptsLoaded,setAttemptsLoaded]=useState(false),[attemptsError,setAttemptsError]=useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]), [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => { setName(auth.profile?.name ?? auth.user?.displayName ?? ""); }, [auth.profile?.name, auth.user?.displayName]);
  async function run(task: () => Promise<unknown>, success = "Saved.") {
    setBusy(true); setError(""); setNotice("");
    try { await task(); setNotice(success); } catch (e) { setError(authError(e)); } finally { setBusy(false); }
  }
  async function loadAttempts(after?: string) {
    const result = await backendRequest<Attempt[]>("/api/quiz-attempts?limit=20" + (after ? "&cursor=" + after : ""));
    setAttemptsLoaded(true);setAttemptsError("");setAttempts(rows => after ? [...rows, ...result.data] : result.data); setCursor(result.meta?.nextCursor || null);
  }
  useEffect(() => { let live=true;setAttempts([]);setAttemptsLoaded(false);setAttemptsError("");if(auth.user&&!auth.syncing)void backendRequest<Attempt[]>("/api/quiz-attempts?limit=20").then(result=>{if(live){setAttempts(result.data);setCursor(result.meta?.nextCursor||null);setAttemptsLoaded(true);}}).catch(e=>{if(live)setAttemptsError(authError(e));});return()=>{live=false;}; }, [auth.user,auth.syncing]);
  return <AccountGate><div className="app-screen account-center"><header className="account-identity"><div className="account-avatar" aria-hidden="true">{(auth.profile?.name || auth.user?.displayName || auth.user?.email || 'D').split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><div><span className="account-eyebrow">{t("YOUR PERSONAL LEARNING SPACE")}</span><h1>{auth.profile?.name || auth.user?.displayName || t("My account")}</h1><p>{auth.user?.email}</p><span className="account-badge">{t(auth.user?.emailVerified ? "Email verified" : "Email not verified")}</span>{auth.profile?.createdAt && <small> · {t("Member since")} {new Date(auth.profile.createdAt).toLocaleDateString()}</small>}</div><button className="chip" onClick={()=>document.getElementById('account-profile-name')?.focus()}>{t("Edit profile")}</button></header><div className="account-layout"><nav className="account-nav" aria-label={t("Account sections")}>{[['account-profile','Profile'],['account-learning','My learning'],['account-saved','Saved content'],['account-preferences','Preferences'],['account-security','Security']].map(([id,label])=><button className="chip" key={id} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'})}>{t(label)}</button>)}<a href={link('learn')}>{t("Return to the academy")} ↗</a></nav><div className="account-main"><AccountLearning/>
    <section id="account-profile" className="widget account-card"><h2>{t("Profile")}</h2><form className="account-form" onSubmit={e => { e.preventDefault(); void run(() => auth.saveName(name.trim())); }}><label>{t("Name")}<input id="account-profile-name" required minLength={1} maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label><button className="chip" disabled={busy || !auth.profile || !name.trim()}>{t(busy ? "Saving…" : "Save profile")}</button></form>
      <p>{t(auth.user?.emailVerified ? "Email verified" : "Verify your email to use the AI assistant.")}</p>
      {!auth.user?.emailVerified && <div className="chip-row"><button className="chip" disabled={busy} onClick={() => void run(auth.verifyEmail, "Verification email sent.")}>{t("Send verification email")}</button><button className="chip" disabled={busy} onClick={() => void run(auth.refresh, "Account refreshed.")}>{t("I have verified my email")}</button></div>}
      {!auth.user?.providers.includes("google.com") && <button className="chip" disabled={busy} onClick={() => void run(auth.linkGoogle, "Google linked.")}>{t("Link Google account")}</button>}
      <p><a href={link("/preferences")}>{t("Preferences")}</a></p>
    </section>
    <section className="widget"><h2>{t("Import guest data")}</h2><p>{t("Import saved references, reading position, lessons and notes into this account. Existing account reading positions and notes take priority. Guest preferences stay on this device.")}</p><label className="account-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t("I consent to importing this browser’s guest data into this account.")} <strong>{auth.user?.email}</strong></label><button className="chip" disabled={busy || !consent || !auth.profile} onClick={() => void run(() => importGuestWithConsent(consent), "Guest data imported. The guest copy remains on this device.")}>{t("Import selected guest data")}</button></section>
    <section className="widget"><h2>{t("Quiz history")}</h2><button className="chip" disabled={busy} onClick={() => void run(() => loadAttempts(), "History refreshed.")}>{t("Refresh history")}</button>{attemptsError&&<p role="alert">{t(attemptsError)}</p>}{attemptsLoaded&&!attempts.length&&<p className="account-empty">{t("Your completed quizzes will appear here.")}</p>}{attempts.map(a => <p key={a.id}>{a.quizId} · {a.score}/{a.total} · {new Date(a.createdAt).toLocaleDateString()}</p>)}{cursor && <button className="chip" onClick={() => void run(() => loadAttempts(cursor), "History loaded.")}>{t("Load more")}</button>}</section>
    {auth.profile?.role === "admin" && <AdminReview />}
    <section id="account-preferences" className="account-card account-preferences"><Preferences /></section><section id="account-security" className="widget account-card"><h2>{t("Security and account controls")}</h2><p>{t("Sign-in methods")}: {auth.user?.providers.map(p=>p=== "google.com" ? "Google" : t("Email and password")).join(" · ")}</p>{auth.user?.providers.includes("password") && auth.user.email && <button className="chip" disabled={busy} onClick={()=>void run(()=>auth.resetEmail(auth.user!.email!), "Password reset email sent.")}>{t("Reset password")}</button>}<h3>{t("Session and data")}</h3><button className="chip" disabled={busy} onClick={() => void run(async () => { await auth.logout(); navigate("/dashboard"); }, "Signed out.")}>{t("Sign out")}</button><p>{t("Account changes waiting to sync are kept only in this tab. Signing out discards unsent changes.")}</p>
      <button className="chip" disabled={busy} onClick={() => setDeleting(!deleting)}>{t("Delete account")}</button>
      <dialog ref={dialog} className="account-delete-dialog" aria-labelledby="account-delete-title" onCancel={()=>setDeleting(false)} onClose={()=>setDeleting(false)}><h2 id="account-delete-title">{t("Delete account")}</h2><form className="account-form" onSubmit={e => { e.preventDefault(); void run(async () => { await auth.deleteAccount(password); navigate("/dashboard"); }, "Account deleted."); }}><p>{t("This permanently deletes your account and all its saved data. Confirm your identity to continue.")}</p>{auth.user?.providers.includes("password") && <label>{t("Current password")}<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}<div className="chip-row"><button className="chip" type="button" disabled={busy} onClick={()=>setDeleting(false)}>{t("Cancel")}</button><button className="chip" disabled={busy}>{t("Confirm permanent deletion")}</button></div>{error && <p role="alert">{t(error)}</p>}</form></dialog>
    </section>{notice && <p role="status">{t(notice)}</p>}{error && <p role="alert">{t(error)}</p>}
  </div></div></div></AccountGate>;
}

type ReviewRow = { academyScopes?:{lessonId:string;stepId:string}[]; title?:string;author?:string;id: string; contentHash?: string; sourceId?: string; reference?: string; text?: string; edition?: string; collection?: string; language?: string; authenticity?: string; sourceURL?: string; reviewStatus?: string; reason?: string; targetType?: string; targetId?: string; status?: string };
function AdminReview() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReviewRow[]>([]), [kind, setKind] = useState("sources"), [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState("");
  const [note, setNote] = useState(""), [license, setLicense] = useState(""), [url, setURL] = useState(""), [attribution, setAttribution] = useState("");
  const [proposal,setProposal]=useState(""),[proposing,setProposing]=useState(false),[proposalNotice,setProposalNotice]=useState("");
  async function propose(){if(proposing)return;setProposing(true);setError("");setProposalNotice("");try{const body=JSON.parse(proposal);await backendRequest("/api/admin/sources",{method:"POST",body});setProposalNotice(t("Source proposal saved. New or changed content requires review before teaching."));setProposal("");await load("sources");}catch(e){setError(e instanceof SyntaxError?t("Enter a valid source JSON object."):authError(e));}finally{setProposing(false);}}
  async function load(type: string, after?: string) { try { setError(""); const result = await backendRequest<ReviewRow[]>(`/api/admin/${type}?limit=20` + (after ? "&cursor=" + after : "")); setKind(type); setRows(old => after ? [...old, ...result.data] : result.data); setCursor(result.meta?.nextCursor || null); } catch (e) { setError(authError(e)); } }
  async function review(row: ReviewRow, status: string) {
    try { setError(""); await backendRequest(`/api/admin/${kind}/${row.id}` + (kind === "sources" ? "/review" : ""), { method: "PATCH", body: kind === "sources" ? { contentHash: row.contentHash, reviewStatus: status, note, ...(status === "approved" ? { licenseMetadata: { status: "approved", license, attribution, url } } : {}) } : { status, note } }); await load(kind); } catch (e) { setError(authError(e)); }
  }
  return <section className="widget account-form"><h2>{t("Content review")}</h2><div className="chip-row"><button className="chip" onClick={() => void load("sources")}>{t("Review sources")}</button><button className="chip" onClick={() => void load("reports")}>{t("Review reports")}</button></div>
    <details><summary>{t("Propose or update a source passage")}</summary><p>{t("Paste source metadata and exact permitted text. Include academyScopes with lessonId and stepId to assign a lesson. New content and changed mappings require fresh content and licensing review.")}</p><form onSubmit={e=>{e.preventDefault();void propose();}}><label>{t("Source proposal JSON")}<textarea required maxLength={50000} value={proposal} onChange={e=>setProposal(e.target.value)} placeholder={'{"sourceId":"history:edition:passage:en","sourceType":"history","academyScopes":[{"lessonId":"academy:abu-bakr","stepId":"0"}]}'} /></label><button className="chip" disabled={proposing||!proposal.trim()}>{t(proposing?"Please wait…":"Save source for review")}</button></form>{proposalNotice&&<p role="status">{proposalNotice}</p>}</details>
    <label>{t("Review note")}<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
    {kind === "sources" && <><label>{t("License")}<input value={license} onChange={e => setLicense(e.target.value)} /></label><label>{t("License URL")}<input type="url" value={url} onChange={e => setURL(e.target.value)} /></label><label>{t("Attribution")}<input value={attribution} onChange={e => setAttribution(e.target.value)} /></label><p>{t("Approval confirms you reviewed this exact source text, its metadata and permission to use it. No source is approved automatically.")}</p></>}
    {rows.map(row => <article key={row.id}><h3>{row.reference || row.targetType}</h3><small>{row.sourceId || row.targetId} · {row.reviewStatus || row.status}</small><p>{row.title} · {row.author} · {row.collection} · {row.language} · {row.authenticity}</p>{row.academyScopes?.map(scope=><small key={scope.lessonId+scope.stepId}>{scope.lessonId} / {scope.stepId} </small>)}<p>{row.text || row.reason}</p><p>{row.edition} {row.sourceURL && <a href={row.sourceURL} target="_blank" rel="noreferrer">{t("Read original source")}</a>}</p><div className="chip-row"><button className="chip" disabled={note.trim().length < 5 || (kind === "sources" && (!license || !attribution || !url))} onClick={() => void review(row, kind === "sources" ? "approved" : "resolved")}>{t(kind === "sources" ? "Approve reviewed source" : "Resolve report")}</button><button className="chip" disabled={note.trim().length < 5} onClick={() => void review(row, "rejected")}>{t("Reject")}</button></div></article>)}
    {cursor && <button className="chip" onClick={() => void load(kind, cursor)}>{t("Load more")}</button>}{error && <p role="alert">{t(error)}</p>}
  </section>;
}
