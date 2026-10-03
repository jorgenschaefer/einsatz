---
criteria:  CRITERIA.md
closes:
advances:  AC-22
after:     06-einsatz-loeschen-nur-admin, 07-links-entfernen-und-beim-abschliessen-loeschen, 11-login-limit, 12-passwoerter-und-erst-admin, 13-sitzungs-token, 14-sitzungs-laufzeit, 16-token-ansichten, 23-kartenobjekte-eingaben
status:    done
attempts:  1
---

## Build
The server actions for Einsatz anlegen, Abschließen, Wieder öffnen and
Löschen, Nutzerverwaltung, Konto, Login and Kartensuche check their inputs -
types, UUID ids and lengths - and reject bad ones with a message instead of
a server error, storing nothing. Abschließen, Wieder öffnen and Löschen
answer with an `ActionResult`, so the rejection reaches the user.

## Done when
Toward AC-22, this slice makes it true for the actions in
`src/app/operations/actions.ts`, `src/app/operations/lifecycle-actions.ts`,
`src/app/admin/users/actions.ts`, `src/app/account/actions.ts`,
`src/app/login/actions.ts` and `src/app/operations/[id]/geocode-actions.ts`:
each rejects ids that are not a UUID, arguments of the wrong type (a form
action called without a `FormData`, a non-string Nutzername or password, a
non-boolean admin flag, an unknown role, a non-string search query) and an
Einsatz-Bezeichnung or Nutzername over 200 or an Einsatzbeschreibung over
2,000 characters, with a message - the Kartensuche with no hits and without
asking Photon - and then stores nothing.

## Toward
> **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **Helpers from ticket 23** in `src/server/validation.ts`: `assertUuid`
  ("Ungültige ID."), `assertText(value, field, max)` ("<field> muss Text
  sein." / "<field> darf höchstens <max> Zeichen lang sein.", `max` with
  German digit grouping), `assertBoolean`, `assertObject`,
  `assertHexColor`. Use them; add a helper only for a check none of them
  makes.
- **The actions as the earlier tickets leave them.** Build against the code
  as it is when this runs; these tickets reshape the same functions:
  - 06: `deleteOperationAction` is admin-only and returns
    `Promise<ActionResult>` (redirect on success); `deleteOperationRow`
    deletes only a closed Einsatz.
  - 07: "Abschließen" goes through a `ConfirmationModal`;
    `closeOperationAction` returns either `void` (the modal wraps it) or an
    `ActionResult` - 07 left the choice to its builder.
  - 11: `loginAction` and `changePasswordAction` go through the limiter.
  - 12: `assertPasswordPolicy(password, username)` in
    `src/server/auth/password.ts` (uses `Buffer.byteLength`, so a non-string
    throws), called by `createAccount` and `resetPassword` (which looks the
    user up by `id`); `createAccount` relies on the unique index on
    `lower(username)`.
  - 13, 14: session changes in `src/app/login/actions.ts` and
    `src/app/account/actions.ts`; 14 adds `logoutOtherSessionsAction()` (no
    input).
  - 16: `geocodeQuery` (`src/server/geocoder/geocode-service.ts`) returns
    `[]` for a query over `MAX_GEOCODE_QUERY_LENGTH` (200) before the gate.
- **Gaps that end in a server error today:**
  - Einsatz anlegen (`createOperationAction` → `createOperation` in
    `src/server/operations/create-operation.ts`): `name` and `description`
    come from `FormData` through `String(…)`, so always strings; no limits.
    A second argument that is not a `FormData` throws on `formData.get`.
  - Lifecycle (`lifecycle-actions.ts`): a non-UUID `operationId` makes
    `lockOperation` / `deleteOperationRow` throw. `reopenOperationAction`
    (and `closeOperationAction` unless 07 changed it) returns `void`. The
    Einsätze page (`src/app/operations/page.tsx`) passes them to
    `OperationsOverview` → `OperationLifecycleActions`
    (`onClose`/`onReopen: () => void | Promise<void>`).
  - Nutzerverwaltung (`src/app/admin/users/actions.ts`, `guarded` →
    `src/server/auth/account-admin.ts`): `createAccount` trims `username`
    unchecked and has no limit, the password policy gets `password`
    unchecked, `admin` is used as a truthy value, `setRole` passes any `role`
    to the DB, ids are unchecked.
  - Konto and Login (`changePasswordAction`, `loginAction`): read a
    `FormData`; a non-`FormData` argument throws.
  - Kartensuche (`geocodeAddressAction` → `geocodeQuery`): `query.trim()`
    throws on a non-string. The action returns `GeoHit[]`, not an
    `ActionResult`, so "rejected" here means an empty result without asking
    Photon.
