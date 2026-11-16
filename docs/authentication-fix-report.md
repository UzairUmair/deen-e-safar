# Authentication repair and redesign — 16 November 2026

## Findings and repaired behavior

The user-reported failure is Google signup. Live reproduction initially produced
Firebase auth/unauthorized-domain because deen-e-safar-six.vercel.app was absent
from Firebase's OAuth domain allowlist. Email/password signup already created a
real account and synchronized its MongoDB profile. Both providers were enabled.
Only the missing production hostname was added to Firebase, with user approval.

Subsequent live Google attempts reached the actual account chooser but returned
a blank helper page / automatic popup close. That earlier deployment did not complete live Google login. Its deeper browser-specific failure is unproven;
we do not label every popup-closed error a manual cancellation.

The prepared source repair implements Firebase's official same-origin helper
proxy for Vercel, popup flow on desktop, redirect flow on coarse-pointer/mobile
devices, and an explicit redirect recovery action after blocked or interrupted
popups. getRedirectResult restores the Firebase identity, and only a validated
local return route is kept in sessionStorage and consumed once. Tokens and
passwords are never stored by that routing helper. Google account conflicts
explain how to sign in using the existing method and explicitly link Google from
Account; there is no custom or silent merge implementation.

Signup has full name, email, password and confirmation; inline validation and a
synchronous in-flight guard prevent duplicate submissions. Email is trimmed and
lowercased, while passwords are preserved exactly. Firebase creation must succeed
before the account-created state is displayed. A subsequent refresh failure does
not reject the already-completed creation; the identity is retained and retry
guidance points to Account. Existing sync failures remain retryable through the
shared sync banner without creating another Firebase account.

Authentication forms no longer remount mid-operation when the Firebase UID
changes. Other screens retain UID-based remounts and private-store invalidation.
Central SDK initialization recognizes the default app correctly and clears a
rejected initialization promise so later initialization can retry. A single
cleaned-up auth-state listener manages restored identities. Error messages are
mapped safely, including disabled accounts, expired sessions and password-policy
failures. Login and reset messages avoid unnecessary account enumeration.

## Firebase and backend integration

The project remains deen-e-safar. The modular Firebase SDK handles credentials,
display-name update, verification email, reset email, persistence, popup/redirect,
linking and logout. Express accepts Bearer ID tokens, verifies them with Admin,
and derives ownership and role from trusted token claims. POST /api/auth/sync is
UID-idempotent. MongoDB User supports firebaseUid, name, email, photoURL, role,
preferences, timestamps and versioning; there is no password field. No backend
source modification was required for this task.

A controlled live account confirmed Firebase identity and MongoDB integration:
repeated sync reused the profile ID; valid tokens were accepted, invalid tokens
and a role patch were rejected. The disposable audit account and its private
profile were removed through the backend's recent-auth deletion flow. No real
user account was deleted or modified.

Guest Quran, prayer, duas, Hadith, dashboard, bookmarks and progress remain public.
Guest data is retained separately, and importing it still requires explicit
consent. Account privacy copy now describes Firebase, backend sync and optional
AI/history instead of incorrectly claiming that no account server exists.

## Sign In, Sign Up and reset design

The forms share warm ivory surfaces, navy typography, antique-gold accents and a
lightweight architectural/bookshelf SVG. The desktop layout pairs the form with
an arch illustration and welcome copy. Mobile shows the form in one column.
There is no Three.js canvas or additional image/library dependency on auth pages.

Existing AnimatedButton supplies the diagonal sweep. Inputs support labels,
password managers, visible focus, adjacent validation and independent visibility
toggles. Credential inputs remain LTR in Urdu/Arabic, while labels, artwork layout
and navigation mirror. Translations use the existing i18next dictionary. Short
entrance animation respects reduced motion; inputs use 16px text to avoid mobile
focus zoom. The auth route omits the fixed bottom navigation so it cannot cover
the submit/Google/switch-account controls. Public routes keep their navigation.

Reset has inline email validation, an existence-neutral sent state and a return
to Sign In. Signed-in users can still complete verification links. The success
screen explains verification and provides a dashboard action rather than showing
an unconfirmed success animation.

## Files

Core: app/lib/firebaseClient.ts, app/lib/authValidation.ts,
app/context/AuthContext.tsx, app/services/account/authTypes.ts.
UI: app/screens/AuthScreen.tsx, app/screens/Account.tsx, app/styles/auth.css,
app/layout.tsx, app/page.tsx, app/features/translations.json.
Hosting/setup: vercel.json, .env.example, README.md, package.json.
Verification: tests/components/auth.test.tsx, scripts/verify-auth.mjs,
scripts/verify-auth-ui.mjs and the three authentication reports in docs/.

## Production activation

The user approved publication and the exact OAuth origin/callback and public
Vercel authDomain changes. Source was pushed to frontend main as d585aff on
16 November 2026. Vercel deployment H1YRowDoejxKkdTQLGCjEpm5xNNi is Ready.

The existing Google web client now includes JavaScript origin
https://deen-e-safar-six.vercel.app and redirect URI
https://deen-e-safar-six.vercel.app/__/auth/handler. Existing entries were retained.
Production NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is deen-e-safar-six.vercel.app.
The deployed handler, iframe, handler.js, iframe.js and experiments.js each
returned HTTP 200 with the appropriate HTML/JavaScript content and no redirect.
The backend health endpoint returned 200 with accounts enabled.

The user completed real Google sign-in on the new production deployment. The app
returned to the named account dashboard with synchronization enabled. Reload
restored the same signed-in identity, and Account showed the expected display
name and verified email without a sync error. No personal account data was edited.
Google Cloud's initial Terms screen was completed by the user. No Google client
secret or Admin key belongs in the frontend, source or screenshots.

Official guidance: https://firebase.google.com/docs/auth/web/google-signin and
https://firebase.google.com/docs/auth/web/redirect-best-practices.
