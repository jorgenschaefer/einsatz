---
criteria:  CRITERIA.md
closes:
advances:  AC-7, AC-9
after:
status:    done
attempts:  1
---

## Build
The server's KML fetching reaches only public unicast addresses, and the
connection goes to exactly the address that was checked, so a DNS name cannot
switch to an internal address between check and fetch. This covers the URL of
a URL import and of "Neu laden" and every NetworkLink; icons follow in ticket
04 through the same fetch.

## Done when
From the ACs under *Toward*:

- AC-7, without icons: no fetch for a KML import or "Neu laden" - the URL
  itself or a NetworkLink, from a file or a URL - reaches an address outside
  the public unicast address space, also when a DNS name points elsewhere
  between check and fetch. For the URL itself (URL import and "Neu laden")
  „Diese Adresse ist nicht erlaubt." appears; such a NetworkLink is skipped
  like a dead link.
- AC-9: KML URLs that work today keep working through the new fetch,
  including Google „Meine Karten" (redirect to `googleusercontent.com`,
  NetworkLinks) and KMZ by URL.

## Toward
> **AC-7** Kein Abruf beim KML-Import – URL, NetworkLink, Icon – erreicht eine Adresse außerhalb des öffentlichen Unicast-Adressraums, auch wenn ein DNS-Name zwischen Prüfung und Abruf auf eine andere Adresse zeigt. Betrifft es die URL selbst, erscheint „Diese Adresse ist nicht erlaubt."; ein NetworkLink oder Icon wird übersprungen wie ein toter Verweis.

> **AC-9** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch Google „Meine Karten" mit NetworkLink und eigenen Icons. Ausnahme: KML-Ebenen, die vor dieser Änderung eingebunden wurden, zeigen Icons von anderen Hosts als Standard-Marker, bis sie neu geladen (URL) oder neu eingebunden (Datei) werden.

## Nudges
> KML-Icons über denselben SSRF-geprüften Abruf in `src/server/kml/kml-fetch.ts` laden und wie in `inlineKmzAssets` als `data:`-URL einbetten. Die geprüfte IP auch für die Verbindung verwenden (undici-`Agent` mit eigenem `connect.lookup`).

> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **Today** (`src/server/kml/kml-fetch.ts`, 271 lines):
  - `assertFetchableKmlUrl(url)` checks scheme and, for IP literals and
    `localhost`, a **blocklist** (`isBlockedIp`: 0/8, 127/8, 10/8, 172.16/12,
    192.168/16, 169.254/16, `::1`, `::`, `fe80`, `fc/fd`, IPv4-mapped). CGNAT
    `100.64/10`, multicast, `192.0.2/24`, `198.18/15`, `240/4`, NAT64, 6to4
    etc. pass.
  - `assertResolvedHostAllowed(hostname)` resolves with `dns.lookup` and checks
    the addresses; then `fetch` resolves **again** - the rebinding window the
    comment admits.
  - `fetchFollowingRedirects` follows up to `MAX_REDIRECTS = 5` by hand,
    re-checking each hop; 15 s timeout per request.
  - `fetchKmlFromUrl(url, depth = 0, doFetch = fetch)` checks `Content-Length`,
    then reads the whole body with `arrayBuffer()` and checks the size
    afterwards; `resolveKmlNetworkLinks(kml, depth = 0, doFetch = fetch)`
    fetches every `http(s)` NetworkLink href up to depth 3, skipping failures
    (`catch {}`) like dead links.
  - Callers (`src/app/operations/[id]/kml-actions.ts`): `addKmlFileAction` →
    `resolveKmlNetworkLinks(content)`; `addKmlUrlAction` →
    `fetchKmlFromUrl(source)`; `reloadKmlAction` →
    `reloadKmlOverlay(db, id, fetchKmlFromUrl)`
    (`src/server/kml/kml-overlays.ts`).
- **undici.** Node 24's global `fetch` is undici, but Node does not expose
  undici's `Agent` class, and the `undici` package is in `node_modules` only as
  a dev dependency of `jsdom` - `npm ci --omit=dev` in the `Dockerfile` drops
  it. Using an undici `Agent` therefore means adding `undici` as a dependency,
  which the second nudge rules out. Node's built-in `node:http`/`node:https`
  `request` has a `lookup` option that is the same hook as undici's
  `connect.lookup`: the socket connects only to what our lookup returns.
