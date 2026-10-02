---
criteria:  CRITERIA.md
closes:    AC-17, AC-18
advances:
after:     07-links-entfernen-und-beim-abschliessen-loeschen, 14-sitzungs-laufzeit
status:    ready
attempts:  0
---

## Build
Live-Verbindungen (the SSE streams of Lageansicht, Ansichtslink and
Gerätelink) are capped per user, per Gerätelink and per Ansichtslink, end
within 30 seconds once their access is gone, and end after at most one
hour; a refused or closed client shows „Verbindung getrennt" and keeps
reconnecting.

## Done when
> **AC-17** Je Nutzer und je Gerätelink bestehen höchstens 10 Live-Verbindungen gleichzeitig, je Ansichtslink höchstens 50; weitere werden abgelehnt. Ein abgelehnter Browser zeigt „Verbindung getrennt" und versucht es weiter.

> **AC-18** Nach Abmelden, Ablauf oder Ende der Sitzung, Löschen des Nutzers, Löschen eines Ansichtslinks, Entfernen oder Neugenerieren eines Gerätelinks und Abschließen oder Löschen des Einsatzes endet jede betroffene Live-Verbindung innerhalb von 30 Sekunden.

## Nudges
> Ein geöffneter Live-Stream schließt nach höchstens 1 Stunde; EventSource verbindet neu.

## Context
- **The three SSE routes** check access once, at open, and then stream
  forever:
  - `src/app/operations/[id]/events/route.ts`: `requireUser()`, then
    `subscribeOperation(id, …)` - it does not check the Einsatz exists.
  - `src/app/device/[token]/events/route.ts`: `resolveDeviceAccess(db,
    token)` (`src/server/mapsymbols/map-symbols.ts`; token matches a
    Kartenzeichen of an *active* Einsatz), 403 otherwise.
  - `src/app/view/[token]/events/route.ts`: `resolveViewAccess`
    (`src/server/viewlinks/view-links.ts`), same shape.
  All three build the response with `operationEventStream(subscribe)` in
  `src/server/events/sse.ts`: preamble, subscribe to the bus, a heartbeat
  `: ping` every `HEARTBEAT_MS = 25_000`, idempotent `cleanup` on cancel or
  failed enqueue. Tests: `src/server/events/sse.test.ts`.
