---
criteria:  CRITERIA.md
closes:    AC-29, AC-30
advances:
after:     13-sitzungs-token, 09-uploads-ueber-route-handler
status:    ready
attempts:  0
---

## Build
A session ends after 24 hours without use and at the latest 30 days after
login, where only what the user does counts as use; the account page gets
„Überall abmelden", which ends all other sessions of the user.

## Done when
> **AC-29** Eine Sitzung endet frühestens 24 Stunden und spätestens 24 Stunden und 5 Minuten nach der letzten Nutzung, spätestens aber 30 Tage nach der Anmeldung. Nutzung ist, was der Nutzer selbst tut: eine Seite laden oder neu laden und jede Aktion, auch ein Upload; ein Link-Klick innerhalb der App, die Live-Verbindung und das automatische Neuladen nach Änderungen zählen nicht.

> **AC-30** Die Kontoseite bietet „Überall abmelden" mit der Rückfrage „Alle anderen Sitzungen beenden?". Danach sind alle anderen Sitzungen des Nutzers beendet, die eigene bleibt, und die Seite zeigt „Alle anderen Sitzungen wurden beendet.".

## Nudges
> `last_seen_at` höchstens alle 5 Minuten schreiben.

## Context
- **Today** (after `13-sitzungs-token`): `sessions` has `token_hash`,
  `user_id`, `created_at`, `expires_at`; `createSession`
  (`src/server/auth/login.ts`) sets `expires_at = now + SESSION_TTL_MS`
  (30 days) - that already is the 30-day limit. `findUserBySessionToken`
  (`src/server/auth/sessions.ts`) checks `expires_at > now`;
  `deleteExpiredSessions` purges on each login. `getCurrentUser` /
  `requireUser` / `requireAdmin` in `src/server/auth/current-user.ts` are the
  one place every page, server action and session-checked route handler
  resolves the session; `currentSessionToken()` and `sessionCookieName()`
  come from ticket 13.
- **Who calls `getCurrentUser`, and which of it is use:**
  - Page renders. A page opened or reloaded by hand is a top-level document
    request: the browser sends `Sec-Fetch-Mode: navigate`. The automatic
    reload after a change is `router.refresh()` in `SituationWorkspace`
    (`src/map/SituationWorkspace.tsx`, called from `useOperationEvents`),
    an RSC fetch (`rsc: 1`, `Sec-Fetch-Mode: cors`). Next 16.3 sends no
    header that tells a refresh from a client-side `<Link>` navigation
    (`node_modules/next/dist/esm/client/components/app-router-headers.js`).
  - Server actions: POST with the `next-action` header. Every action counts.
  - The SSE route `src/app/operations/[id]/events/route.ts` (`requireUser`):
    EventSource sends `Accept: text/event-stream`, `Sec-Fetch-Mode: cors`.
    Must not count.
  - The image overlay route `src/app/operations/[id]/overlays/[overlayId]/route.ts`:
    an `<img>` load, `Sec-Fetch-Mode: no-cors`. Not counted.
- **Decided here:** a request counts as use when it carries `next-action`
  or `Sec-Fetch-Mode: navigate`, judged from `headers()` inside
  `getCurrentUser`. Consequence: an in-app `<Link>` navigation (RSC fetch)
  does not count on its own - see the question in the report. Browsers
  without `Sec-Fetch-Mode` (Safari before 16.4) only count actions.
  - The upload route handlers from `09-uploads-ueber-route-handler`:
    `POST /operations/[id]/kml` (`src/app/operations/[id]/kml/route.ts`),
    `POST /operations/[id]/overlays` (`src/app/operations/[id]/overlays/route.ts`)
    and `PUT /operations/[id]/overlays/[overlayId]`. They check the session
    with `getCurrentUser()` before reading the body and answer 401 without
    one. They are sent by `fetch` (no `next-action`, `Sec-Fetch-Mode: cors`),
    but each is an action of the user by AC-29 and must count.
- **Decided here:** `getCurrentUser(options?: { use?: boolean })`. Without
  the option, use is judged from the headers (below); with `{ use: true }`
  it is always recorded. The three upload routes pass `{ use: true }`. The
  other route handlers (events, the overlay image `GET`) keep calling it
  without the option and are never use, since their requests carry neither
  `next-action` nor `Sec-Fetch-Mode: navigate`.
- **Writing:** `last_seen_at` is written at most every 5 minutes, as a
  conditional `UPDATE … WHERE token_hash = $1 AND last_seen_at <= $now - 5 min`
  (no read-then-write). So `last_seen_at` can be up to 5 minutes older than
  the real last use. Decided here: the idle check allows for that lag -
  a session is valid while `last_seen_at > now - (24 h + 5 min)` - so it
  never ends *before* 24 hours without use, at most 5 minutes after. The
  check sits in the same query as `expires_at > now`.