- **Test seams today.** `kml-fetch.test.ts` passes `scriptedFetch(...)` as
  `doFetch`; `kml-actions.document.test.ts` stubs the global `fetch`.
  `scriptedFetch` (`src/test/scripted-fetch.ts`) returns a hand-made object
  with `arrayBuffer()` only - no stream, no headers but `location`.
- **Size message.** `enforceKmlSizeLimit` / `enforceContentLength` throw
  `ValidationError("Die KML-Datei ist größer als 20 MB.")`; `MAX_KML_BYTES` is
  in `src/kml/kmz.ts`. This ticket leaves how a body is read and capped as it
  is; ticket 21 replaces it.
- `kml-fetch.ts` is 271 lines. Put the new pieces in their own files (below)
  so it does not grow.

## Plan
**Decided implementation choice (departs from the nudge; shown at approval):**
the connection is pinned with Node's built-in `node:http`/`node:https`
`request` and its `lookup` option, not with an undici `Agent` and
`connect.lookup`. The two hooks do the same thing; the undici `Agent` would
need `undici` as a new production dependency, which the nudge "Keine neuen
Abhängigkeiten" rules out. The builder records this departure under
`## Left standing` with that reason. If the approval prefers the undici
`Agent` and accepts the dependency, only step 3 changes (to `fetch(url, {
dispatcher: new Agent({ connect: { lookup } }) })`); the rest stays.

1. **Red: AC-7 (URL and NetworkLinks) at the actions.** In
   `src/app/operations/[id]/kml-actions.document.test.ts` (or a new
   `kml-actions.address.test.ts` beside it with the same mocks):
   - `addKmlUrlAction` with URLs whose host is a non-public literal that passes
     today - `http://100.64.0.1/x.kml`, `http://224.0.0.1/x.kml`,
     `http://192.0.2.1/x.kml`, `http://[2001:db8::1]/x.kml`,
     `http://[64:ff9b::7f00:1]/x.kml` - returns
     `{ error: "Diese Adresse ist nicht erlaubt." }` and fetches nothing;
   - the same for a host name that resolves to such an address (DNS lookup
     mocked for the test host, HTTP **not** mocked - the refusal happens
     before any connection, so no network is needed), for `addKmlUrlAction`
     and `reloadKmlAction`;
   - a file import (`addKmlFileAction`) and a URL import whose KML has a
     NetworkLink to a non-public literal (`http://100.64.0.1/a.kml`) and one
     to a public address served by the HTTP mock: the import succeeds with
     the public target's content only (the other skipped like a dead link).
   *Proof:* the literal and resolved cases fail today (they are fetched).
2. **Public unicast check.** New `src/server/kml/public-address.ts` with
   `isPublicUnicast(ip: string): boolean`, hand-written (no new dependency):
   IPv4 public unless in 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12,
   192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15,
   198.51.100/24, 203.0.113/24, 224/4, 240/4 (incl. 255.255.255.255); IPv6
   public only inside 2000::/3 and not in 2001::/23 (incl. Teredo
   2001::/32), 2001:db8::/32, 2002::/16 (6to4); IPv4-mapped `::ffff:a.b.c.d`
   and `::ffff:hhhh:hhhh` judged by the embedded IPv4. Ranges from the IANA
   special-purpose registries. Non-IP input is `false`. `assertFetchableKmlUrl`
   uses it for IP-literal hosts (and keeps rejecting `localhost` names);
   `isBlockedIp`/`isBlockedHost` go.
   *Proof:* `src/server/kml/public-address.test.ts` (new): each excluded range
   at its first and last address and one address on each side of the
   boundary (e.g. 100.63.255.255 public, 100.64.0.0 not, 100.127.255.255 not,
   100.128.0.0 public), both IPv4-mapped forms, a public v4 and v6. Move the
   relevant cases of the old `isBlockedIp` tests over; note `2001:db8::1` was
   "allowed" there and is now rejected (documentation range).
