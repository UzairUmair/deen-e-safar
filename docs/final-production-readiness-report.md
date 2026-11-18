# Final production readiness — 2026-11-18

**Release recommendation: BLOCKED.** Local implementation and QA are ready for review. Production release is blocked by unrotated exposed credentials and the hosted backend's missing approved evidence corpus. The user confirmed on 2026-11-18 that the shared MongoDB/Groq credentials have **not** been rotated. QA was completed locally. The user subsequently authorized GitHub publication on 2026-11-18, while deferring credential rotation. Publication does not clear the release blockers. No separate manual deployment is being performed.

## A. Independently verified image library

The canonical manifest contains 353 records: 350 approved current illustrations and three rejected attempts. There are exactly 50 approved illustrations in each of seven categories, 350 different SHA-256 hashes, and no duplicate candidates within dHash distance five. This does not prove semantic uniqueness; visual review also checked repetition.

All 350 were visually inspected. The original 53 figural images were viewed individually at original 1448 × 1086 resolution, including background faces and reflections. The other 297 were inspected on 19 labeled sheets. Twenty-five Prophet-related figural images were rejected under the final brief and edited to remove every person; all 25 edited originals were then inspected individually. The current library contains 28 anonymous, fully face-obscured historical illustrations and **zero Prophet representations**. Thematic approval is separate from scholarly historical review.

Public storage contains 713 WebP files: 350 originals at 1200 × 900, 350 responsive versions at 600 × 450, and 13 retained legacy hero/fallback images. Current approved originals total 89,057,694 bytes (84.93 MiB). Derivatives are not counted as unique art. Superseded versions and rejected attempts were moved to an ignored, non-public archive; the manifest preserves their history. See [image quality report](final-image-quality-report.md).

## B. Frontend changes and measured results

Preserved the established design and features. Fixed the collapsed desktop Academy hero, invalid image ARIA, insufficient small-text contrast, overly large card image selection and an initial footer jump. Academy code now loads on demand; gallery images render progressively. Stable artwork associations, review disclosures, neutral failure states, navbar measurement, mobile drawers and global diagonal buttons remain intact.

Final exported-build browser samples, after 2.5 seconds, using local HTTP, recorded provider fixtures and software GPU:

| Sample | Before | Final |
| --- | ---: | ---: |
| Desktop Learn initial Academy images | 7 / 1,855,684 bytes | 7 / 668,922 bytes |
| Mobile Learn initial Academy images | 2 / 330,266 bytes | 2 / 330,266 bytes |
| Homepage Academy images | 0 | 0 |
| Mobile homepage CLS | 0.849 | 0.022 |
| Mobile Learn CLS | 1.000 | 0.101 |
| Desktop Learn CLS | 0.937 | 0.069 |

Desktop image transfer decreased approximately 64%. Card widths near 347px select 600px assets. The hero retains its larger rendition. Encoded JS measured 2,275,026 bytes on Home and 1,488,396 on Learn; Firebase configuration changed between the baseline and final builds, so these totals are not a clean code-only comparison. Main viewport reservation removed the large initial footer shift. Remaining mobile Learn CLS is slightly above 0.10 and merits field measurement.

Software-rendered homepage WebGL still produced 1.5–1.9 second long tasks. This is a real limitation of these measurements, not evidence of smooth physical-device performance. Homepage motion, idle stopping, reduced-motion and no-WebGL fallback tests passed. No Lighthouse score, field Core Web Vitals, physical-phone result or WCAG certification is claimed.

## C. AI, learning and accounts

Local Firebase SDK/Auth emulator + Admin + temporary MongoDB integration passed for profile persistence, authorization, account settings, guest import/isolation, assistant conversation CRUD, follow-up context, three languages, lesson progression/resumption and server-scored quizzes. Browser AI responses use controlled fixtures. Separately, the actual Groq SDK transport smoke test passed with structured answers and citation validation; this is a software test, not scholarly validation.

Read-only production `/api/health` returned HTTP 200, account readiness and the exact allowed frontend CORS origin. Its capability response reported `providerConfigured: true`, `reviewedEvidence: false`, `generatedAI: false`. Therefore live generated teaching answers are **not release-ready**. Do not bypass the evidence gate. Qualified review, provenance and legal permission are required before approving production passages. Source IDs/reference validation cannot establish semantic or religious correctness by itself.

## D. Executed verification

