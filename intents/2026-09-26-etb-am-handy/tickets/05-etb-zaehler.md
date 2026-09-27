---
solution:  02-SOLUTION.md
satisfies: AC-17
after:     01-hauptansichten-mit-leiste
status:    done
attempts:  1
---

## Build
The ETB item of the bar counts new entries from other authors that arrive
while another main view is shown.

## Done when
> **AC-17** Kommen per Live-Aktualisierung neue ETB-Einträge an, während eine andere Hauptansicht als das ETB zu sehen ist, zeigt der Punkt „ETB" in der Leiste ihre Anzahl. Gezählt werden nur Einträge, deren Urheber nicht der angemeldete Nutzer ist. Ein Wechsel ins ETB setzt den Zähler auf null. Der Zähler lebt nur in der geöffneten Seite: Grundlage ist die höchste Eintragsnummer, die zu sehen war, als das ETB zuletzt offen war; nach dem Neuladen beginnt er bei null. Beim Laden der Seite gelten alle vorhandenen Einträge als gesehen, auch wenn das ETB noch nicht offen war. Gespeichert wird nichts.

Edge case owned (from the solution):

> **Namen der Urheber für AC-17:** Die Seite muss dem Client den Nutzernamen des angemeldeten Nutzers mitgeben; heute tut sie das nicht.

## Context
Journal entries reach the workspace as `journalEntries: JournalEntryView[]`
(`number`, `author: string | null`, …) and are refreshed live via SSE →
`router.refresh()`. `author` is the stored `user.username`
(`journal-actions.ts`); automatic entries have `author: null`, which is not
the current user, so they count (confirmed at approval). `page.tsx` calls
`requireUser()`, which returns the `AuthenticatedUser` (with `username`), but
discards it today.

## Plan
1. **Pass the username.** `page.tsx` keeps the result of `requireUser()` and
   passes `currentUsername` to `SituationWorkspace`. Proof: `tsc` + the
   workspace tests below use the prop.
2. **Count.** New `src/map/unseen-entries.ts` (+ `.test.ts`):
   `countUnseenEntries(entries, seenUpTo, currentUsername)` counts entries
   with `number > seenUpTo` and `author !== currentUsername`. Proof: tests for
   none newer, newer from another author, newer own entry (not counted),
   newer automatic entry (`author: null`, counted), entry exactly at
   `seenUpTo` (not counted).
3. **Seen mark in the workspace.** `seenUpTo` starts at the highest number
   present at mount and follows the highest number while the ETB is the
   visible main view (including the `"default"` state on a phone). The bar's
   ETB item shows the count as a badge when > 0. Proof: workspace tests
   "counts a new entry from another author while the Lagekarte is shown"
   (rerender with an extra entry), "does not count own entries", "resets
   when switching to the ETB", "does not count entries present at load".
4. `npm run check`.

## Not here
The bar (01). Non-goal from the solution: a stored read state per user or
device – the count lives only in the open page.

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`). Result: green, 101 test files
and 708 tests.

Criterion → test:

- **Count of new entries on the ETB item while another main view is shown**:
  `src/map/SituationWorkspace.test.tsx`, "counting new ETB entries" › "counts a
  new entry from another author while the Lagekarte is shown" (rerender with
  one entry from `ben` and one automatic entry → „ETB 2 neue Einträge").
  The visible badge: `src/map/MainViewBar.test.tsx` "shows the number of new
  ETB entries on the ETB item" (text `3` inside the item; a temporary removal
  of the badge made it fail). "names a single new ETB entry in the singular"
  and "shows no count without new ETB entries" cover 1 and 0.
- **Only entries from other authors; automatic entries count**:
  `src/map/unseen-entries.test.ts` "does not count a newer entry of the
  current user", "counts a newer automatic entry"; workspace "does not count
  own entries".
- **Switching to the ETB resets to zero; the base is the highest number seen
  while the ETB was last open**: workspace "resets when switching to the ETB"
  (zero in the ETB and still zero back on the Lagekarte) and "treats entries
  arriving while the ETB is shown as seen". Removing the `setSeenUpTo` call
  in `switchMainView` made both fail; counting while the ETB is shown made
  the second fail.
- **All entries present at load count as seen, even before the ETB was
  open**: workspace "does not count entries present at load on the desktop"
  (desktop start on the Lagekarte). Starting the mark at 0 made it fail.
- **Boundary at the seen mark**: `unseen-entries.test.ts` "does not count
  the entry exactly at the seen mark", plus "counts nothing when no entry is
  newer" and "counts nothing for no entries".
- **Lives only in the page, nothing stored**: the mark is `useState` in
  `SituationWorkspace`; nothing else is written. Not a separate test.
- **Edge case, username to the client**: `page.tsx` keeps `requireUser()`'s
  result and passes `currentUsername={user.username}`; the prop is required,
  so `tsc` failed before `page.tsx` passed it.

Implementation: `countUnseenEntries` in `src/map/unseen-entries.ts`.
`SituationWorkspace` holds `seenUpTo` (initialised to the highest number at
mount), shows the count only while the Lagekarte is the main view, and moves
the mark to the current highest number on every main-view switch.
`MainViewBar` gets `newEtbEntries`; the ETB item shows a red count badge and
its accessible name becomes „ETB 3 neue Einträge" / „ETB 1 neuer Eintrag".
The test helper `selectMainView` now matches the item name by prefix.

Departure from the plan: step 3 said `seenUpTo` "follows the highest number
while the ETB is the visible main view". Instead, the count is 0 while the
ETB (or the pre-hydration `"default"`) is shown, and the mark is set when
the main view switches. The observable behaviour is the same: leaving the
ETB records the highest number it showed. There is no effect that tracks
the entries.

Review: two fresh-context `critique` rounds.
- Round 1: no blockers. One should-fix: no test covered the visible badge,
  only the `aria-label`. Fixed with the badge test above.
- Round 2: clean.

Left standing (decisions for a person, not changed):
- **Corrections change the Urheber.** Correcting an entry overwrites its
  `author` with the corrector (`src/server/journal/journal.ts`). The counter
  compares against the current author. So an entry written by me and later
  corrected by someone else counts (if it is newer than the mark), and an
  entry by someone else that I corrected elsewhere does not. A correction
  keeps the number, so it never counts as a new entry by itself.
- **My own automatic entries count.** Automatic entries have no author, so a
  status change I trigger while on the Lagekarte raises my own counter by 1.
  This follows the decision that automatic entries count.

Not run: no browser check. The badge's position over the icon, how it looks
with two or three digits, and white-on-`red-6` contrast were not seen in a
real browser. Whether moving directly from one Einsatz to another remounts
the workspace (and so resets the mark) was not confirmed in the running app.