3. **Pinned connection.** New `src/server/kml/pinned-fetch.ts`:
   `pinnedFetch(url: URL, init: { headers; signal }): Promise<Response>`
   built on `node:http`/`node:https` `request` with `lookup:
   checkedLookup`, where `checkedLookup(hostname, options, callback)` resolves
   once with `dns.lookup(hostname, { all: true })`, fails with
   `ValidationError("Diese Adresse ist nicht erlaubt.")` if any address is not
   public unicast, and otherwise hands the socket exactly those addresses
   (honour `options.all`: Node's default `autoSelectFamily` asks for all; a
   single address otherwise). A resolve failure keeps today's
   „Die Adresse konnte nicht aufgelöst werden.". Return a real `Response`
   (`new Response(Readable.toWeb(res), { status, headers })`) so callers keep
   the fetch shape and ticket 21 can read the body as a stream; redirects stay
   manual (no auto-follow). IP-literal hosts skip `lookup` in Node - they are
   checked by `assertFetchableKmlUrl` before the request.
   `fetchFollowingRedirects` calls `pinnedFetch` and drops
   `assertResolvedHostAllowed`.
   *Proof:* `src/server/kml/pinned-fetch.test.ts` (new), against a local HTTP
   server on 127.0.0.1 and with `node:dns` mocked:
   - a name the mock resolves to `127.0.0.1` is refused with „Diese Adresse ist
     nicht erlaubt." and the local server receives no request (the socket's
     own lookup is the checked one - the system resolver would not know the
     name);
   - one `pinnedFetch` resolves the name exactly once (mock call count), so
     there is no second resolution a rebinding DNS could answer differently;
     with a mock that answers a public address first and `127.0.0.1` on any
     later call, the local server still receives nothing;
   - `checkedLookup` called directly with a mock answering a public address
     returns exactly that address in both `all: true` and single form, and
     refuses when any of several answers is non-public.
   The step 1 tests then mock `pinnedFetch` (see step 4) only where they
   serve content; the resolved-name cases keep the real `pinnedFetch` with
   DNS mocked, in their own test file since `vi.mock` applies per file.
4. **Test harness on the new seam.** `scriptedFetch` returns a real
   `Response` (stream body, optional `content-length`, `content-type`,
   `location`). `kml-fetch.test.ts` and the action tests mock
   `@/server/kml/pinned-fetch` with it (`vi.mock` + a `vi.fn` the test sets),
   instead of the `doFetch` parameter and the global `fetch` stub; the
   `doFetch` parameters go. `fetchKmlFromUrl` reads the `Response` as today
   (`arrayBuffer()` after `enforceContentLength`).
   *Proof:* all existing tests in `kml-fetch.test.ts`,
   `kml-actions.document.test.ts` and `kml-actions.test.ts` green on the new
   seam (redirect re-check, „Meine Karten" NetworkLink, KMZ by URL - the AC-9
   part).
5. **Clean up the comments** in `kml-fetch.ts` that describe the TOCTOU window
   as accepted and the `doFetch` seam.
   *Proof:* reading; `npm run check` green.
6. **Try it against the real network once.** In the running app
   (`run-einsatz` skill) import a public KML URL and a Google „Meine Karten"
   link with a NetworkLink; import `http://127.0.0.1:3000/` and a name that
   resolves to a private address (e.g. `localtest.me`) and see „Diese Adresse
   ist nicht erlaubt.". This is the one check of the untested HTTP edge.
   *Proof:* observation under `## Left standing`.

## Not here
- The per-import budget (20 addresses, 20 MB), reading responses as a capped
  stream, and the size message for an endless body: ticket
  `21-kml-abruf-budget`, built on the seam this ticket leaves.
- Icon fetching and embedding through this fetch, and AC-7 for icons: ticket
  `04-kml-icons-einbetten`, which closes AC-7.
- Regex backtracking in `src/kml/kmz.ts`: ticket `02-kml-ohne-backtracking`.
- The 20 MB request-body limit for uploads (KML file, Bild-Overlays): ticket
  `09-uploads-ueber-route-handler`.
- From *Out of scope*: Client-IP hinter Caddy ist korrekt; dass andere
  Container am `database_network` Port 3000 direkt erreichen, gehört zu
  `../drk-barmbek`. (This ticket guards what the app fetches, not who
  reaches it.)

## Left standing
- **Plan departure (agreed at approval): `node:http`/`node:https` instead of
  an undici `Agent`.** This departs from the nudge "Die geprüfte IP auch für
  die Verbindung verwenden (undici-`Agent` mit eigenem `connect.lookup`)".
  `undici` would be a new production dependency, which the nudge "Keine neuen
  Abhängigkeiten" rules out. `pinnedFetch` (`src/server/kml/pinned-fetch.ts`)
  hands the socket the `lookup` option `checkedLookup`.
