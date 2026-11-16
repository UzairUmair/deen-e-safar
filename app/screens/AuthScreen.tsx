"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedButton } from "../components/motion/AnimatedButton";
import { authError, useAuth } from "../context/AuthContext";
import { authDestination, consumeGoogleReturn, normalizedEmail, rememberGoogleReturn, validateAuth, type AuthFieldErrors, type AuthFields } from "../lib/authValidation";
import { link, navigate, type Route } from "../lib/router";

function GoogleMark() {
  return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2.1 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"/></svg>;
}

/** Static vector architecture: no canvas, network asset or animation loop. */
function JourneyIllustration() {
  const { t } = useTranslation();
  return <aside className="auth-art" aria-label={t("A space for reflection")}>
    <div className="auth-art-caption"><span className="auth-eyebrow">{t("FAITH. KNOWLEDGE. JOURNEY.")}</span><h2>{t("Every journey begins with a step.")}</h2><p>{t("A little knowledge. A moment of reflection. A little closer, every day.")}</p></div>
    <svg className="auth-architecture" viewBox="0 0 440 440" fill="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="auth-wall" x1="70" y1="80" x2="350" y2="420" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFDF8"/><stop offset="1" stopColor="#DFD2B8"/></linearGradient><linearGradient id="auth-alcove" x1="120" y1="160" x2="310" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#D9C9AA"/><stop offset="1" stopColor="#F8F0E2"/></linearGradient><linearGradient id="auth-light" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFDF8" stopOpacity=".9"/><stop offset="1" stopColor="#FFFDF8" stopOpacity="0"/></linearGradient></defs>
      <circle cx="329" cy="112" r="53" fill="#E5D9EC" opacity=".6"/>
      <path d="m60 71 15 15-15 15-15-15 15-15Zm306 144 9 9-9 9-9-9 9-9Z" stroke="#B69A65" opacity=".55"/>
      <ellipse cx="232" cy="394" rx="164" ry="23" fill="#B59B71" opacity=".12"/>
      <path d="M85 371V212c0-79 58-121 135-153 77 32 135 74 135 153v159H85Z" fill="url(#auth-wall)" stroke="#D5C5A9"/>
      <path d="M113 371V215c0-60 43-100 107-128 64 28 107 68 107 128v156H113Z" fill="url(#auth-alcove)" stroke="#C6AE85"/>
      <path d="M125 371V216c0-52 37-88 95-115 58 27 95 63 95 115v155" stroke="#FFFBF1" strokeWidth="3"/>
      <path d="m135 167 163 205h-81L129 217Z" fill="url(#auth-light)"/>
      <path d="M100 370h240v15H100z" fill="#D5C1A0"/><path d="M89 385h262v9H89z" fill="#E5D8C0"/>
      <path d="M139 288h164v9H139zM139 349h164v9H139zM151 297v52m140-52v52" stroke="#B59B71" strokeWidth="4"/>
      <g stroke="#9B8053" strokeWidth=".8"><path d="M158 217h24v69h-24z" fill="#6E8F87"/><path d="M184 230h17v56h-17z" fill="#C9A978"/><path d="m211 225 22-6 17 64-22 6-17-64Z" fill="#847E99"/><path d="M252 236h27v50h-27z" fill="#D4AC96"/><path d="M164 223v55m26-40v41m69-35v35" stroke="#EADCC0"/><path d="M175 320h70v12h-70z" fill="#D4AC96"/><path d="M165 333h86v15h-86z" fill="#78968B"/></g>
      <path d="M274 348v-34c-17-10-20-21-15-32 15 5 19 16 15 32 8-21 20-27 31-23-1 15-12 23-31 23" stroke="#788E78" strokeWidth="3"/>
      <path d="M263 332h25l-4 17h-17l-4-17Z" fill="#C3A47F"/>
      <path d="M78 183h-8m4-4v8m268-130h-12m6-6v12" stroke="#B69A65" strokeLinecap="round"/>
    </svg>
    <div className="auth-art-footer"><span aria-hidden="true">✦</span><span>{t("A space for curious hearts.")}</span><span aria-hidden="true">✦</span></div>
  </aside>;
}

