---
criteria:  CRITERIA.md
closes:    AC-22
advances:
after:     06-einsatz-loeschen-nur-admin, 07-links-entfernen-und-beim-abschliessen-loeschen, 09-uploads-ueber-route-handler, 11-login-limit, 12-passwoerter-und-erst-admin, 14-sitzungs-laufzeit, 17-kartenobjekte-pruefen, 23-kartenobjekte-eingaben, 24-etb-und-staerke-eingaben, 25-einsatz-und-konten-eingaben
status:    ready
attempts:  0
---

## Build
A test walks every exported server action, calls it with bad input for each
of its parameters and checks that it answers with a message and stores
nothing; it fails for an action it does not cover. Whatever gap it finds is
closed here.

## Done when
> **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **What the earlier tickets did.** Each area's actions check their input,
  with their own tests:
  - 09: the KML-Ebene's name (type, 200 characters, in `createKmlOverlay`)
    for file and URL import.
  - 23: the Lagekarte actions (`src/app/operations/[id]/actions.ts`,
    `map-symbol-actions.ts`, `area-actions.ts`, `kml-actions.ts`,
    `image-overlay-actions.ts`, `view-link-actions.ts`), proof in
    `src/app/operations/[id]/map-actions.validation.test.ts`; and the helpers
    in `src/server/validation.ts`: `assertUuid` ("Ungültige ID."),
    `assertText(value, field, max)`, `assertBoolean`, `assertObject`,
    `assertHexColor`.
  - 24: ETB and Stärke (`journal-actions.ts`, `strength-actions.ts`).
  - 25: Einsatz anlegen, lifecycle, Nutzerverwaltung, Konto, Login,
    Kartensuche. Form actions answer a non-`FormData` argument with
    "Ungültige Formulardaten."; `geocodeAddressAction` answers bad input with
    `[]` without asking Photon.
  Each of those tests compares a few `list…` results; none proves that no
  table at all changed, and none notices a new action.
- **The server actions** are the non-test modules under `src/` whose first
  statement is `"use server"`. Today: `src/app/operations/actions.ts`,
  `src/app/operations/lifecycle-actions.ts`,
  `src/app/operations/[id]/{actions,map-symbol-actions,area-actions,kml-actions,image-overlay-actions,view-link-actions,journal-actions,strength-actions,geocode-actions}.ts`,
  `src/app/admin/users/actions.ts`, `src/app/account/actions.ts`,
  `src/app/login/actions.ts`. Ticket 09 turned the upload actions into route
  handlers; 07 added `removeDeviceLinkAction`; 14 added
  `logoutOtherSessionsAction`. Build against the set as it is when this runs.
- **Rejections by return type:** `{ error: string }` for `ActionResult`
  actions, a state with `error` for the `FormData` actions, `[]` for
  `geocodeAddressAction`.
- **The auth guard comes first.** `src/app/auth-enforcement.test.ts` calls
  every action with placeholder ids and an empty `FormData` and expects the
  login redirect (or the admin refusal). Nothing here changes that order.
- **Test patterns.** `auth-enforcement.test.ts` builds a real session and
  fakes `next/headers`, `next/navigation`, `next/cache` and `getDb` - reuse
  that harness shape. `auth-enforcement.test.ts` (394 lines) gets no new
  tests.

## Plan
1. **Red: every server action, walked.** New
   `src/app/server-actions.validation.test.ts`, real DB, logged in as an
   admin through a real session.
   - **Completeness.** Find every non-test module under `src/` whose first
     statement is `"use server"` (`fs` plus a dynamic `import()`), import it,
     and assert that every exported function has an entry in the table below
     and that the table names no function that does not exist.
   - **The table.** One entry per action. Every id parameter gets a non-UUID
     call; every other parameter a wrong-type call (`null`, a number for a
     string, a string for an object or a `FormData`); every bounded string
     its over-length call (200, 2,000, 10,000 as AC-22 maps them); the
     Bereich actions an unknown shape and a bad colour. Each call expects the
     rejection for its return type. Actions without input (`logoutAction`,
     `logoutOtherSessionsAction`) are listed as "takes no input".
   - **Stores nothing.** New helper `src/test/db-snapshot.ts`: reads every
     table of the public schema except `schema_migrations`, ordered, as
     plain rows. The test compares the snapshot before and after each bad
     call; it must be equal. The upload directory is compared too (no new
     file).
   *Proof:* run it. Rows that fail are the gaps 23-25 left; record them. The
   completeness check passes from the start, so make it fail once by
   removing an entry and record that it did.
2. **Green: the residual gaps.** Close each failing row of step 1 in the
   domain function or action it belongs to, with the helpers from
   `src/server/validation.ts` and a unit test next to that function. No
   second variant of a helper.
   *Proof:* step 1 green.
3. `npm run check` green.

Decided here (show at approval): the database snapshot compares every table
of the public schema, so an action that writes anywhere on bad input fails;
the completeness check reads the source tree for `"use server"` rather than
keeping a hand-written list of modules.

## Not here
- The input checks of each area and the helpers: tickets
  `23-kartenobjekte-eingaben`, `24-etb-und-staerke-eingaben` and
  `25-einsatz-und-konten-eingaben`. This ticket adds a check only where its
  test finds one missing.
- The Einsatz check on Kartenobjekte (AC-23): ticket
  `17-kartenobjekte-pruefen`.
- Route handlers (uploads, Standortmeldung, events, overlays, geocode for
  tokens) are not server actions; their body limits are tickets
  `09-uploads-ueber-route-handler` and `22-standortmeldung-begrenzen`.
- Password rules and the case-insensitive Nutzername: ticket
  `12-passwoerter-und-erst-admin`.

## Left standing