- **Nudge not applicable: nothing changed in `src/server/validation.ts`.** The
  address check lives in `src/server/kml/public-address.ts`, as the plan said.
  No zod was added.
- **Gap from leaving undici: no transparent decompression.** `fetch` sent
  `Accept-Encoding` and unpacked gzip/br; `pinnedFetch` sends no
  `Accept-Encoding`. So servers answer uncompressed. A server that compresses
  anyway would now fail with „Die Adresse liefert keine KML-Datei.". None of
  the real URLs tried did that.
- **Plan addition: `3fff::/20` is also not public.** It is the newer IPv6
  documentation range (RFC 9637) and lies inside 2000::/3, but the plan's list
  left it out. `2001:db8::1`, which the old `isBlockedIp` allowed, is now
  rejected, as the plan said.
- **Plan addition: unusual HTTP statuses.** The first review found that a 204,
  205 or 304 answer, or a status above 599, threw inside the response callback
  and hung until the 15 s timeout. Statuses without a body now come back as an
  empty response. A status above 599 rejects at once, and the user sees
  „KML konnte nicht geladen werden.". Tests in `pinned-fetch.test.ts` cover
  both. Their red was a 5 s test timeout, not a failed assertion, because the
  hang was the defect.
- **Small departure in step 4:** `scriptedFetch` returns a real `Response` with
  status, body and `location`, but has no `content-length`/`content-type`
  options. No test needs them yet. Ticket 21 can add them.
- **Red for the resolved-name action tests** (`kml-actions.address.test.ts`)
  was shown against the original `kml-fetch.ts`. There
  `cgnat.example.test → 100.64.0.1` got „KML konnte nicht geladen werden."
  instead of „Diese Adresse ist nicht erlaubt.". The other names in that file
  (loopback, private, IPv4-mapped link-local) were already refused by the old
  blocklist. The rebinding guarantee itself is proven in `pinned-fetch.test.ts`:
  one DNS lookup per fetch, and the socket uses only the checked answer.
- **Review nit not fixed:** the rebinding test in `pinned-fetch.test.ts`
  ("connects to the checked address, not to a later answer …") lets the socket
  try a real TCP connection to `93.184.216.34` on a random port for up to
  500 ms. That shows the socket uses the checked answer. A public address that
  is also guaranteed unreachable does not exist, and avoiding the connection
  would mean patching `net`. The test does not depend on the outcome: it
  passes whether the connection is refused, unreachable or timed out.
- **Step 6 (real network), checked by hand and by the reviewer in the running
  app at 390×844, 1280×800 and 1920×1080:**
  - These imported with content: `http://developers.google.com/kml/documentation/KML_Samples.kml`
    (301 redirect), the KMZ `https://www.spc.noaa.gov/products/outlook/day1otlk.kmz`,
    the USGS NetworkLink KML `2.5_week_age_link.kml` (1916 Placemarks), and
    the Google „Meine Karten" link `https://www.google.com/maps/d/viewer?mid=1mRODUrb15J38DJ0QfaDLCzK7kEn9UfwX`
    (about 1.86 MB). A file with a NetworkLink to that „Meine Karten" export
    also imported. "Neu laden" on the KMZ and the „Meine Karten" overlay
    worked.
  - „Diese Adresse ist nicht erlaubt." appeared for `http://127.0.0.1:3000/`,
    `http://100.64.0.1/x.kml`, `http://10.0.0.1.sslip.io/x.kml` (a name that
    resolves to a private address), `http://100.64.0.1.sslip.io/x.kml`,
    `http://[::ffff:127.0.0.1]:3000/`, `http://0x7f.1:3000/`,
    `http://localhost./` and `http://169.254.169.254/latest`. It also appeared
    for "Neu laden" on an overlay whose stored URL was set to the sslip.io
    name. A file whose NetworkLinks pointed at `10.0.0.1.sslip.io`,
    `127.0.0.1:3000` and a public KML imported only the public content.
  - `localtest.me` and `127.0.0.1.nip.io` do not resolve on this machine, so
    `sslip.io` was used instead.
  - The redirect to `googleusercontent.com` did not happen for that map: the
    `forcekml` export answered directly. That redirect hop is covered only by
    the redirect tests in `kml-fetch.test.ts`, not by a real Google download.