export function AuthScreen({ route }: { route: Route }) {
  const auth = useAuth(), { t } = useTranslation();
  const mode = ["signup", "reset", "action"].includes(route.segments[1]) ? route.segments[1] : "login";
  const signup = mode === "signup", reset = mode === "reset", action = mode === "action";
  const actionMode = route.query.get("mode") || "", code = route.query.get("oobCode") || "";
  const destination = authDestination(route.query.get("next"));
  const [fields, setFields] = useState<AuthFields>({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [busy, setBusy] = useState<"email" | "google" | "google-redirect" | null>(null), [error, setError] = useState("");
  const [popupFallback, setPopupFallback] = useState(false);
  const [notice, setNotice] = useState(""), [complete, setComplete] = useState(false);
  const [visible, setVisible] = useState(false), [confirmVisible, setConfirmVisible] = useState(false);
  const lock = useRef(false), errorRef = useRef<HTMLParagraphElement>(null);
  const unavailable = auth.loading || !auth.configured;
  useEffect(() => {
    if (!auth.user || !auth.redirected) return;
    const target = consumeGoogleReturn();
    if (target) navigate(target);
  }, [auth.user, auth.redirected]);
  const heading = signup ? "Begin Your Journey" : reset ? "Find Your Way Back" : action ? "Complete email action" : "Welcome Back";
  const subtitle = signup ? "Create your account and start exploring Deen e Safar." : reset ? "A fresh start is only an email away." : action ? "Complete this step to continue your journey." : "Continue your journey of faith and knowledge.";
  const authHref = (nextMode: string) => link(`/auth/${nextMode}${destination === "/account/dashboard" ? "" : `?next=${encodeURIComponent(destination)}`}`);
  const update = (field: keyof AuthFields, value: string) => {
    setFields(before => ({ ...before, [field]: value }));
    setErrors(before => ({ ...before, [field]: undefined }));
    setError("");
  };
  const blur = (field: keyof AuthFields) => setErrors(before => ({ ...before, [field]: validateAuth(mode, fields, actionMode)[field] }));
  async function run(kind: "email" | "google" | "google-redirect") {
    if (lock.current || unavailable) return;
    if (kind === "email") {
      const invalid = validateAuth(mode, fields, actionMode);
      setErrors(invalid);
      const first = Object.keys(invalid)[0];
      if (first) { document.getElementById(`auth-${first}`)?.focus(); return; }
    }
    lock.current = true; setBusy(kind); setError(""); setNotice(""); setPopupFallback(false);
    try {
      if (kind !== "email") {
        const redirect = kind === "google-redirect" || window.matchMedia("(pointer: coarse)").matches;
        if (redirect) rememberGoogleReturn(destination);
        await auth.google(redirect ? "redirect" : "popup");
        if (!redirect) navigate(destination);
      }
      else if (action) { setNotice(await auth.action(actionMode, code, fields.password)); setComplete(true); }
      else if (reset) { await auth.resetEmail(normalizedEmail(fields.email)); setComplete(true); }
      else if (signup) { await auth.signup(fields.name.trim(), normalizedEmail(fields.email), fields.password); setComplete(true); }
      else { await auth.login(normalizedEmail(fields.email), fields.password); navigate(destination); }
      // Passwords are no longer needed after successful submission.
      setFields(before => ({ ...before, password: "", confirm: "" }));
    } catch (failure) {
      setError(authError(failure));
      setPopupFallback(["auth/popup-blocked", "auth/popup-closed-by-user"].includes((failure as { code?: string })?.code || ""));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { lock.current = false; setBusy(null); }
  }
  const fieldProps = (field: keyof AuthFields) => ({ id: `auth-${field}`, name: field, value: fields[field], onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(field, event.target.value), onBlur: () => blur(field), "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `auth-${field}-error` : field === "password" && signup ? "auth-password-help" : undefined, disabled: Boolean(busy) });
  const fieldError = (field: keyof AuthFields) => errors[field] ? <small className="auth-field-error" id={`auth-${field}-error`}>{t(errors[field]!)}</small> : null;
  const alreadySignedIn = auth.user && !action && !busy && !complete;
  return <section className="auth-page" aria-labelledby="auth-heading">
    <div className="auth-card">
      <div className="auth-form-side">
        <a className="auth-brand" href={link("/")} aria-label={t("Deen e Safar home")}><span className="auth-brand-symbol"><BookOpen size={23} strokeWidth={1.4} aria-hidden="true"/></span><span>{t("Deen e Safar")}<small>{t("A BEAUTIFUL JOURNEY")}</small></span></a>
        <div className="auth-form-content">
          <p className="auth-eyebrow">{t(reset || action ? "A LITTLE CLOSER, EVERY DAY" : signup ? "YOUR NEXT CHAPTER" : "YOUR JOURNEY CONTINUES")}</p>
          <h1 id="auth-heading">{t(heading)}</h1><p className="auth-subtitle">{t(subtitle)}</p>
          {!auth.configured && <p className="auth-feedback" role="status">{t("Sign-in is unavailable. Continue as Guest.")}</p>}
          {auth.loading && <p className="auth-feedback" role="status"><Loader2 className="spin" size={16} aria-hidden="true"/>{t("Restoring your session…")}</p>}
          {complete ? <div className="auth-success" role="status">
            <span className="auth-success-icon"><CheckCircle2 size={27} aria-hidden="true"/></span>
            <h2>{t(reset ? "Check your inbox" : signup ? "Your journey starts here" : "All set")}</h2>
            <p>{t(reset ? "If an account exists, a password reset email has been sent." : signup ? "Your account has been created. Check your inbox for a verification email, then continue exploring." : notice)}</p>
            {signup && <p>{t("If the email has not arrived, you can resend it from Account.")}</p>}
            {auth.notice && <p>{t(auth.notice)}</p>}
            <AnimatedButton href={signup ? link(destination) : authHref("login")} arrow>{t(signup ? "Continue to dashboard" : "Back to Sign In")}</AnimatedButton>
          </div> : alreadySignedIn ? <div className="auth-success"><CheckCircle2 size={27} aria-hidden="true"/><h2>{t("You’re signed in")}</h2><p>{t("Your next chapter is waiting.")}</p><AnimatedButton href={link(destination)} arrow>{t("Continue to dashboard")}</AnimatedButton><a className="auth-text-link" href={link("/account")}>{t("Open Account")}</a></div> : <>
            <form className="auth-form" noValidate aria-label={t(heading)} aria-busy={Boolean(busy)} onSubmit={event => { event.preventDefault(); void run("email"); }}>
              {signup && <div className="auth-field"><label htmlFor="auth-name">{t("Full Name")}</label><input {...fieldProps("name")} required maxLength={60} autoComplete="name" placeholder={t("Your full name")}/>{fieldError("name")}</div>}
              {!action && <div className="auth-field"><label htmlFor="auth-email">{t("Email Address")}</label><input {...fieldProps("email")} required type="email" inputMode="email" dir="ltr" autoCapitalize="none" spellCheck={false} autoComplete="email" maxLength={254} placeholder="you@example.com"/>{fieldError("email")}</div>}
              {!reset && (!action || actionMode === "resetPassword") && <div className="auth-field"><div className="auth-label-row"><label htmlFor="auth-password">{t("Password")}</label>{mode === "login" && <a href={authHref("reset")}>{t("Forgot Password?")}</a>}</div><div className="auth-password-wrap"><input {...fieldProps("password")} required type={visible ? "text" : "password"} dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={signup || action ? 8 : 1} maxLength={128} placeholder={t(signup ? "Create a password" : "Enter your password")}/><button type="button" className="auth-eye" aria-label={t(visible ? "Hide password" : "Show password")} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button></div>{signup && <small id="auth-password-help" className="auth-password-help"><Check size={13} aria-hidden="true"/>{t("At least 8 characters. Use a mix of letters, numbers and symbols.")}</small>}{fieldError("password")}</div>}
              {signup && <div className="auth-field"><label htmlFor="auth-confirm">{t("Confirm Password")}</label><div className="auth-password-wrap"><input {...fieldProps("confirm")} required type={confirmVisible ? "text" : "password"} dir="ltr" autoComplete="new-password" maxLength={128} placeholder={t("Re-enter your password")}/><button type="button" className="auth-eye" aria-label={t(confirmVisible ? "Hide confirmation password" : "Show confirmation password")} aria-pressed={confirmVisible} onClick={() => setConfirmVisible(!confirmVisible)}>{confirmVisible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button></div>{fieldError("confirm")}</div>}
              {error && <p className="auth-feedback auth-feedback-error" role="alert" tabIndex={-1} ref={errorRef}>{t(error)}</p>}
              <AnimatedButton className="auth-primary" type="submit" disabled={Boolean(busy) || unavailable} arrow={!busy}>{busy === "email" && <Loader2 className="spin" size={17} aria-hidden="true"/>}{t(busy === "email" ? "Please wait…" : action ? "Confirm" : reset ? "Send reset email" : signup ? "Create Account" : "Sign In")}</AnimatedButton>
            </form>
            {!reset && !action && <><div className="auth-divider"><span>{t("or continue with")}</span></div><button className="auth-google" type="button" disabled={Boolean(busy) || unavailable} onClick={() => void run("google")}>{busy?.startsWith("google") ? <Loader2 className="spin" size={18} aria-hidden="true"/> : <GoogleMark/>}{t("Continue with Google")}</button>{popupFallback && <div className="auth-popup-help"><p>{t("If your browser interrupted the popup, you can sign in without a popup.")}</p><button type="button" className="auth-google" disabled={Boolean(busy) || unavailable} onClick={() => void run("google-redirect")}>{t("Continue with Google in this tab")}<ArrowRight size={16} className="flip-rtl" aria-hidden="true"/></button></div>}<p className="auth-switch">{t(signup ? "Already have an account?" : "New to Deen e Safar?")} <a href={authHref(signup ? "login" : "signup")}>{t(signup ? "Sign In" : "Create an account")}</a></p></>}
            {reset && <a className="auth-back" href={authHref("login")}><ArrowLeft size={16} className="flip-rtl" aria-hidden="true"/>{t("Back to Sign In")}</a>}
          </>}
          {auth.error && <p className="auth-feedback auth-feedback-error" role="alert">{t(auth.user ? "You’re signed in. Profile sync is temporarily unavailable. Retry from Account." : auth.error)}{auth.user && <a href={link("/account")}>{t("Open Account")}</a>}</p>}
          <div className="auth-guest"><span>{t("Just looking around?")}</span><a href={link("/dashboard")}>{t("Continue as Guest")}<ArrowRight size={15} className="flip-rtl" aria-hidden="true"/></a></div>
        </div>
        <p className="auth-footnote"><LockKeyhole size={13} aria-hidden="true"/>{t("Your journey, at your own pace.")}</p>
      </div>
      <JourneyIllustration/>
    </div>
    <p className="auth-outside-note"><Mail size={14} aria-hidden="true"/>{t("Your bookmarks and progress, together in one place.")}</p>
  </section>;
}
