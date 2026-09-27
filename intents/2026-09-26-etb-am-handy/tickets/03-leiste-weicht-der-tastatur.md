---
solution:  02-SOLUTION.md
satisfies: AC-4
after:     01-hauptansichten-mit-leiste
status:    ready
attempts:  0
---

## Build
On the phone the bar hides while the on-screen keyboard is open and comes
back when it closes, even if the text field keeps focus.

## Done when
> **AC-4** Ist am Handy die Bildschirmtastatur offen, ist die Leiste ausgeblendet; sie erscheint wieder, sobald die Tastatur geschlossen ist, auch wenn das Textfeld den Fokus behält (Android schließt die Tastatur mit „Zurück", ohne den Fokus zu nehmen). Erkannt wird die Tastatur daran, dass `visualViewport.height` um mehr als 150 px unter `window.innerHeight` liegt; ohne `visualViewport` bleibt die Leiste immer sichtbar.

## Context
The bar from 01 sits in `AppShell.Footer` below `sm`. Android closes the
keyboard with „Zurück" without blurring the field, so focus is not a usable
signal; the visual viewport shrinks while the keyboard is open.

## Plan
1. **Keyboard hook.** New `src/map/useKeyboardOpen.ts` (+ `.test.ts`):
   subscribes to `window.visualViewport` `resize`, returns
   `window.innerHeight - visualViewport.height > 150`; without
   `visualViewport` it returns `false`. Proof: tests with a stubbed
   `visualViewport` (event target with `height`): "reports open when the
   viewport shrinks by more than 150 px", "reports closed at exactly 150 px",
   "reports closed again after the viewport grows back", "reports closed
   without visualViewport".
2. **Hide the bar.** The workspace passes `footer={{ collapsed: keyboardOpen }}`
   (or hides the footer bar) below `sm`. Proof: workspace test "hides the bar
   while the keyboard is open" with the stub.
3. **Device check** on an Android phone (Chrome): open ETB, tap „Neuer
   Eintrag" – bar gone; press „Zurück" – bar back while the field keeps
   focus. Record in `## Record`; if no device is at hand, say so there.
4. `npm run check`.

## Not here
The bar and its placement (01). Header (02).
