# Final mobile testing — 2026-11-18

**Browser simulations passed; no physical phone or device-testing service was used.** Do not interpret resized Chromium viewports as real Android/iOS keyboard or browser-chrome behavior.

| Coverage | Executed result |
| --- | --- |
| 320, 360, 390, 430, 768, 1024, 1440, 1920px | 12 routes × EN/UR = 192 geometry checks passed |
| Chat history and course-outline drawers | At 320/360/390/430px: open/close, Tab containment, Escape, backdrop, focus restore and body unlock passed |
| Drawer cleanup | Resize to desktop and route changes leave no stuck overlay or body lock |
| Global mobile navigation | Open and Escape passed; representative opening/closing recorded |
| Chat keyboard simulation | Four widths × heights 500/350/900 = 12 checks; draft and Send remain visible above navigation; Shift+Enter inserts newline, Enter submits |
| Account | 14 authenticated EN/UR layouts; profile/settings persistence and saved-content actions passed |
| Academy | 42 layouts, guest import, teaching/quiz/progress/resume and dark/reduced-motion integration passed |
| Assistant | 21 layouts and long-response/error scenarios passed |

The page matrix checks document overflow, heading/header overlap, document direction, button names and browser errors. Screenshot review covers card sizing, text wrapping, hero cropping, form and action visibility at 390px/1440px. API requests use recorded public-provider fixtures; Firebase identity and database integration use an isolated emulator and temporary database. Google consent is simulated in that environment.

Actual image browser checks passed: responsive delivery, correct lesson artwork, anonymous Sahaba illustration, nonfigurative Prophets cover/Yusuf lesson, progressive gallery and broken-image fallback. The desktop Academy hero collapse found during visual inspection was fixed and the final layout captures repeated.

## Remaining physical checks before release

Use representative Android Chrome and iOS Safari to exercise AI and Academy composers, Account forms, Sign In/Sign Up and searches with the native keyboard. Check address-bar expansion, keyboard close, rotation, multiline text, draft preservation, scrolling and safe-area Send visibility. Complete live Google consent and email actions separately. Test a screen reader and representative touch targets on those devices. These checks remain open; no physical-device pass is claimed.

Evidence: `.openai/final-qa/layout-results.json`, `.openai/refinement/keyboard-simulation.json`, final integration logs, screenshot directory and representative WebM. Reproduce with `BASE=http://127.0.0.1:3100` and the final layout/mobile scripts against the local demo setup; `verify-mobile-viewport.mjs` specifically intercepts the local greeting API for deterministic submission.
