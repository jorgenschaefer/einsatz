---
criteria:  CRITERIA.md
closes:    AC-15, AC-16
advances:
after:
status:    ready
attempts:  0
---

## Build
Live updates stop scaling with how fast things change. A Standortmeldung less than 5 seconds after the last stored one from the same Gerätelink is neither stored nor published, and the device still gets its 204. `publishOperationChanged` coalesces changes per Einsatz, so a burst of changes reaches each client as at most two reloads in any one second, and the last change arrives within a second.

## Done when
> **AC-15** Eine Standortmeldung, die weniger als 5 Sekunden nach der zuletzt gespeicherten desselben Gerätelinks kommt, wird weder gespeichert noch an andere gemeldet; das Gerät zeigt deswegen keinen Fehler.

> **AC-16** Ändert sich ein Einsatz viele Male in kurzer Zeit, lädt jeder Client höchstens zweimal pro Sekunde neu, und die letzte Änderung ist spätestens eine Sekunde nach ihr bei allen zu sehen.

## Nudges
> Standort-Drosselung in der Bedingung des bestehenden UPDATE in `reportPosition`.

> `publishOperationChanged` je Einsatz entprellen, statt in jedem Client.

## Context
**Standortmeldung.** `POST /device/[token]/position` (`src/app/device/[token]/position/route.ts`) validates `lat`/`lng` and calls `reportPosition(db, token, lat, lng, now = new Date())` in `src/server/mapsymbols/map-symbols.ts`. That is a single `UPDATE map_symbols … SET lat, lng, position_source = 'device', reported_at = $4 … WHERE device_link_token = $1 AND operations.status = 'active' RETURNING operation_id`. It returns `{ operationId }` or `null`; on `null` the route answers 403, otherwise it calls `publishOperationChanged` and answers 204. `reported_at` is written only by this UPDATE. A manual move (`moveMapSymbol`) changes `position_source` and leaves `reported_at` alone.

On the device, `src/map/useDeviceLocation.ts` treats 403 as "Zugang beendet" and any `ok` answer as sent. `shouldSendPosition` (`src/map/device-location.ts`) sends again after 10 m of movement or 30 s. A throttled report answered with 204 counts as sent there, so the stored position can lag by up to 10 m or 30 s while a device moves fast. That follows from AC-15 ("das Gerät zeigt deswegen keinen Fehler") and needs no client change.

The 5 s condition has to go into the UPDATE's own `WHERE` and be written against `map_symbols.reported_at`, not a value read earlier. Postgres then re-checks it on the locked row, so two concurrent reports cannot both pass. When no row matches, the route still has to tell "throttled" (204, no publish) from "no access" (403). Look access up again with the existing `resolveDeviceAccess(db, token)` only in that case. It is one more query on the throttled path and none on the normal one (decided in this ticket). "Weniger als 5 Sekunden" means a report exactly 5.000 s after the last stored one is stored.

**Bus.** `src/server/events/operation-events.ts` keeps a `Map<operationId, Set<Listener>>` pinned to `globalThis`. `publishOperationChanged` calls every listener synchronously. The SSE stream (`src/server/events/sse.ts`, `operationEventStream`) sends one `data: changed` per call, and every client (`src/map/useOperationEvents.ts`) calls `router.refresh()` per message without coalescing of its own. So the number of client reloads equals the number of bus notifications.

**What "at most twice per second" means here (decided in this ticket):** every closed 1-second span of time holds at most two notifications of one Einsatz. Equivalently, for the notification times t₀ < t₁ < t₂ < … of one Einsatz, every t₍ᵢ₊₂₎ − tᵢ > 1000 ms. A 500 ms window does not meet this: notifications at 0, 500 and 1000 ms put three into the span [0 ms, 1000 ms]. A fixed leading/trailing window must therefore be longer than 500 ms.

Design: leading and trailing with a **600 ms** window (`COALESCE_MS = 600`), per Einsatz. The first publish to an idle Einsatz notifies at once and opens a 600 ms window. Publishes inside the window only mark it pending. When the window ends with something pending, the bus notifies once and opens the next 600 ms window; otherwise the Einsatz goes back to idle. So consecutive notifications are at least 600 ms apart (t₍ᵢ₊₂₎ − tᵢ ≥ 1200 ms), and the last change is delivered at most 600 ms after it happens, which leaves 400 ms of AC-16's second for the client's `router.refresh()`. 600 rather than 501 ms gives slack for a timer that fires a millisecond early or late; it is one constant if the user wants a different value. The window state lives next to the listener map on `globalThis`, for the same reason the map does.

