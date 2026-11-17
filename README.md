# Deen e Safar — Frontend

Next.js 16 / React 19 static frontend with Quran reading and recitation, prayer
times, duas, Hadith, learning paths, bookmarks, guest access, English/Urdu/Arabic
interfaces, and the existing 3D homepage.

Backend: [deen-e-safar-backend](https://github.com/UzairUmair/deen-e-safar-backend).
This repository contains the frontend at its root; it is independently installable.

## Run

Use Node.js 24 LTS (also pinned for Vercel):

```sh
npm ci
npm run dev
npm run build
```

Copy .env.example to .env.local to configure public Firebase web identifiers and
NEXT_PUBLIC_API_BASE_URL (the HTTPS backend origin, without /api). Guest mode
works without account configuration. Never put MongoDB, Groq or Admin credentials
in frontend environment variables. Production accounts and generated AI still
require backend credentials, Firebase Console setup and approved/licensed sources.

## Check

```sh
npm run lint
npm run typecheck
npm test
npm run verify
npm run check:secrets
```

With the site running, use npm run verify:app and npm run verify:ui. Browser checks
use recorded public-provider fixtures and an installed Chrome (or CHROME_PATH).
BASE can select another site URL. verify:auth additionally needs the backend's
local emulator harness; see docs/setup.md. Real Google consent and live API
integrations are not implied by emulator tests.

## Deploy

The frontend repository root is the hosting project root. Build with npm run build
and publish out/. Routes remain hash based, so no application-path rewrites are
needed. Set public environment variables before building the static export.

Vercel uses the committed vercel.json: Next.js preset, npm ci and npm run build.
Leave its Output Directory override disabled: the Next.js adapter reads .next
metadata and detects output: export itself. Keep the project root at ./ and remove
dashboard overrides that conflict with these settings. app/data contains required
public application source and must be committed; only root /data is ignored.

## Authentication

Authentication diagnosis, implementation and exact test boundaries are in
[authentication-debug-report](docs/authentication-debug-report.md),
[authentication-fix-report](docs/authentication-fix-report.md) and
[authentication-test-results](docs/authentication-test-results.md).
The local demo Auth emulator supports `npm run verify:auth` and
`npm run verify:auth-ui`. On Vercel, Google popup/redirect recovery uses the
committed `/__/auth/` reverse proxy. Register the frontend origin and its
`/__/auth/handler` URI in the existing Google OAuth client, authorize the hostname
in Firebase, and set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to that hostname before
building. Proxying requires a transparent rewrite, not a redirect.

## Shared catalog workflow

The API uses a generated catalog for lesson IDs, quiz keys and Quran bounds.
Generate it here with npm run catalog:sync (writes generated/catalog.json), or
supply the other checkout's content directory explicitly:

```sh
npm run catalog:sync -- ../deen-e-safar-backend/content
npm run verify:backend-catalog -- ../deen-e-safar-backend/content/catalog.json
```

Commit the resulting catalog in the backend repository when learning content
changes. The backend performs its own authorization and scoring.

Current instructions are in docs/setup.md. Other audit/implementation documents
are retained for project history and may describe the former combined workspace.


## AI Academy (local implementation)

See [implementation report](docs/ai-academy-implementation-report.md),
[architecture](docs/ai-academy-architecture.md), [API](docs/ai-academy-api.md),
[source policy](docs/ai-academy-source-policy.md) and [testing](docs/ai-academy-testing.md).
Historical source review and publication remain pending.

[Historical source research](docs/ai-academy-source-research.md) and
[adding reviewed passages](docs/ai-academy-content-review.md) describe licensing
and runtime lesson assignments. No publication or automatic approval.

## Account and learning redesign (local)

See [account design](docs/account-page-design.md), [academy design](docs/learn-islam-design.md), [image manifest](docs/academy-image-manifest.md), [source policy](docs/academy-source-policy.md), and [test report](docs/account-and-learning-test-report.md).
