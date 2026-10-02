---
criteria:  CRITERIA.md
closes:
advances:  AC-6, AC-9
after:     03-kml-abruf-absichern
status:    ready
attempts:  0
---

## Build
Every KML import (file or URL) and every "Neu laden" gets one budget - at most
20 fetched addresses and 20 MB read in total - and each response is read as a
stream and cut off as soon as it exceeds 20 MB, with or without
`Content-Length`. Icons join the same budget in ticket 04.

## Done when
From the ACs under *Toward*:

- AC-6, without icons: importing a KML layer as a file or by URL, and "Neu
  laden", fetch at most 20 addresses (the URL and NetworkLinks together) and
  read at most 20 MB together; a response is cut off as soon as it exceeds
  20 MB, also without `Content-Length`. A URL whose own content exceeds 20 MB
  shows „Die KML-Datei ist größer als 20 MB."; NetworkLinks beyond either
  limit are skipped like a dead link.
- AC-9: KML files and URLs that import today import with the same result
  under the budget, including Google „Meine Karten" with a NetworkLink and
  KMZ by URL.

## Toward
> **AC-6** Jedes Einbinden einer KML-Ebene – als Datei oder per URL – und jedes „Neu laden" ruft höchstens 20 Adressen ab (URL, NetworkLinks und Icons zusammen), liest zusammen höchstens 20 MB und bricht eine Antwort ab, sobald sie 20 MB übersteigt, auch ohne `Content-Length`. Übersteigt die Datei oder die URL selbst 20 MB, erscheint „Die KML-Datei ist größer als 20 MB."; NetworkLinks und Icons jenseits der Grenzen werden übersprungen wie ein toter Verweis.

> **AC-9** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch Google „Meine Karten" mit NetworkLink und eigenen Icons. Ausnahme: KML-Ebenen, die vor dieser Änderung eingebunden wurden, zeigen Icons von anderen Hosts als Standard-Marker, bis sie neu geladen (URL) oder neu eingebunden (Datei) werden.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
**After 03.** Read its `## Left standing` first; names below are the ones its
plan chose and may have shifted.

- **From 03:** all server-side KML HTTP goes through `pinnedFetch`
  (`src/server/kml/pinned-fetch.ts`), which returns a real `Response` with a
  stream body, behind `fetchFollowingRedirects` in
  `src/server/kml/kml-fetch.ts` (up to `MAX_REDIRECTS = 5` hops, each
  re-checked). Tests mock `@/server/kml/pinned-fetch` with `scriptedFetch`
  (`src/test/scripted-fetch.ts`), which serves real `Response`s with
  headers; the `doFetch` parameters are gone.
- **Reading today:** `fetchKmlFromUrl(url, depth)` checks `Content-Length`
  with `enforceContentLength`, then reads the whole body with `arrayBuffer()`
  and checks the size afterwards - an endless body without `Content-Length`
  is read until memory runs out. `resolveKmlNetworkLinks(kml, depth)`
  fetches every `http(s)` NetworkLink href up to depth 3 with no count limit,
  skipping failures (`catch {}`) like dead links.
- **Callers** (`src/app/operations/[id]/kml-actions.ts`): `addKmlFileAction`
  → `resolveKmlNetworkLinks(content)`; `addKmlUrlAction` →
  `fetchKmlFromUrl(source)`; `reloadKmlAction` →
  `reloadKmlOverlay(db, id, fetchKmlFromUrl)`
  (`src/server/kml/kml-overlays.ts`).
- **Size message.** `enforceKmlSizeLimit` / `enforceContentLength` throw
  `ValidationError("Die KML-Datei ist größer als 20 MB.")`; `MAX_KML_BYTES` is
  in `src/kml/kmz.ts`.
- `kml-fetch.ts` must not grow; the budget gets its own file.

**Decided here** (expensive to reverse; shown at approval):
- *Address count.* One fetched address is one URL, NetworkLink or (in 04)
  icon. The redirects followed for it (still at most 5 each) do not count as
  further addresses - decided. This reads AC-6's "(URL, NetworkLinks und
  Icons zusammen)" literally: the addresses are the ones the KML names.