- **Lengths in AC-22 mapped to fields:** Einsatz-Bezeichnung (name) 200,
  Einsatzbeschreibung 2,000, Nutzername 200. Passwords are bounded by
  ticket 12 (72 bytes). Checked after trimming, on what would be stored.
- **The auth guard comes first.** `src/app/auth-enforcement.test.ts` calls
  every action with placeholder ids and an empty `FormData` and expects the
  login redirect (or the admin refusal). Every new check runs after
  `requireUser()` / `requireAdmin()` - except in `loginAction`, which has no
  guard.
- **Test patterns.** `auth-enforcement.test.ts` builds a real session and
  fakes `next/headers`, `next/navigation`, `next/cache` and `getDb` - reuse
  that harness shape. Tickets 11-14 create `src/app/login/actions.test.ts`
  and `src/app/account/actions.test.ts`; `account-admin.test.ts` (247 lines)
  and `auth-enforcement.test.ts` (394) get no new tests. New tests go in new
  files.

## Plan
1. **Red: these actions reject bad input.** New action-level tests, real DB,
   logged in as an admin through a real session, each bad call expecting the
   rejection and an unchanged database (compare `listOperations`, the users
   and sessions of the test, before and after):
   - `src/app/operations/actions.validation.test.ts`: `createOperationAction`
     with a string instead of a `FormData`, a name of 201 (200 accepted), a
     description of 2,001 (2,000 accepted); `closeOperationAction`,
     `reopenOperationAction`, `deleteOperationAction` with `"op-1"` →
     `{ error: "Ungültige ID." }`.
   - `src/app/admin/users/actions.validation.test.ts`: `createAccountAction`
     with a number as username or password, a Nutzername of 201 (200
     accepted), `admin: "yes"`; `setRoleAction` with `"superadmin"`;
     `setRoleAction`, `resetPasswordAction`, `deleteAccountAction` with a
     non-UUID id; `resetPasswordAction` with a number as password.
   - `src/app/account/actions.validation.test.ts` and
     `src/app/login/actions.validation.test.ts`: `changePasswordAction` and
     `loginAction` with a string instead of a `FormData` → the error state,
     the limiter's count unchanged.
   - `src/app/operations/[id]/geocode-actions.test.ts` (new): a number as
     query → `[]`, a geocoder that records calls shows Photon not asked.
   *Proof:* red - each of these ends in a thrown error today.
2. **Green: Einsatz anlegen.** `createOperation` rejects a name over 200
   ("Die Bezeichnung") and a description over 2,000 ("Die Beschreibung"),
   checked after trimming; `createOperationAction` returns
   `{ error: "Ungültige Formulardaten." }` when its argument is not a
   `FormData`. Unit tests in `src/server/operations/create-operation.test.ts`
   (49 lines).
   *Proof:* the matching rows of step 1 green.
3. **Green: Abschließen, Wieder öffnen, Löschen.** The three lifecycle
   actions check `operationId` with `assertUuid` and return
   `{ error: "Ungültige ID." }`; each returns `Promise<ActionResult>`
   (`deleteOperationAction` still redirects on success). The
   `onClose`/`onReopen` props of `OperationLifecycleActions` and
   `OperationsOverview` become `() => Promise<ActionResult>`; Abschließen
   hands its result to 07's `ConfirmationModal`, which already shows an
   `{ error }`. "Wieder öffnen" is a plain menu item with no error display
   today; it gets none here - the page only ever passes a real id, so the
   rejection is for forged calls, and the action's answer is what AC-22
   asks for.
   *Proof:* the lifecycle rows of step 1 green; a new case in
   `OperationLifecycleActions.test.tsx` that an `{ error }` from `onClose`
   is shown in the dialog; `OperationsOverview.test.tsx` green.
4. **Green: Nutzerverwaltung.** In `src/server/auth/account-admin.ts`:
   `createAccount` checks `username` (`assertText`, at most 200 after
   trimming, "Der Nutzername") and `password` ("Das Passwort" muss Text sein)
   before the policy; `setRole` rejects any role but `"admin"` and `"user"`
   ("Unbekannte Rolle."); `setRole`, `resetPassword`, `deleteAccount` check
   `id` with `assertUuid` before any query; `resetPassword` checks
   `password` is a string before ticket 12's policy runs.
   `createAccountAction` rejects a non-boolean `admin` (`assertBoolean`)
   inside `guarded` before mapping it to a role. Unit tests in a new
   `src/server/auth/account-admin.input.test.ts`.
   *Proof:* the Nutzerverwaltung rows of step 1 green.
5. **Green: Konto, Login.** `changePasswordAction` and `loginAction` return
   `{ error: "Ungültige Formulardaten." }` for a non-`FormData` argument,
   before the rate limiter and before any database access.
   *Proof:* their rows of step 1 green.