Callers of `publishOperationChanged`: `revalidateOperation` in `src/app/operations/[id]/operation-action.ts`, `src/app/operations/lifecycle-actions.ts`, and the position route. Most action tests mock the bus; only `src/server/events/operation-events.test.ts` runs it for real.

## Plan
1. **AC-15 as a test, red.** In `src/app/device/[token]/position/route.test.ts` (real `freshDb()`, mocked `publishOperationChanged`, `vi.setSystemTime` to place the reports):
   - A first report → 204, stored, published once.
   - A second report 4.9 s later at another position → 204, the symbol still has the first position and its `reported_at`, no second publish.
   - A third at 5.0 s after the first → stored and published.
   - A report for a closed Einsatz or an unknown token stays 403, also within 5 s of a stored report.

   *Proof:* red on the second report: the position is overwritten and published twice.
2. **Throttle in the UPDATE.** Add `AND (ms.reported_at IS NULL OR ms.reported_at <= $4::timestamptz - interval '5 seconds')` to the UPDATE in `reportPosition`. Return a result that tells stored from throttled, e.g. `{ operationId, stored: boolean } | null`, using `resolveDeviceAccess` when no row was updated. The route publishes only when `stored`.
   *Proof:* step 1 green. In `src/server/mapsymbols/map-symbols.test.ts`, two concurrent `reportPosition` calls with the same `now` store exactly one (`Promise.all`; `freshDb()` is a pool of up to 5 connections, so the two UPDATEs really run side by side). The existing `reportPosition` tests stay green.
3. **AC-16 as a test, red.** In `src/server/events/operation-events.test.ts`, with `vi.useFakeTimers()`, subscribe to an Einsatz with a listener that records `Date.now()` per notification. A helper `assertAtMostTwoPerSecond(times)` checks the definition from Context: for every i, `times[i + 2] - times[i] > 1000`. Cases:
   - 50 publishes spread over 2 s (every 40 ms): the helper passes.
   - Publishes placed on the window edges (at 0 ms, then just before and exactly at every multiple of 500 and 600 ms up to 3 s): the helper passes. This is the case a 500 ms window fails.
   - In both, the last notification comes at most 1000 ms after the last publish (with this design at most 600 ms; assert ≤ 1000, the AC's bound, so the constant can change).
   - A single publish to an idle Einsatz notifies at once (no timer advance).
   - Bursts on two Einsätze do not hold each other back: each Einsatz's first publish notifies at once.

   Also drive it once through `operationEventStream` (`src/server/events/sse.test.ts`), counting `data: changed` chunks, so it is pinned where the client listens.
   *Proof:* red: 50 notifications.
4. **Coalesce in the bus.** Implement the leading/trailing 600 ms window (`COALESCE_MS`) in `publishOperationChanged`, per Einsatz, on `globalThis`. Notify through the existing loop that keeps a failing listener from stopping the others. When the last listener unsubscribes, a pending window may still fire harmlessly into an empty set; do not keep entries for Einsätze nobody listens to.
   *Proof:* step 3 green. The existing bus tests ("own operation only", "every subscriber", "throwing listener", "unsubscribe") stay green; adjust them to fake timers where a second publish inside a window now arrives late.
5. **Whole suite.** Tests elsewhere that subscribe to the real bus and expect a second publish at once (search for `subscribeOperation` outside `src/server/events`) get fake timers or a wait.
   *Proof:* `npm run check` green.

## Not here
- Limits on the number of live connections, re-checking access on the heartbeat, and the 1 h stream lifetime: ticket `15-live-verbindungen-begrenzen`. 15 changes `operationEventStream`'s signature in `src/server/events/sse.ts`; this ticket only adds a test to `sse.test.ts`. Neither comes after the other; whichever is built second adapts that test to the signature it finds.
- Reading at most 1 KB of a Standortmeldung's body (with `readRequestBody` from `src/server/http/request-body.ts`): ticket `22-standortmeldung-begrenzen`. Both tickets change `src/app/device/[token]/position/route.ts` and add to its `route.test.ts`, and neither comes after the other; whichever is built second merges onto the first.
- No coalescing in the client (`useOperationEvents`): the nudge puts it on the server.

## Left standing
