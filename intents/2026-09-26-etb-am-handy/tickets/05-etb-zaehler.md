---
solution:  02-SOLUTION.md
satisfies: AC-17
after:     01-hauptansichten-mit-leiste
status:    ready
attempts:  0
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
