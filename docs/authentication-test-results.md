# Authentication verification — 16 November 2026

## Automated results

| Check | Result | Boundary |
| --- | --- | --- |
| Frontend typecheck | Pass | tsc --noEmit |
| Frontend lint | Pass | eslint . |
| Frontend Vitest | 113 passed, 9 files | Includes 23 auth component/behavior cases |
| Source/content verification | Pass | 114 chapters, 6,236 verses, 19 duas, 121 Hadith, 15 lessons |
| Secret scan / diff whitespace | Pass | No private credentials in tracked/unignored source |
| Auth browser integration | Pass | Real local Firebase SDK + Auth emulator + Admin verification + temporary MongoDB |
| Auth responsive UI | 28 layouts passed | EN/UR × login/signup × 320, 360, 390, 430, 768, 1024, 1440px |
| Existing application browser checks | 22 passed | Quran/search/audio/bookmarks/progress/prayer/duas/Hadith/learning/preferences/guest |
| Homepage/UI browser checks | 12 passed | 3D story/bookshelf/sweep/mobile navigation/RTL/reduced-motion/static fallback |
| Next production build | Pass | Node 24, static export |
| Unchanged backend test suite | 26 passed | Server auth/ownership/validation and startup |

Commands used: npm run typecheck, npm run lint, npm test, npm run verify,
npm run check:secrets, npm run verify:auth, npm run verify:auth-ui. Existing browser
suites used BASE=http://127.0.0.1:3100, the modified frontend's actual local server.
An initial run at the default unserved port 3000 failed to connect and was rerun
against 3100; that connection failure was not a product regression.

## Auth scenarios exercised

Controlled component tests cover empty fields, malformed email, weak password,
confirmation mismatch, email normalization, immediate duplicate-submit protection,
loading/disabled controls, existing-email rejection, disabled accounts, incorrect
credentials, network failures, safe provider-conflict instructions, popup close,
popup blocked, unauthorized domain, password visibility, neutral reset success,
reset failure, post-creation refresh failure, safe local return paths, redirect
recovery and one-time redirect return, and verification while already signed in.

The local browser test exercises real SDK signup/display-name/verification-email
requests, login, verified-email action, reset-email/action/new-password login,
Google popup, a real SDK popup-blocked error, redirect recovery using the same
Google identity, reuse of its MongoDB profile ID, restored session after reload,
guest import consent/idempotency/retention, protected routes, profile persistence,
logout and recent-auth deletion. **Google credentials are simulated by the Auth
emulator.** Password-reset email delivery is not inferred from this emulator test.

UI tests check overflow, 44px tap targets (subpixel tolerance), LTR credential
inputs, autocomplete semantics, absence of canvas, inline-error focus, keyboard
focus, visibility toggles, dark theme and reduced-motion behavior. Screenshots
were visually inspected; RTL icon/placeholder overlap and auth bottom-nav overlap
were corrected. Visuals live in ignored .openai/auth/ (login/signup, EN/UR,
390/1440px and dark signup). No auth page loads the homepage WebGL scene.

## Live production checks

| Check | Observation |
| --- | --- |
| Existing email signup UI | Created a unique real Firebase test account and reached its synchronized dashboard |
| Valid Firebase token / MongoDB profile | Accepted by the live API |
| Repeated POST /api/auth/sync | Same profile ID; no duplicate profile |
| Invalid token | Rejected with 401 |
| Client-supplied role patch | Rejected with 400 |
| Disposable account cleanup | Account and private profile removed using backend deletion; Firebase absence confirmed |
| Google before domain change | Reproduced unauthorized-domain error |
| Google after approved domain change | Actual Google chooser opens; later callback blank/automatic close observed |
| Complete live Google session | **Passed** on the new deployment; returned to named synchronized account dashboard |
| Real verification/reset email receipt | Not tested; test address is reserved and has no inbox |

No raw ID tokens, passwords, OAuth return codes or private keys are recorded.
The live backend identity smoke used only the disposable audit identity. Other
users and their saved data were not changed.

## Production deployment verification

Approved source d585aff was published to frontend main. Vercel deployment
H1YRowDoejxKkdTQLGCjEpm5xNNi is Ready with the approved production authDomain.
The exact OAuth origin/callback were saved and read back in Google Cloud.
All five frontend-origin Firebase helper endpoints (handler, iframe, handler.js,
iframe.js, experiments.js) returned HTTP 200 without a redirect. Backend health
returned HTTP 200 with accounts enabled. The new auth UI is visible in production.

The user completed real Google login using the frontend callback. The app returned
to the named synchronized account dashboard. Reload preserved the session, and
Account displayed the same name and verified email without a sync error. No
personal account data was edited. A second fresh live Google login was not
performed; repeated Google identity/profile reuse passed in the emulator suite.
Real mobile-device and Safari OAuth behavior remain unverified; responsive
Chromium checks do not establish their storage behavior.
