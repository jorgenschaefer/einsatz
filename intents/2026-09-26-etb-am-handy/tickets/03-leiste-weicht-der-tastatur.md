---
solution:  02-SOLUTION.md
satisfies: AC-4
after:     01-hauptansichten-mit-leiste
status:    done
attempts:  1
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
3. `npm run check`.

## Not here
The bar and its placement (01). Header (02).

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`). Result: green, 99 test files and 682
tests.

Criterion → test:

- **AC-4, detection (more than 150 px below `innerHeight`)**: see
  `src/map/useKeyboardOpen.test.ts`:
  - "reports open when the viewport shrinks by more than 150 px" (151 px)
  - "reports closed at exactly 150 px"
  - "reports closed while the viewport is full height"
  - "reports open when mounted while the keyboard is already open"
  
  A temporary `>` → `>=` mutation made the 150 px test fail.
- **AC-4, bar comes back after the keyboard closes**: see "reports closed again
  after the viewport grows back". "stops listening once unmounted" checks that the
  hook removes its listener. A temporary mutation that dropped the removal made
  that test fail.
- **AC-4, no `visualViewport`**: see "reports closed without visualViewport".
  jsdom has no `visualViewport`, so every other shell or workspace test also
  renders the bar in this state.
- **AC-4, bar hidden and back while the field keeps focus**: see
  `src/map/SituationWorkspace.test.tsx`, "hides the phone bar while the on-screen
  keyboard is open, even with the field still focused". It focuses „Neuer
  Eintrag", shrinks the viewport, and asserts that the footer (`contentinfo`) is
  gone. It then grows the viewport back and asserts that the field still has
  focus and the footer is back. It also asserts on Mantine's
  `--app-shell-footer-offset:0px !important`, which shows that the main view
  gets the bar's 56 px back. Removing `collapsed` made this assertion fail.

Implementation: `useKeyboardOpen` (`useSyncExternalStore` on
`visualViewport` `resize`; the server snapshot is `false`). `LageansichtShell`
calls the hook and does two things while the keyboard is open:
- it sets `footer.collapsed` so the main view gets the space back;
- it unmounts `AppShell.Footer`, so the off-screen bar cannot be reached with Tab
  or a screen reader.

The desktop rail (`AppShell.Navbar`) is untouched. The shared stub is in
`src/test/visual-viewport.ts`.

Departures from the plan:
- The hook is called in `LageansichtShell` and not in the workspace, because the
  shell owns the footer configuration. No prop is threaded through. The
  workspace test the plan asked for still exercises it end to end.
- The plan said "collapsed (or hide)". The build does both, for the reasons
  above.

Review: one fresh-context `critique` round, no blockers and no should-fix
items. Two nits were left:
- The keyboard test lives in `SituationWorkspace.test.tsx` rather than
  `LageansichtShell.test.tsx`.
- The hook lives in `src/map/` although its only caller is the shell.

Both follow the ticket's plan, so I did not move them.

Left standing:
- **Pinch zoom (decision for a person, not changed).** The AC's rule also fires
  when the ETB page is pinch-zoomed in far enough (`visualViewport.height`
  shrinks with the zoom factor), so the bar hides until the user zooms out.
  This is harmless and matches the AC as written. A possible amendment is to
  also require `visualViewport.scale ≈ 1`.
- **Browsers whose keyboard also shrinks the layout viewport (fail-safe).** In
  older Android Chrome, and possibly other Android browsers, the keyboard also
  shrinks `window.innerHeight`. There the gap stays small and the bar never
  hides. That fails safe: it behaves like having no `visualViewport`.
- **Not run:** no browser or real-device check. Headless Playwright has no
  on-screen keyboard to open. No second review round, because round 1 came back
  clean.