- **What ends access, by AC-18 trigger** (state after the tickets this one
  comes after):
  - Abmelden, Ablauf, Ende der Sitzung (`logoutAction`, idle/30-day expiry
    from 14, „Überall abmelden" from 14, password change), Löschen des
    Nutzers (`ON DELETE CASCADE` on `sessions`): the session token no longer
    resolves through `findUserBySessionToken` (`src/server/auth/sessions.ts`).
    Re-check with that function directly, never through `getCurrentUser`,
    which records use (14) - a Live-Verbindung must not keep a session
    alive (AC-29).
  - Löschen des Einsatzes: affects all three kinds; the operation row is
    gone (`getOperation` in `src/server/operations/operations.ts`).
  - Abschließen: since 07 it deletes all Gerätelinks and Ansichtslinks, so
    device and view access no longer resolve; the logged-in Lageansicht
    stream of a closed Einsatz is *not* affected (a closed Einsatz stays
    editable).
  - Löschen eines Ansichtslinks, Entfernen (07) or Neugenerieren of a
    Gerätelink: the token no longer resolves.
  So the re-check is: the same access lookup as at open, still giving the
  same operation id (and for the Lageansicht, the same user and the
  Einsatz still existing).
- **Closing a stream:** when the server ends the response normally,
  EventSource reconnects by itself. When a (re)connect gets a non-200
  answer (403, 429, the 307 to `/login`), EventSource gives up for good
  (`readyState === CLOSED`) - `useOperationEvents` (`src/map/useOperationEvents.ts`)
  today then stays disconnected forever. AC-17 needs it to keep trying.
  „Verbindung getrennt" is already shown whenever `connected` is false:
  `LageansichtShell` (indicator, label „Verbindung getrennt – wird
  automatisch wiederhergestellt") and `ReadOnlySituationMap` (badge).
- **Device view after revocation:** 07 publishes on removal/closing, the
  device page re-renders as `DeviceClosed` and unmounts the hook - the
  reconnect loop stops there by itself.
- **Counting:** the event bus is in-process and pinned on `globalThis`
  (`src/server/events/operation-events.ts`, one container); counters for
  open Live-Verbindungen live the same way. Keys: user id (limit 10),
  Gerätelink token (10), Ansichtslink token (50). Refused with **429**.
- **Ruled out in CRITERIA.md:** "10 Live-Verbindungen auch je Ansichtslink"
  and "Nur eine globale Grenze für Live-Verbindungen" - the limits are per
  key, as above.
- Coalescing of `publishOperationChanged` (ticket 10) is independent of this
  ticket and may be built before or after it. No test here should count
  `data: changed` chunks; if one has to, publish once to an idle Einsatz
  (delivered at once under 10's rule as well). Both tickets touch
  `src/server/events/sse.ts` and `sse.test.ts` (10 only adds a test there);
  whichever is built second merges onto the first.

## Plan
1. **AC-17 server test first, red.** New
   `src/app/live-connection-limits.test.ts` (real `freshDb()`, `getDb`
   mocked, cookie mocked as in `src/app/auth-enforcement.test.ts`): ten
   GETs of the operations events route for one user answer 200, the
   eleventh 429; cancelling one body lets the next one in; a second user
   still gets in. Same for a Gerätelink token (10) and an Ansichtslink token
   (50; 51st refused, another Ansichtslink of the same Einsatz still
   allowed). Proof: red on the 11th/51st status.
2. **Counter.** New `src/server/events/live-connections.ts`:
   `openLiveConnection(key, limit): (() => void) | null` - increments, or
   returns `null` at the limit; the returned release is idempotent and
   deletes the key at zero. Pinned on `globalThis` like the event bus.
   Proof: new `live-connections.test.ts` (limit, release, double release,
   independent keys).
3. **Stream with access check and lifetime.** `src/server/events/sse.ts`:
   `operationEventStream` takes `{ subscribe, stillAllowed: () =>
   Promise<boolean>, onClose: () => void }`. On each heartbeat tick it
   awaits `stillAllowed()` and closes the stream (`controller.close()` +
   `cleanup`) when it is false or throws; it also closes once the stream
   would otherwise outlive 1 hour (check elapsed time on the tick, so the
   stream never exceeds `MAX_STREAM_MS = 60 * 60_000`). `cleanup` calls
   `onClose` (releases the counter) exactly once, whichever way the stream
   ends. Keep the lifetime check on the heartbeat interval rather than a
   second timer, so tests fake only `setInterval` and `Date`. Proof:
   `sse.test.ts`: closes on the first tick after `stillAllowed` turns
   false; closes at the hour; `onClose` once on cancel, on close and on a
   failed enqueue; no timer left.
4. **Routes.** The three routes acquire the counter after the access
   check, pass `stillAllowed` and `onClose`:
   - operations: `requireUser()`; 404 when `getOperation` finds nothing
     (it already returns `null` for a non-UUID id); key
     `user:<id>`; `stillAllowed` = the cookie's token still resolves via
     `findUserBySessionToken` to the same user *and* the Einsatz exists.
   - device: key `device:<token>`, `stillAllowed` = `resolveDeviceAccess`
     still gives the same `operationId`.
   - view: key `view:<token>`, `stillAllowed` = `resolveViewAccess` the same.
   Proof: step 1 green; existing `src/app/view/[token]/events/route.test.ts`
   green; new case: operations route for a missing Einsatz → 404.
5. **AC-18 test, red then green.** New
   `src/app/live-connections-end.test.ts`, `vi.useFakeTimers({ toFake:
   ["setInterval", "clearInterval", "Date"] })` so the real DB keeps
   working: open a stream, trigger, `vi.advanceTimersByTimeAsync(30_000)`,
   the body reader reports `done`, and the counter is free again. One case
   per trigger: logout (`logoutAction`), session idle (back-date
   `last_seen_at`), „Überall abmelden" from another session, user deleted
   (`deleteAccount`), Ansichtslink deleted, Gerätelink removed (07's
   function) and regenerated (`generateDeviceLink`), Einsatz closed
   (device + view streams end, the user's stream stays open), Einsatz
   deleted (all three end). Plus: an unaffected stream (other Einsatz,
   other user) stays open. Plus: a stream ends after 1 hour. Write it
   before step 3/4 if you prefer it as the red test; it fails until both
   are in.
6. **Client keeps trying.** `src/map/useOperationEvents.ts`: on `onerror`
   with `source.readyState === EventSource.CLOSED`, close it and open a new
   EventSource after a short delay (decided: 5 s), until unmount; the
   reload-after-gap behaviour stays. Proof: `useOperationEvents.test.ts`
   (give `FakeEventSource` a `readyState` and the static `CLOSED`): a
   refused connection shows disconnected, a new source is created after
   5 s, a successful open reloads once and shows connected; unmount
   cancels the pending retry.
7. **Real browser.** `run-einsatz`: open one Einsatz in 11 tabs (or open
   the events URL 11 times with `fetch` from the page): the 11th shows the
   indicator „Verbindung getrennt"; closing one tab lets it reconnect within
   seconds. Proof: screenshot.
8. `npm run check` green.

## Not here
- Removing a Gerätelink and deleting links on closing: `07-links-entfernen-und-beim-abschliessen-loeschen`.
- Coalesced change events: `10-aenderungen-buendeln` (independent, no order).
- Session idle timeout and „Überall abmelden": `14-sitzungs-laufzeit`.
- Hidden layers in token views and geocoding limits:
  `16-token-ansichten`.
- Out of scope: "Ablaufdatum für Links und eine Anzeige, wann ein Link
  zuletzt benutzt wurde." and "Rechte je Einsatz; das flache
  Vertrauensmodell bleibt."

## Left standing