| Check | Result and scope |
| --- | --- |
| Frontend unit tests | 121/121 passed, 10 files, Node 24 |
| Backend tests | 36/36 passed, serial Node 24 run |
| Lint / TypeScript / production build | Passed after final application changes; Next 16.4.6 static export |
| Application browser regression | 22/22 passed: Quran, audio, Duas, prayer, settings, bookmarks, failures |
| Homepage UI / motion | 12 UI and 7 motion checks passed |
| Auth integration | Passed; Google identity simulated by Auth emulator |
| Academy / Account / assistant integration | Passed; 42 / 14 / 21 responsive layouts respectively |
| Final page matrix | 192 checks: 12 pages × EN/UR × eight widths; no overflow, heading/header overlap, unnamed visible buttons or page errors |
| Accessibility | 24 light-theme mobile screens: no axe WCAG-tagged violations after fixes; manual-review incomplete items remain |
| Mobile drawers | Four widths: focus containment/restoration, Escape, backdrop, scroll unlock, resize and route cleanup passed |
| Keyboard viewport simulation | 12 size combinations passed; Shift+Enter and Enter behavior passed |
| Image validation / mapping | 350 approved assets and derivatives decode; policy, associations, gallery and failure fallback passed |
| Data compatibility | 114 chapters, 6,236 verses, 19 Duas, 121 bilingual Hadith; backend catalog compatibility passed |
| Secret scans / dependency audits | Both repositories passed secret scans; both production dependency audits reported zero vulnerabilities |

Early runs exposed image ARIA/contrast defects; those were fixed and the accessibility rerun passed. A screenshot fixture-date mismatch was corrected in the layout harness, without changing application dates or source data. A concurrent final UI run encountered two navigation transport/time-out failures; its log is retained separately from `final-ui-rerun.log`, whose isolated run passed all 12 checks against the final export. No failed trial is counted as a passing run. Physical-device keyboard, real Google consent completion, real email delivery and assistive-technology testing were not performed in this brief.

## E. Repository, output and configuration

Actual repositories are sibling standalone projects, `Deen-E-Safar-Frontend` and `Deen-E-Safar-Backend`. Frontend branch is `codex/ai-assistant`, audited HEAD `ed8c01d163f2c6737ca5c46298d4e94a57d8960a`; backend HEAD `ee031731e3bd9301eb1183cb777378bc7cc6b387`. The frontend has existing and current uncommitted source, asset and documentation changes; backend working tree was clean. These are working-tree results, not claims about remote publication.

`out/` contains the final static export; `.next/` contains ignored build intermediates. Public HTTPS API/Firebase configuration was supplied to the local production build through ignored `.env.production`. Public Firebase project identifiers are browser configuration; MongoDB/Groq/Admin credentials are server-only. Firebase's public project response includes the production frontend in authorized domains. Vercel OAuth rewrites remain intact; a public-image cache header was prepared locally. Neither hosted environment secrets nor deployment settings were changed during this QA.

Next is pinned to 16.4.6; see the [official release](https://github.com/vercel/next.js/releases/tag/v16.4.6). The actual final build produced no prior security-version warning. Zero reported audit vulnerabilities is a dated check, not a perpetual security guarantee. A non-fatal backend Mongoose reserved `collection` schema-path warning remains a maintenance item.

## F. Release decision and evidence

1. **Blocking:** revoke and replace all exposed MongoDB/Groq credentials in the backend environment, verify old values no longer work and redeploy only after approval. Do not paste replacements into chat or source.
2. **Blocking:** ingest licensed passages into production, obtain qualified source review, approve them through the existing workflow and verify generated answers/citations end to end.
3. **Before release:** verify real Google/email callbacks and a physical mobile keyboard; measure performance on representative hardware. GitHub publication was subsequently authorized; the outstanding release checks still apply.

Local evidence is under ignored `.openai/final-qa/`: final build/lint logs, 192-row layout JSON, 24-screen axe JSON, performance baseline/final JSON, image inventory/review sheets and replacements. Earlier integration logs are preserved there. `final-hosted-health.json` records the read-only production capability check. All current approved images/renditions exist in `out/`, and none of the retired originals remain exported. Screenshots and representative mobile interaction WebMs are in its `screenshots/` and `video/` directories; authenticated Account screenshots come from the local integration run. These artifacts remain local and do not contain backend credentials.

Companion reports: [UI audit](final-ui-audit.md), [mobile testing](final-mobile-testing.md), [deployment checklist](deployment-readiness-checklist.md).
