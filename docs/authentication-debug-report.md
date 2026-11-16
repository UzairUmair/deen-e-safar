# Authentication diagnosis — 16 November 2026

## Correct sources

The deployed frontend is the independent `Deen-E-Safar-Frontend` checkout of
UzairUmair/deen-e-safar (Next.js 16.4.2, React 19, TypeScript, static export,
hash routing). The Express API is the independent Deen-E-Safar-Backend checkout
of UzairUmair/deen-e-safar-backend. Both started clean on main. The older combined
Deen-E-Safar workspace contains a historical, uncommitted folder separation and
is not the source to edit or publish. Work is isolated on codex/authentication-redesign.

## Reproduced production failure

The user clarified that **Google signup**, rather than email signup, fails.
On https://deen-e-safar-six.vercel.app/#/auth/signup, clicking Continue with Google
displayed “Sign-in is unavailable on this domain. Continue as Guest.” This is the
application's safe mapping for Firebase `auth/unauthorized-domain` in
app/context/AuthContext.tsx. Firebase's authorized-domain settings contained only
localhost, deen-e-safar.firebaseapp.com and deen-e-safar.web.app. The production
Vercel hostname was absent. Both Email/Password and Google providers were enabled.

Google authentication stopped at Firebase's origin check, before an ID token or
backend sync could exist. No raw SDK stack was exposed by the UI; the available
console error was an unrelated browser-extension connection error. No password,
ID token, OAuth state or private credential is included in this report.

With the user's explicit approval, only deen-e-safar-six.vercel.app was added to
the Firebase OAuth domain allowlist. Retesting opened the actual Google Accounts
chooser instead of the error. Completing personal Google consent is a separate
manual test; reaching the chooser alone is not a successful Google login.

## Email signup baseline and code findings

A unique controlled test identity on the live site successfully created a real
Firebase account and reached the named, synchronized account dashboard. This
does not establish real email delivery to the reserved test address. Test cleanup
and subsequent integration results are recorded in authentication-test-results.md.

The existing implementation already uses modular Firebase Auth, one auth listener,
revocation-aware Admin verification, bearer tokens and UID-keyed MongoDB upsert.
Guest storage is separate and importing it requires consent. No custom password
database or new framework is needed.

Additional defects to fix: post-creation refresh can reject after Firebase has
already created an account; rejected initialization stays cached; duplicate
submissions rely only on render-time disabled state; signup has no confirmation
password or inline validation; protected return paths are lost; several Firebase
errors lack actionable mappings. Existing forms also need the requested visual,
responsive and translated redesign.

## Verification plan

Exercise post-creation and sync failures with controlled drivers, preserving the
authenticated identity. Add form tests for validation, duplicate submit, safe
return paths, reset confirmation, Google error states and password visibility.
Run Firebase-emulator integration against temporary MongoDB and test desktop,
mobile and RTL layouts. Separately report live email signup, Google chooser/
consent, session restoration and backend synchronization; never label a mock as
live success. Keep homepage, public features, guest data and hash routes intact.

No source changes will be pushed without the user's permission.

## Follow-up: automatic popup close and blank return page

After the allowlist correction the user completed Google account selection, but
the app received the safe `auth/popup-closed-by-user` message. The user confirmed
that the popup closed automatically, and on a further attempt saw a blank return
page. No full Google session arrived in the tracked app tab. The Firebase helper
HTML for both `/__/auth/handler` and `/__/auth/iframe` returned HTTP 200 directly.
These facts establish a failed callback handoff, not an ordinary user cancel.
They do not establish the browser-specific cause of that handoff failure.

The existing Google OAuth client registers only the Firebase-hosted callback;
its JavaScript origins contain localhost, localhost:5000 and the Firebase domain.
The prepared repair uses Firebase's documented same-origin auth-helper proxy to
remove the cross-origin helper dependency and provides signInWithRedirect plus
getRedirectResult as a supported alternative to a blocked/interrupted popup.
See https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3.
This hosting change, new OAuth origin/callback and frontend authDomain must ship
together; a successful emulator redirect is not proof of the live Google callback.

Browser testing also exposed a route-lifecycle defect: the outer screen wrapper
was keyed by Firebase UID, so successful authentication remounted AuthScreen
before its in-flight operation could show the confirmed success state. Auth
screens now retain their operation state across UID changes. Other application
screens keep their existing UID boundary for private-data isolation.


## Approved production activation

On 16 November the user approved publication, the exact Google OAuth frontend
origin/callback and Vercel public authDomain change. These were applied; source
commit d585aff is on main and its production deployment is Ready. All five
frontend-origin helper endpoints returned 200 without a redirect, and the actual
Google chooser now uses the frontend-origin callback. The user then completed real Google sign-in: the named synced dashboard appeared,
a reload restored the identity, and Account showed the verified email/profile
without a sync error. This confirms successful callback handoff on the tested
Chrome session; it does not establish Safari or real-mobile behavior.
