---
criteria:  CRITERIA.md
closes:
advances:  AC-14
after:
status:    ready
attempts:  0
---

## Build
The anonymous Standortmeldung route reads at most 1 KB of the request body as
a stream - also when the body comes without `Content-Length` - before it
parses anything, and answers 413 above that. The capped reader it uses is
the shared helper the upload route handlers of ticket 09 reuse.

## Done when
From the ACs under *Toward*:

- AC-14, for the Standortmeldung: `POST /device/[token]/position` accepts no
  body over 1 KB (1,024 bytes), also when it is sent as a stream without
  `Content-Length`; it stops reading shortly after 1 KB and stores and
  publishes nothing. A normal report still answers 204 (403 for an ended
  link, 400 for bad JSON) as today.

## Toward
> **AC-14** Ohne gültige Sitzung nimmt die App keinen Request-Body über 1 MB an, eine Standortmeldung keinen über 1 KB – auch wenn der Body ohne `Content-Length` gesendet wird. Angemeldet lassen sich KML-Dateien und Bild-Overlays bis 20 MB weiter einbinden, hochladen und ersetzen.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **Today.** `src/app/device/[token]/position/route.ts` (`POST`, no login,
  authorised by the Gerätelink token) calls `request.json()` with no limit,
  then `isValidLatLng`, `reportPosition(getDb(), token, lat, lng)` (403 on
  `null`), `publishOperationChanged`, 204. A bad body answers 400
  "Ungültige Daten".
- `src/app/device/[token]/position/route.test.ts` runs the route against a
  real `freshDb()` with `publishOperationChanged` mocked; its `post` helper
  builds a `Request` with a JSON string body.
- Route handlers are not covered by `serverActions.bodySizeLimit` and do not
  go through `src/proxy.ts` (ticket 05's matcher leaves them out), so the
  route has to limit its own body.
- `src/server/http/` exists (`client-ip.ts`); the new reader goes beside it.

**Decided here** (shown at approval):
- *1 KB is 1,024 bytes.* A Standortmeldung body is `{"lat":…,"lng":…}`,
  well under 100 bytes.
- *The reader.* `readRequestBody(request, maxBytes): Promise<Uint8Array>` in
  new `src/server/http/request-body.ts`, throwing `RequestBodyTooLargeError`.
  Ticket 09 uses the same function for its upload route handlers with a
  20 MB (+ multipart overhead) cap, so its name and error class are what 09
  is written against.
- The body is read before the token is checked, so an oversize body answers
  413 whatever the token; nothing is looked up for it.

**Merge note.** Ticket `10-aenderungen-buendeln` also edits
`src/app/device/[token]/position/route.ts` and its `route.test.ts` (the 5 s
throttle in `reportPosition`, whose result the route uses), and neither ticket
comes after the other. Whichever is built second merges onto the first: this
ticket changes only how the body is read and parsed at the top of `POST`; 10
changes what happens after `reportPosition`. Keep both sets of tests.

## Plan
1. **Red: the AC-14 part at the route.** In
   `src/app/device/[token]/position/route.test.ts`:
   - a valid token with a 1,025-byte body sent as a `ReadableStream` without
     `Content-Length` (`duplex: "half"`) answers 413, stores no position and
     does not publish;
   - an endless stream that counts its pulls: 413, and it stopped being
     pulled shortly after 1 KB (at most 1,024 bytes plus one chunk);
   - a body of exactly 1,024 bytes (valid JSON padded with spaces) is
     accepted (204);
   - a `Content-Length` over 1,024 answers 413 without pulling the stream.
   *Proof:* red - `request.json()` reads everything and answers 400 or 204.
2. **Capped reader.** New `src/server/http/request-body.ts`:
   `readRequestBody(request, maxBytes)` rejects at once when `Content-Length`
   is over `maxBytes`. Otherwise it reads `request.body` chunk by chunk,
   cancels the reader and throws `RequestBodyTooLargeError` as soon as the
   count passes `maxBytes`, and returns the bytes.
   *Proof:* new `src/server/http/request-body.test.ts`: exactly `maxBytes`
   accepted, one byte more rejected, an announced oversize rejected without a
   pull, an endless stream cancelled, an empty body returns empty bytes.
3. **Position route.** `src/app/device/[token]/position/route.ts` reads at
   most 1,024 bytes with `readRequestBody`, answers 413 on
   `RequestBodyTooLargeError`, and parses with `JSON.parse` on the decoded
   text (still 400 "Ungültige Daten" on bad JSON).
   *Proof:* step 1 green; the existing 204/403/400 tests stay green.
4. `npm run check` green.

## Not here
- The 1 MB limit for server actions and the proxy, the upload route handlers
  with their 20 MB stream cap, and closing AC-14: ticket
  `09-uploads-ueber-route-handler`.
- Not storing or publishing a Standortmeldung less than 5 s after the last
  one (AC-15): ticket `10-aenderungen-buendeln` (see the merge note).
- From *Out of scope*: header and body limits in Caddy (`../drk-barmbek`).
  The app sets its limits itself.

## Left standing
