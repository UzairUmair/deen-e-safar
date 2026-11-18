# Mobile interaction results
Real local Chrome, recorded public providers, Firebase Auth emulator, Admin token verification and temporary MongoDB. AI responses controlled test fixtures except where explicitly intercepted for renderer stress testing.

- Chat and Academy drawers: 320/360/390/430px; open, Escape, backdrop dismissal, focus entry/restoration, repeated Tab containment, body scroll lock/unlock. Passed after explicit Tab cycling fixed native boundary leakage.
- Global menu: open and Escape tested at these widths; backdrop dismissal implemented. No separate global backdrop assertion yet.
- Desktop layouts and RTL: existing 21 assistant layouts across 3 response languages and 7 widths; 14 account layouts across EN/UR.
- Assistant: guest greeting, verified signup, opt-in history, followup, rename/reopen/delete, three languages, guided link. Long 50-paragraph response with citations, internal scroll, Jump to latest and retained composer; simulated 503 retains input. Passed.
- Account: actual local profile edit, persisted learning settings, lesson bookmark/open/remove, resume progress, deletion cancel, signout and distinct track assets. Passed.
- Application regression: all 22 checks passed, covering real fixture audio play/pause/advance, error recovery, Quran search and bookmark persistence, reading position, prayer calculation/countdown rollover, location permission behavior, Dua filter/details/bookmarks, preferences and RTL. Obsolete source-search-only AI expectation updated to navigate the separate source browser.
- Additional controls smoke: 114 Surahs, search/clear/reader/audio controls, Dua search/filter and location selection surviving reload. Passed.

Limits: no physical Android/iOS keyboard tested; no real production Google login/Mongo/Groq retest. Streaming is not implemented by this API, so streamed-token scrolling is not claimed. History-prepend position preservation implemented but not separately browser stress tested. Original 108 width checks predate drawer changes; broader 22-check suite includes current EN/UR responsive cases.

## Current continuation
Repeated drawer tests now include route navigation with an open drawer and resizing to desktop/back to mobile, in addition to Tab, Escape, backdrop and focus restoration. All four phone widths passed. Twelve keyboard-height simulations passed (320/360/390/430 x 500/350/900px), including retained input, Send above fixed navigation, Shift+Enter and Enter with an intercepted greeting. A physical-device checklist is in mobile-keyboard-manual-test.md. No physical device or screen-reader session was performed.

Academy browser image check passed: first-revelation preview selects its matching Seerah cave artwork, 390px chooses the 600w source and 1440px chooses the original. A deliberately failed image request produces a neutral unavailable state, not an unrelated image.

Continuation: browser verified human artwork on Sahaba and Prophets track covers and Yusuf lesson. Progressive Hijrah gallery reveals four then five related images. Responsive image source and neutral failure fallback also passed after gallery integration.