6. **Green: Kartensuche.** `geocodeQuery` returns `[]` for a non-string
   query before the length check and the `RateGate`. Unit test in
   `src/server/geocoder/geocode-service.test.ts` (that the gate is not used
   up: a normal query right after it reaches the geocoder).
   *Proof:* the geocode row of step 1 green.
7. **In the browser** (skill `run-einsatz`): create an Einsatz; close,
   reopen and delete one as admin; create a user, change a role, reset a
   password, change your own password; log out and in; search an address.
   All work as before. Create an Einsatz with a 201-character Bezeichnung →
   the length message, nothing created.
   *Proof:* observations under `## Left standing`.
8. `npm run check` green.

Decided here (show at approval): "Ungültige Formulardaten." for a form
action called without a `FormData`; a malformed geocode query yields no hits
rather than a message, because the action has no error channel; the
lifecycle actions all return an `ActionResult`, and "Wieder öffnen" does not
display a rejection; "Unbekannte Rolle." for a
role other than admin and user.

## Not here
- The helpers themselves and the Lagekarte actions: ticket
  `23-kartenobjekte-eingaben`. ETB and Stärke: ticket
  `24-etb-und-staerke-eingaben`. The test that walks every server action:
  ticket `18-eingaben-pruefen`.
- Password rules (10,000 common passwords, `change-me-please`, equal to the
  Nutzername, over 72 bytes) and the case-insensitive Nutzername: ticket
  `12-passwoerter-und-erst-admin`. This ticket only checks that a password
  is a string.
- Search queries over 200 characters and the separate rate limit for token
  routes: ticket `16-token-ansichten`.
- Who may delete an Einsatz and when: ticket `06-einsatz-loeschen-nur-admin`.
- From `CRITERIA.md`'s Out of scope:
  - "Konten sperren." - rejecting bad input to the Nutzerverwaltung does
    not add a lock.
  - "Ein Login-Limit je Nutzername über alle IPs hinweg, CAPTCHA." -
    `loginAction` only gains a type check.

## Left standing
- **Step 7, in the browser:** the two reviewers checked this, not me, at
  390×844 and 1280×800. An Einsatz was created, closed, reopened and
  deleted. Accounts were created, roles changed, a password reset and an
  account deleted. Login, logout and the Kartensuche worked as before. A
  201-character Bezeichnung showed "Die Bezeichnung darf höchstens 200
  Zeichen lang sein." in the dialog and created nothing. A 201-character
  Nutzername was refused and a 200-character one was created. The
  "Ungültige ID." answer inside the Abschließen dialog was not triggered
  in the app, because the page only passes real ids.
  `OperationLifecycleActions.test.tsx` covers it.
- **Beyond the plan, found in review:**
  - A form field sent as a file reached the actions as the text
    "[object File]". The second reviewer created an Einsatz with that name,
    and the same path could set a password to it. The plan assumed `FormData`
    fields are always strings. Einsatz anlegen, Konto and Login now read
    their fields through `formText` in `validation.ts`, which refuses a file
    with "<Feld> muss Text sein." The Konto fields are called "Das aktuelle
    Passwort" and "Das neue Passwort". This fix came after the second and
    final review round, so no reviewer has looked at it. The action tests
    and `validation.test.ts` pin it.
  - "Neuer Einsatz" emptied both fields after a refusal, so a refused
    2,001-character Beschreibung was lost. The fields now keep their text.
- **Departures from the plan:**
  - The Einsatz-ID of Abschließen, Wieder öffnen and Löschen is checked
    with `assertUuid` in `closeOperation`, `reopenOperation` and
    `deleteOperation`, not in the actions. Tickets 23 and 24 put their
    checks in the domain functions in the same way. The check also keeps a
    malformed id away from `deleteOperationUploads`, which builds a path
    from it.
  - Abschließen and Wieder öffnen now go through `operationAction` and also
    refresh `/operations`. They used to have their own copy of that code.
    A new test in `lifecycle-actions.test.ts` pins the refresh.
  - `signIn` in `src/test/sign-in.ts` now takes an optional role.
- **Review nit, not fixed:** `createAccount`, `setRole`, `resetPassword` and
  `createOperation` still declare `string` / `Role` parameters, even though
  they now check for other types. This matches the domain functions of
  tickets 23 and 24, where only the check helpers take `unknown`.
  `geocodeQuery` takes `unknown` because its non-text answer is "no hits",
  not an error.
- **Tests that passed without a red run:** the tests that accept the longest
  values (200 / 2,000 characters) and the Kartensuche happy path. They guard
  against limits that are too tight. The tests that the login check comes
  before the `FormData` check passed at first. I moved the `FormData` check
  above the login check, they turned red, and I put it back.
- **Seen in review, not this ticket's:** `/account` logs a hydration
  mismatch caused by a `caret-color` style on Mantine's password field.

