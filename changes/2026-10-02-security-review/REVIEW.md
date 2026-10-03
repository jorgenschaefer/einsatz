# Review: Sicherheitsreview umsetzen

The whole change (`git diff 25787c2`) was reviewed twice by `critique`, each time
in a fresh context against CRITERIA.md. Fixed findings are in the commits after
34f16b0. This file lists only what was left standing.

## Fixed (for orientation)

- Round 1: the two capped stream readers are now one (`readBody`). The 20 MB
  messages and the upload request limit come from the constants the checks
  use. `kmz.ts` now reads every `<href>` the same way: KMZ assets, icons and
  NetworkLinks, with entities and CDATA resolved. Bild-Overlay names are held
  to 200 characters. The unread bodies of redirects and failed responses are
  cancelled.
- Round 2, bug: icon embedding could grow a small KML to hundreds of MB,
  because an icon is written into every style that names it. Embedding now
  stops once the icons would add more than 20 MB.
- Round 2, bug: the login limit kept every username in its key verbatim,
  before bcrypt runs, so anonymous clients could fill memory. The key now
  holds a SHA-256 of the username.
- Round 2, nits: an upload's file name that is too long is now reported as
  "Der Dateiname …", and a KML file's name is checked before anything is
  fetched. There is now one `isUniqueViolation`. The KML size message sits
  next to `MAX_KML_BYTES`, and `formFileText` sits beside the other form
  readers.

## Findings left standing

- **The KML URL import fetches before the Einsatz-ID, the name and the
  Einsatz itself are checked** (`kml-actions.ts` `addKmlUrlAction` →
  `createKmlOverlay`). A refused call still fetches the URL, its NetworkLinks
  and its icons. For an Einsatz deleted in the meantime, the import ends in a
  logged 500 "KML konnte nicht geladen werden." instead of a message. File
  imports now check the name first, but not the ID.
  - Left because only signed-in users can trigger it, and a valid ID causes
    the same fetching. The 500 on a deleted Einsatz also happens for
    Kartenzeichen and Bereiche. Only the image uploads check first, because
    they write files.
  - Moving the ID check ahead of the fetch would change about 50 call sites
    in the KML tests that use the ID `"op-1"` with a mocked `kml-overlays`.
- **Redirect hops do not count against the 20-address KML budget.**
  - Ticket 21 decided to read AC-6 literally: the addresses are the ones the
    KML names. Each address follows at most 5 redirects, so one import can
    make up to about 120 requests. I tried the change, saw it break the
    pinned test `counts a NetworkLink reached through 3 redirects as one
    address`, and reverted it. Only the body cancellation from that finding
    was kept.
- **The 20 MB cap on icon growth means a stored KML-Ebene can reach about
  40 MB** (a 20 MB file plus 20 MB of embedded icons).
  - A hard cap of 20 MB on the stored result would break the pinned test `is
    embedded in a file of just under 20 MB` (AC-9: files that work today keep
    working). Before the fix, the size had no limit at all.
- **The length limits are separate constants per field**: 200 in
  `account-admin.ts`, `create-operation.ts`, `journal.ts`, `areas.ts`,
  `view-links.ts`, `strength-input.ts` and `validation.ts`; 2,000 in
  `create-operation.ts`, `strength-input.ts` and `kml-actions.ts`.
  - The geocode limit counts code points, while `assertText` counts UTF-16
    units.
  - Left because AC-22 sets a limit per kind of field. Those limits happen to
    match, and one shared constant would tie unrelated fields together.
- **Four copies of a two-line `assertFound`**, each with its own "not found"
  message (`areas.ts`, `image-overlays.ts`, `kml-overlays.ts`,
  `map-symbols.ts`). Left as a nit: shared code would save almost nothing.
- **The live-connection limits and the 429 code are repeated in the three
  events routes.** The device and view routes are nearly identical. Left
  because each route is about 30 lines and reads on its own.
- **Some input checks sit in the action rather than the domain module**: the
  KML URL length (`kml-actions.ts`) and `assertBoolean(admin)`
  (`admin/users/actions.ts`).
  - Moving the URL check into `createKmlOverlay` would run it only after the
    fetch. Left as is.

## Checks

- `npm run check` (tsc, Biome, Vitest) passes after the last commit: 229 test
  files, 2,750 tests. The test Postgres container was running, so the DB
  tests ran.
- Neither review round nor I started the app in a browser. The following are
  judged from code and component tests only:
  - the new screens: „Überall abmelden", the „Abschließen" confirmation,
    „Gerätelink entfernen" and the new-Einsatz form;
  - the "Dateiname" message in the upload dialogs.
- The change to the NetworkLink href (`&amp;` is now resolved) was not tried
  against a real Google „Meine Karten" export. It is covered only by
  `kmz.test.ts`.
- The fixes from round 2 were not reviewed a third time, because the run
  allows two rounds.