- *Bytes.* "liest zusammen höchstens 20 MB" counts bytes read from responses
  (as received, a KMZ compressed). The uploaded file's own content in a file
  import is not fetched and does not count; its size is still capped by
  `enforceKmlSizeLimit` as today.
- *Budget shape.* A per-import object `FetchBudget { addressesLeft: number;
  bytesLeft: number }`, created by `createFetchBudget()` (20 / 20 MB) and
  passed explicitly; never module state.
- *Entry points.* The actions stop calling `fetchKmlFromUrl` /
  `resolveKmlNetworkLinks` directly and call two functions that create the
  budget: `loadKmlFromUrl(url)` (URL import and "Neu laden") and
  `resolveKmlFile(content)` (file import). Ticket 04 adds icon embedding
  inside these two, so all three paths get it from one place.

## Plan
1. **Red: the AC-6 part at the actions.** In
   `src/app/operations/[id]/kml-actions.document.test.ts` (or a new
   `kml-actions.budget.test.ts` beside it with the same mocks), with
   `pinnedFetch` mocked by `scriptedFetch`:
   - URL serving an endless body without `Content-Length` ⇒
     „Die KML-Datei ist größer als 20 MB.", and the stream was pulled no more
     than 20 MB plus one chunk;
   - a URL whose KML has 25 NetworkLinks ⇒ exactly 20 requests in total
     (URL + 19 links), the import succeeds with those 19 merged; the same
     with a file import (20 links fetched, the file itself fetches nothing);
   - NetworkLinks of 8 MB each ⇒ the third is cut off and skipped, the first
     two are merged (total read ≤ 20 MB);
   - nested NetworkLinks (depth 2) share the one budget;
   - a NetworkLink reached through 3 redirects counts as one address;
   - "Neu laden" gets a fresh budget each time.
   *Proof:* red - the endless body is read whole, all 25 links are fetched.
2. **Streaming test body.** `scriptedFetch` gains a way to serve an endless or
   very large body without materialising it (a `ReadableStream` that
   generates chunks and counts bytes pulled), so step 1 runs in memory.
   *Proof:* used by step 1; a direct test in `src/test/scripted-fetch.test.ts`
   (new, if none exists) that the counter matches what a reader pulled.
3. **Budget and capped read.** New `src/server/kml/fetch-budget.ts` with
   `FetchBudget`, `createFetchBudget()` and `readCapped(response, budget,
   cap)` that reads the body chunk by chunk, cancels the reader as soon as the
   count exceeds `min(cap, budget.bytesLeft)` and then throws the size
   `ValidationError`, and subtracts what was read; plus `takeAddress(budget)`
   (none left ⇒ `false`). `cap` is a parameter so ticket 04 can read icons
   with 256 KB.
   *Proof:* `src/server/kml/fetch-budget.test.ts` (new): exactly the cap
   accepted, one byte more cancelled, the budget's remaining bytes cap a read
   below 20 MB, `takeAddress` stops at 0.
4. **Thread it.** `fetchKmlFromUrl(url, budget, depth)` takes one address
   before the request (none left ⇒ skip) and reads with `readCapped`;
   `enforceContentLength` stays as an early refusal.
   `resolveKmlNetworkLinks(kml, budget, depth)` passes the budget down; a
   NetworkLink that fails on the budget is skipped like any dead link, while
   the URL itself surfaces the size message. Add `loadKmlFromUrl(url)` and
   `resolveKmlFile(content)` (each `createFetchBudget()` and call the above)
   and switch `addKmlFileAction`, `addKmlUrlAction` and `reloadKmlAction`'s
   fetcher to them; update the mocks in `kml-actions.test.ts`.
   *Proof:* step 1 green; existing `kml-fetch.test.ts` and action tests green
   (the AC-9 part).
5. `npm run check` green.

## Not here
- The public-unicast check and the pinned connection: ticket
  `03-kml-abruf-absichern`, already built.
- Icons in the budget, and closing AC-6: ticket `04-kml-icons-einbetten`.
- The request-body limit of the KML file upload itself (20 MB stream cap on
  the upload): ticket `09-uploads-ueber-route-handler`.
- Regex backtracking in `src/kml/kmz.ts`: ticket `02-kml-ohne-backtracking`.

## Left standing
