# Review: Ebenen und Meldungen nachbessern

Two review rounds over `git diff d9fa874`, each with a fresh `critique` subagent that was given
the diff, the check result and CRITERIA.md. Both reviewers also tried the change in the running
dev server.

## Fixed

- **AC-9 bug (round 2):** a panel or map action that failed *after* the user had left the
  Lageansicht still showed its notification on the Einsatzliste. Next does not cancel a server
  action on navigation, so the error arrived after the unmount had already closed the
  notifications. Leaving the Lageansicht now dismisses its sources, and an action that started
  before that shows nothing (`dismissActionErrors` / `beginAction` in
  `src/app/action-notification.ts`). This adds to the nudge that `SituationWorkspace` closes its
  sources on unmount and does not depart from it. Test first:
  `SituationWorkspace.notifications.test.tsx`.
- `useMapActionError` only renamed `useNotifyingActionRunner(SITUATION_MAP)` and was dropped. Its
  note on which map interactions report nothing now sits on `SITUATION_MAP`.
- `SIDEBAR_WIDTH` is now pinned by a test to the sidebar column in `situation-workspace.css`, and
  the CSS refers back to it.
- The glossary entry **Benachrichtigung** used "Kopfzeile" for the page header, but the glossary
  already defines that word as the Von/An/Weg line of an ETB entry. The entry and its comments now
  say "Kopfleiste".
- In `useImageOverlayEditing`, the Bild-Overlays runner is now named for what it does. Before,
  opacity, replace, delete and "Fertig" called `placementSaving.closeError()`.

## Left standing

- **The notification covers the mode band and the search on narrow screens.**
  - **Phone (390 px):** the notification half covers "Abbrechen" and "Hier setzen" in the mode
    band below the search.
  - **Narrow desktop (780 px):** it covers the whole search field.
  - It never closes by itself (AC-3), so a failed "Hier setzen" puts the Karte notification on
    the very button you need to retry or cancel.
  - **Why not fixed:** this follows from the agreed position ("oben mittig" / "oben rechts", under
    the header). AC-1 only checks the header, and the design is marked "do not redesign". **This
    needs your decision.**
- **`SituationWorkspace.tsx` (509 lines) and `leaflet-adapter.ts` (488 lines) grew without being
  split first.** Splitting them is a change of its own, so it is now a backlog ticket:
  `changes/backlog/situationworkspace-und-leaflet-adapter-aufteilen.md`.
- **`assertKmlDocument` stays in `kml-fetch.ts`.** The reviewer suggested moving it next to the
  KML format code, since file uploads use it too. `enforceKmlSizeLimit` already sits in the same
  module and is used for files too; moving one without the other would split the pattern.
- **`settleAction` / `run` return `R | ActionResult | null`.** Because of that, `useAreaFlows`
  needs `"id" in created` instead of `created?.id`. A narrower `R | { error: string }` would still
  need the same check, and a proper fix means changing the type of every action result. That is
  more than a nit is worth here.
- **On desktop the notification briefly slides in across the sidebar.** This is Mantine's default
  `top-right` transition. Once it settles it sits left of the sidebar as AC-1 asks. It is cosmetic
  and was not changed.
- **Mixed names for showing and closing notifications** (`showActionError`, `closeActionError`,
  `closeError`, `closeLageansichtNotifications`). This is a nit and was left. The glossary's
  `NotificationSource` is used consistently.

## Checks

`docker compose -f docker-compose.test.yml up -d && npm run check` passes on the final commit:
tsc and Biome are clean, and Vitest ran 163 files with 1693 tests passed.

No check was skipped. Bild-Overlay upload and editing were not tried in the running app, because
that would have created data; they are covered by the component tests.
