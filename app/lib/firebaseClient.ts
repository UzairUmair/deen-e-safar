import { getApp, getApps, initializeApp } from "firebase/app";
import { applyActionCode, browserLocalPersistence, confirmPasswordReset, connectAuthEmulator, createUserWithEmailAndPassword, EmailAuthProvider, getAuth, GoogleAuthProvider, inMemoryPersistence, linkWithPopup, onAuthStateChanged, reauthenticateWithCredential, reauthenticateWithPopup, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, verifyPasswordResetCode, type User } from "firebase/auth";
import { firebaseWebConfig, firebaseConfigured, firebaseEmulatorUrl } from "./firebaseConfig";
import type { AuthDriver, AuthIdentity } from "../services/account/authTypes";
let driver: Promise<AuthDriver> | null = null;
const wrap = (user: User | null): AuthIdentity | null => user ? ({ uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified, providers: user.providerData.map(p => p.providerId), getToken: refresh => user.getIdToken(refresh) }) : null;
export function createFirebaseDriver(): Promise<AuthDriver> {
  driver ??= (async () => {
    if (!firebaseConfigured) throw new Error("Sign-in is not configured.");
    const app = getApps().length ? getApp() : initializeApp(firebaseWebConfig);
    const auth = getAuth(app);
    if (firebaseEmulatorUrl) {
      const url = new URL(firebaseEmulatorUrl);
      if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Authentication emulator is development-only.");
      connectAuthEmulator(auth, firebaseEmulatorUrl, { disableWarnings: true });
    }
    try { await setPersistence(auth, browserLocalPersistence); } catch { await setPersistence(auth, inMemoryPersistence); }
    const current = () => { if (!auth.currentUser) throw new Error("Sign in to continue."); return auth.currentUser; };
    return {
      subscribe: (callback, error) => onAuthStateChanged(auth, user => callback(wrap(user)), error),
      login: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
      signup: async (name, email, password) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        let warning = "";
        try { await updateProfile(result.user, { displayName: name }); } catch { warning = "Account created. Update your name from Account."; }
        try { await sendEmailVerification(result.user); } catch { warning = "Account created. Send a verification email from Account."; }
        return warning;
      },
      google: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
      logout: () => signOut(auth),
      verifyEmail: () => sendEmailVerification(current()),
      resetEmail: async email => { try { await sendPasswordResetEmail(auth, email); } catch (e) { if ((e as { code?: string }).code !== "auth/user-not-found") throw e; } },
      refresh: async () => { if (!auth.currentUser) return null; await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return wrap(auth.currentUser); },
      reauthenticate: async password => {
        const user = current();
        if (user.providerData.some(p => p.providerId === "password")) {
          if (!password || !user.email) throw new Error("Confirm your password.");
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
        } else await reauthenticateWithPopup(user, new GoogleAuthProvider());
        await user.getIdToken(true);
      },
      linkGoogle: async () => { await linkWithPopup(current(), new GoogleAuthProvider()); },
      setName: async name => { await updateProfile(current(), { displayName: name }); await current().getIdToken(true); },
      action: async (mode, code, password) => {
        if (mode === "verifyEmail") { await applyActionCode(auth, code); return "Email verified. Sign in or refresh your account."; }
        if (mode === "resetPassword") {
          await verifyPasswordResetCode(auth, code);
          if (!password) return "Choose a new password.";
          await confirmPasswordReset(auth, code, password); return "Password reset. Sign in with your new password.";
        }
        throw new Error("This action link is invalid or expired.");
      },
    };
  })();
  return driver;
}
