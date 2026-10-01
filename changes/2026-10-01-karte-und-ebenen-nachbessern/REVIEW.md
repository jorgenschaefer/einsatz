# Review: Karte und Ebenen nachbessern

Two review rounds over `git diff 9f244ebc780f7598fc1d763922a40403f864b7c8`, each
by a fresh `critique` reviewer measuring against `CRITERIA.md`. Both reviewers
found all of AC-1 to AC-15 met and saw no blockers. Both also checked the
running app: KML circles, the panel message, and the 404s.

## Fixed

- **Round 1, should-fix:** each of the three panels had its own copy of the
  closable red alert. The older copies in `StrengthPanel` and on the map had
  already drifted and had no "Meldung schließen" label on the ×. All six places,
  including `EntryForm`, now use `src/app/ErrorAlert.tsx` (07b0dfe).
- **Round 1, nit:** `ViewLinkPanel` now clears its message when a deletion
  succeeds, as `KmlPanel` already did when a removal succeeded (326878c).
- **Round 1, nits:** the circle's CSS moved from `leaflet-adapter.css` to
  `kml-layer.css`, next to `KML_CIRCLE_RADIUS`, which depends on it. The
  functions in `kml-layer.ts` are now ordered top-down (5814103).

## Left standing

- **Round 2, should-fix:** "a successful removal or deletion should not clear
  the panel message" (`KmlPanel.tsx` `remove`, `ViewLinkPanel.tsx`
  `deleteLink`). The case is narrow: an earlier action (Neu laden, or Ansichtslink
  erzeugen) fails while the remove or delete confirmation is open. When the
  removal then succeeds, its failure message goes away. The reviewer argues
  that this failure still applies. I did not change it, for three reasons:
  - AC-3 says that while an action runs, no message from an earlier action
    shows, and that a successful action shows none. The removal is the newer
    action, so the current behaviour is AC-3 read literally.
  - The KML build chose this behaviour on purpose and pinned it with a test.
  - Round 1 asked for the two panels to behave the same, and round 2 asks for
    the opposite.

  If it should change, AC-3 needs to say what happens to a failure that arrives
  while a confirmation is open. That is a product decision, not a cleanup.
- **Round 2, nit:** in `SituationWorkspace.tsx`, the map message sits in a
  positioned `Box` that renders only when `mapError` is set. The `ErrorAlert`
  inside it checks for `null` again. The second check is redundant but
  harmless. Dropping the outer guard would leave an empty positioned box, so I
  left it.
- **Outside this change, noted by round 2:** `/operations/<keine UUID>/events`
  answers 200. No AC covers the SSE route, and this change does not touch it. A
  file named `.kmz` that is not a ZIP is embedded as KML. That is close to the
  out-of-scope `kml-url-ohne-kml-ablehnen`.

## Checks

`docker compose -f docker-compose.test.yml up -d --wait && npm run check` was
run after the round 1 fixes and passed: tsc, Biome, and Vitest with 146 files
and 1510 tests. Round 2 changed no code, so nothing needed re-running. No checks
were skipped.
