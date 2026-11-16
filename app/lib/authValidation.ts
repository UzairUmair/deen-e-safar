export type AuthFields = { name: string; email: string; password: string; confirm: string };
export type AuthFieldErrors = Partial<Record<keyof AuthFields, string>>;
export const normalizedEmail = (email: string) => email.trim().toLowerCase();
export function validateAuth(mode: string, fields: AuthFields, actionMode = ""): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === "signup" && !fields.name.trim()) errors.name = "Enter your full name.";
  if (mode !== "action" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail(fields.email))) errors.email = "Enter a valid email address.";
  if (mode === "login" && !fields.password) errors.password = "Enter your password.";
  if ((mode === "signup" || (mode === "action" && actionMode === "resetPassword")) && fields.password.length < 8) errors.password = "Use at least 8 characters.";
  if (mode === "signup" && !fields.confirm) errors.confirm = "Confirm your password.";
  else if (mode === "signup" && fields.confirm !== fields.password) errors.confirm = "Passwords do not match.";
  return errors;
}
/** Only known, local hash routes may be used after sign-in. */
export function authDestination(value: string | null): string {
  if (!value || value.length > 1024 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020#]/.test(value)) return "/account/dashboard";
  const name = value.split(/[/?]/)[1];
  return ["account", "bookmarks", "preferences", "dashboard", "quran", "duas", "hadith", "prayer", "ai", "learn", "course", "lesson", "reminders"].includes(name) ? value : "/account/dashboard";
}
const GOOGLE_RETURN_KEY = "deen-auth-return";
export function rememberGoogleReturn(destination: string) {
  try { sessionStorage.setItem(GOOGLE_RETURN_KEY, authDestination(destination)); } catch { /* The signed-in screen still offers a dashboard link if storage is unavailable. */ }
}
export function consumeGoogleReturn(): string | null {
  try {
    const value = sessionStorage.getItem(GOOGLE_RETURN_KEY);
    sessionStorage.removeItem(GOOGLE_RETURN_KEY);
    return value ? authDestination(value) : null;
  } catch { return null; }
}
