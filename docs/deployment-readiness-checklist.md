# Deployment readiness checklist — 2026-11-18

**BLOCKED for release. GitHub publication subsequently authorized on 2026-11-18; no separate manual deployment requested.** See [evidence and results](final-production-readiness-report.md).

## Verified locally / read-only

- [x] Standalone frontend and backend repository paths/remotes inspected; no commits or pushes made for final QA.
- [x] Node 24, Next 16.4.6, lint, TypeScript and final production build pass.
- [x] Static export in `out/`; hash routes and local image paths work without server-dependent image optimization.
- [x] 350 unique approved illustrations, 50/category, decodable renditions, no Prophet depictions; rejected/superseded outputs excluded from public.
- [x] Frontend 121 and backend 36 unit tests pass; integration and responsive evidence recorded.
- [x] Frontend/backend secret scanners pass; production dependency audits report zero vulnerabilities.
- [x] Frontend only receives public Firebase identifiers and HTTPS API origin. Local `.env.production` is ignored.
- [x] Backend private routes verify Firebase identity; ownership/expiry/revocation, citation rejection and quota checks pass.
- [x] Read-only hosted health is HTTP 200; exact production frontend CORS origin is returned.
- [x] Firebase public configuration includes the production frontend in authorized domains.
- [x] OAuth rewrites preserved. Image cache header prepared locally, not deployed.
- [x] Historical-source insufficiency remains visible; generated images are not used as evidence.

## Blocking external work

- [ ] Revoke and replace the exposed MongoDB/Groq credentials. User confirmed **not rotated yet** on 2026-11-18. Update backend secrets securely, verify revocation and never place replacements in frontend code, chat or Git.
- [ ] Obtain licensed, qualified-reviewed production evidence through the existing content workflow. Hosted health currently reports `reviewedEvidence: false` and `generatedAI: false`, despite a configured provider.
- [ ] After those changes and explicit deployment approval, verify a real authenticated production answer, references, follow-up context, account persistence and error handling. Do not override source gates to obtain a pass.

## Release acceptance still required

- [ ] Real Google consent callback and real verification/password-reset email round trip.
- [ ] Physical Android/iOS keyboard, safe-area and screen-reader testing.
- [ ] Representative hardware performance check; software-GPU long tasks and mobile Learn CLS ~0.101 need field validation.
- [ ] Operator review of final diff/assets and these reports, then complete the remaining release acceptance checks.

No production database seeding, source approval, role change, secret rotation, OAuth allowlist change or deployment was performed during this final QA brief. A non-fatal Mongoose reserved schema-path warning remains a maintenance item, not the cause of the production evidence gate.
