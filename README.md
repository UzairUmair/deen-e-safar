# Deen e Safar — Frontend

Next.js 16 / React 19 static frontend with Quran reading and recitation, prayer
times, duas, Hadith, learning paths, bookmarks, guest access, English/Urdu/Arabic
interfaces, and the existing 3D homepage.

Backend: [deen-e-safar-backend](https://github.com/UzairUmair/deen-e-safar-backend).
This repository contains the frontend at its root; it is independently installable.

## Run

Use Node.js 22 or 24 LTS:

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
