# Physical mobile keyboard checklist
No physical Android/iOS device was connected or tested in this work. Browser viewport simulation is a limited substitute.

On iOS Safari and Android Chrome, signed in to a test account:
1. Open Islamic AI; focus the textarea and show the native keyboard.
2. Type multiline English, Urdu and Roman Urdu. Verify cursor/composition behavior, no unintended submit while composing, and Send visible above keyboard and bottom navigation.
3. Rotate the device, expand/collapse browser chrome and hide/show keyboard. Confirm no large blank space or clipped composer.
4. Send a long question, read a long answer, expand references and scroll upward while a response is pending. Confirm no forced jump while reading; use Jump to latest.
5. Open/close history with keyboard visible. Confirm dismissal and focus restoration do not leave body scrolling locked.
6. Test VoiceOver/TalkBack dialog labels and traversal; background content should not be interactive while a modal drawer is open.
7. Repeat on a notched display, large text setting and small screen. Check safe-area spacing and screen zoom.

Record device, OS/browser version, keyboard, orientation, result and screenshot. Do not record credentials or user conversations. Browser simulations currently cover 12 width/height combinations, Shift+Enter and Enter with a controlled greeting; they do not emulate native IME or browser toolbar behavior completely.