- **Ruled out in CRITERIA.md** (don't build): "Feste Sitzungsdauer von 24 h",
  "Nur „Überall abmelden" ohne Leerlauf-Timeout", "Jede Anfrage zählt als
  Nutzung, auch automatisches Neuladen", "Nur Anfragen eines sichtbaren Tabs
  zählen", "„Überall abmelden" beendet auch die eigene Sitzung".
- **Account page** `src/app/account/page.tsx` (server component): back link,
  „Abmelden" form, `ChangePasswordForm`. `ConfirmationModal`
  (`src/app/ConfirmationModal.tsx`) takes `onConfirm: () =>
  Promise<ActionResult>` and closes on success; use it for the question.
  `changePasswordAction` already shows how a success text is rendered
  (`ChangePasswordForm`, green `Alert`).
- Don't add to `src/app/auth-enforcement.test.ts` (394 lines) except one
  table row for the new action, which belongs there by its design.

## Plan
1. **AC-29 test first, red.** New `src/app/session-lifetime.test.ts`,
   harness like `auth-enforcement.test.ts` (real `freshDb()`, mocked
   `next/headers` whose `headers()` returns per-test request headers and
   whose cookie holds the session token, `redirect` throwing), time via
   `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime`; back-date
   `last_seen_at`/`expires_at` with SQL. Where the user acts:
   `AccountPage()` (`src/app/account/page.tsx`) as page load and
   `createOperationAction` as action.
   - last use 23 h 59 min ago, page load with `sec-fetch-mode: navigate` →
     renders; 23 h 59 min later still renders (use was recorded).
   - last use 24 h 5 min + 1 s ago → page load redirects to `/login`; so does
     an action.
   - created 30 days ago, used a minute ago → redirects.
   - an RSC refresh (`rsc: 1`, `sec-fetch-mode: cors`) of the page 23 h after
     the last use renders, but does not extend: 2 h later a page load
     redirects.
   - a GET of `src/app/operations/[id]/events/route.ts` does not extend
     (cancel the stream body after the response).
   - an action counts: `createOperationAction` at 23 h extends.
   - an upload counts: a `POST` of a small KML file to
     `src/app/operations/[id]/kml/route.ts` (`sec-fetch-mode: cors`, no
     `next-action`) at 23 h extends; 2 h later a page load still renders.
   Proof: `npx vitest run src/app/session-lifetime.test.ts` red on the
   assertions (idle session still valid).
2. **Column.** New migration `NNN_session_last_seen.sql` (next free number):
   `ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL
   DEFAULT now();`. `insertSession` sets it to the creation time
   (`createSession`'s `now`). Proof: `src/server/auth/sessions.test.ts` green.
3. **Idle check and purge.** `src/server/auth/sessions.ts`:
   `SESSION_IDLE_MS = 24 h` and the 5-minute `SESSION_USE_WRITE_INTERVAL_MS`
   (next to `SESSION_TTL_MS` in `login.ts`, or move all three here);
   `findUserBySessionToken` also requires `last_seen_at > now -
   (SESSION_IDLE_MS + SESSION_USE_WRITE_INTERVAL_MS)`;
   `deleteExpiredSessions` also deletes idle sessions. Proof: new cases in
   `sessions.test.ts` (one second past the bound → null; one second short →
   user; purge removes idle rows).
4. **Recording use.** `sessions.ts`: `recordSessionUse(db, token, now)` with
   the conditional `UPDATE` (5-minute rule). `current-user.ts`:
   `getCurrentUser(options?: { use?: boolean })` resolves the user, then, if
   `options?.use` or the request is use (`isUserActivity(headers)` -
   `next-action` present or `sec-fetch-mode === "navigate"`), calls
   `recordSessionUse`. The three upload routes of ticket 09
   (`src/app/operations/[id]/kml/route.ts`,
   `src/app/operations/[id]/overlays/route.ts`, the `PUT` in
   `src/app/operations/[id]/overlays/[overlayId]/route.ts`) call
   `getCurrentUser({ use: true })`. Proof: `sessions.test.ts`: two uses
   2 min apart write once (the column keeps the first value), 6 min apart
   write twice; the AC-29 tests of step 1 green, including the upload case.
5. **AC-30 tests, red.** New `src/app/account/LogoutOtherSessions.test.tsx`:
   „Überall abmelden" opens a dialog „Alle anderen Sitzungen beenden?";
   confirming calls the action and then the page shows „Alle anderen
   Sitzungen wurden beendet."; „Abbrechen" calls nothing. New
   `src/app/account/actions.test.ts` (tickets 11 and 12 also create it; if
   either is built already, extend the existing file and merge its mocks
   rather than replacing them) (DB, mocked cookie): user with three
   sessions plus another user's session → `logoutOtherSessionsAction()`
   leaves exactly the caller's own session and the other user's. Proof: red.
6. **Build it.** `sessions.ts`: `deleteOtherSessionsOfUser(db, userId,
   keepToken)`. `src/app/account/actions.ts`: `logoutOtherSessionsAction():
   Promise<ActionResult>` (`requireUser`, `currentSessionToken()`). New
   client component `src/app/account/LogoutOtherSessions.tsx`: button
   „Überall abmelden", `ConfirmationModal` with title „Alle anderen Sitzungen
   beenden?", confirm label e.g. „Sitzungen beenden", success `Alert`
   „Alle anderen Sitzungen wurden beendet.". `page.tsx` renders it below
   the password form. Add the action to the `requireUser` table in
   `auth-enforcement.test.ts`. Proof: step 5 tests green.
7. **Real browser.** `run-einsatz`: log in, open `/account`, „Überall
   abmelden" → confirm → text shows; reload the page still logged in.
   Proof: screenshot.
8. `npm run check` green.

## Not here
- Hashing tokens, cookie name, ending the previous session at login:
  `13-sitzungs-token`.
- Closing open Live-Verbindungen of an ended or idle session within 30 s:
  `15-live-verbindungen-begrenzen` (it re-checks the session without
  recording use - keep `findUserBySessionToken` free of the write so it
  can).
- Describing session lifetime in the Datenschutzerklärung:
  `20-datenschutzerklaerung`.
- Out of scope: "Konten sperren." and "Ablaufdatum für Links und eine
  Anzeige, wann ein Link zuletzt benutzt wurde."

## Left standing
