---
criteria:  CRITERIA.md
closes:    AC-5
advances:  AC-9
after:
status:    done
attempts:  1
---

## Build
The regular expressions that scan KML text in `src/kml/kmz.ts` - `HREF`,
`NETWORK_LINK`, `DOCUMENT_BODY` and the `<href>` regex in `inlineKmzAssets` -
are replaced by linear `indexOf`/`lastIndexOf` scanning, so no KML or KMZ
content can make an import or "Neu laden" take catastrophically long.

## Done when
> **AC-5** Jede KML- oder KMZ-Datei bis 20 MB – beim Einbinden einer Datei, einer URL und beim „Neu laden" – wird höchstens doppelt so lange verarbeitet wie eine gewöhnliche KML-Datei gleicher Größe, egal was sie enthält; insbesondere `<href>` gefolgt von 20.000 Leerzeichen ohne `</href>` und 10.000 nicht geschlossene `<NetworkLink>` oder `<Document>`.

From the ACs under *Toward*:

- AC-9: KML and KMZ files and URLs that import today import with the same
  result after the rewrite: KMZ-bundled icons are still inlined, NetworkLinks
  (`<Link>` and the old `<Url>`) are still found and resolved, several fetched
  documents are still merged into one.

## Toward
> **AC-9** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch Google „Meine Karten" mit NetworkLink und eigenen Icons. Ausnahme: KML-Ebenen, die vor dieser Änderung eingebunden wurden, zeigen Icons von anderen Hosts als Standard-Marker, bis sie neu geladen (URL) oder neu eingebunden (Datei) werden.

## Nudges
> Die KML-Regexes in `src/kml/kmz.ts` durch `indexOf`/`lastIndexOf` ersetzen, statt sie nur umzuformulieren.

## Context
- **The regexes** (`src/kml/kmz.ts`):
  - `inlineKmzAssets`: `/<href>\s*([^<]+?)\s*<\/href>/g` over the whole KML,
    case-sensitive, href text without `<`, trimmed. Replaces a relative href
    that names a bundled image with a `data:` URL; everything else unchanged.
  - `networkLinkHrefs`: `NETWORK_LINK = /<NetworkLink\b[\s\S]*?<\/NetworkLink>/gi`,
    then `HREF = /<href>\s*([\s\S]*?)\s*<\/href>/i` in each block; keeps
    `http(s)` hrefs. Case-insensitive; the `\b` means `<NetworkLinkControl>` is
    not a NetworkLink.
  - `mergeKmlDocuments`: `DOCUMENT_BODY = /<Document\b[^>]*>([\s\S]*)<\/Document>/i`
    - from the end of the first `<Document …>` opening tag to the last
    `</Document>`, case-insensitive; `""` when there is none. Only runs for two
    or more documents.
  Each is super-linear on unclosed input: the lazy/greedy body is retried from
  every start tag (10,000 unclosed `<NetworkLink>` or `<Document>` ⇒ ~10,000 ×
  file length steps), and `\s*` around a lazy group backtracks quadratically on
  a long run of spaces.
- **Where they run, per import path:**
  - *Datei einbinden:* the browser runs `extractKml` (`readKml` in
    `src/map/KmlPanel.tsx`) - for a KMZ that is `inlineKmzAssets`. The server
    action `addKmlFileAction` (`src/app/operations/[id]/kml-actions.ts`) then
    runs `assertKmlDocument` and `resolveKmlNetworkLinks` (⇒
    `networkLinkHrefs`, and `mergeKmlDocuments` for fetched links).
  - *Per URL einbinden* (`addKmlUrlAction`) and *Neu laden* (`reloadKmlAction`
    → `reloadKmlOverlay(db, id, fetchKmlFromUrl)`): the server runs
    `fetchKmlFromUrl` (`src/server/kml/kml-fetch.ts`) ⇒ `extractKml` (KMZ ⇒
    `inlineKmzAssets`), `assertKmlDocument`, `resolveKmlNetworkLinks`.
  - `assertKmlDocument`/`hasKmlRoot` in `kml-fetch.ts` already scans with
    `indexOf` and has a "without stalling" test; leave it.
- **Action-level test harness.** `src/app/operations/[id]/kml-actions.document.test.ts`
  calls the real actions with `fetch` stubbed by `scriptedFetch`
  (`src/test/scripted-fetch.ts`, IP-literal hosts so `dns.lookup` needs no
  network), `createKmlOverlay` mocked, and `reloadKmlOverlay` mocked to call
  its fetcher with a fixed URL. That is where the user acts for URL, file and
  reload.
- Ticket `03-kml-abruf-absichern` rewrites the fetching in `kml-fetch.ts` in
  parallel; this ticket does not touch `kml-fetch.ts`, so the two do not
  collide. If 03 is already built when this one starts, the server no longer
  fetches through the global `fetch`: mock HTTP in the new test the way
  `kml-actions.document.test.ts` does by then.

## Plan
1. **Red: AC-5 at the actions.** New `src/app/operations/[id]/kml-actions.timing.test.ts`
   (same mocks as `kml-actions.document.test.ts`; copy the setup or extract
   the shared mocks into a fixture file next to them). A helper builds, for a
   given pathological piece, two inputs of **equal byte length**: valid KML
   padded with ordinary Placemarks plus the piece, and the same ordinary KML
   padded to the same length without it. Pad to a size where the ordinary run
   takes several milliseconds (around 1-2 MB; the AC's 20 MB is not needed to
   show the difference and would slow the suite). Time each action as the
   median of at least 5 runs after a warm-up and assert
   `pathological ≤ 2 × ordinary`. Cases, each containing the AC's named input
   verbatim:
   - `<href>` followed by 20,000 spaces without `</href>` - top level, and
     inside a closed `<NetworkLink><Link>…</Link></NetworkLink>`;
   - 10,000 unclosed `<NetworkLink>`;
   - 10,000 unclosed `<Document>` - in the content of two NetworkLink targets,
     so `mergeKmlDocuments` runs.
   Run each through `addKmlFileAction` (content), `addKmlUrlAction` (served as
   KML, and the `<href>` case also as a KMZ `doc.kml`, which runs
   `inlineKmzAssets` on the server) and `reloadKmlAction`. For the browser
   half of file import, time `extractKml` on the KMZ case directly - it is
   exactly what `readKml` in `KmlPanel` calls, and timing through a rendered
   panel would measure React, not the parsing.
   *Proof:* the test fails (ratio far above 2, or the default 5 s test timeout
   fires) before the rewrite.
2. **Pin today's matching behaviour before rewriting.** In
   `src/kml/kmz.test.ts` add the cases the current tests leave open, so the
   rewrite cannot silently change them: `networkLinkHrefs` is
   case-insensitive (`<networklink>`, `<HREF>`), ignores `<NetworkLinkControl>`,
   trims whitespace around the href, takes the first href in a block;
   `inlineKmzAssets` leaves an href containing `<` alone and trims; 
   `mergeKmlDocuments` takes from after the first `<Document …>` (with
   attributes) to the last `</Document>` (nested Documents kept) and yields an
   empty body for a document without one.
   *Proof:* these pass against the current regexes (they pin, not drive).
3. **Green: rewrite with `indexOf`/`lastIndexOf`.** In `src/kml/kmz.ts`
   replace the four regexes with small scanning helpers (find the next start
   tag from a position, find its closing tag with `indexOf` from there; on a
   missing close tag stop scanning instead of retrying from the next start;
   trim with a linear skip). Case-insensitive matching: scan a lower-cased copy
   for positions and slice the original. Keep the exported signatures
   (`inlineKmzAssets`, `networkLinkHrefs`, `mergeKmlDocuments`, `extractKml`).
   Ticket 04 will scan `<Icon><href>` with these helpers, so name them for
   what they find (e.g. `elementBodies(kml, tag)`), not for one caller.
   *Proof:* step 1 and step 2 green, and all existing tests in `kmz.test.ts`,
   `kml-fetch.test.ts`, `kml-actions.document.test.ts` stay green (AC-9 part).
4. `npm run check` green; run the timing test file a few times in a row to see
   it is not flaky (`npx vitest run src/app/operations/[id]/kml-actions.timing.test.ts`).
   If the ratio is noisy, raise the padding or the run count rather than the
   bound.

## Not here
- The fetch limits (20 addresses, 20 MB total, streaming cap) and the
  public-unicast check: ticket `03-kml-abruf-absichern`.
- Embedding http(s) icons: ticket `04-kml-icons-einbetten`, which reuses the
  scanning helpers from step 3.
- Parsing in the browser (`parseKml` in `src/map/kml-layer.ts`, DOMParser +
  togeojson) is not regex-based and not part of this rewrite.

## Left standing
- **AC-5 at 20 MB is not in the suite.** The timing test runs at 3 MB (the
  plan suggested 1-2 MB; see below). I ran it once by hand at 20 MB
  (`SIZE = 20_000_000`, `--testTimeout=300000`): all 18 cases passed, with a
  pathological/ordinary ratio between 0.80 and 1.18 (ordinary runs took
  34-490 ms).
- **The browser half of file import is timed in Node, not in a browser.**
  As the plan says, the test times `extractKml` directly on the KMZ. No browser
  was driven.
- **Red for the `<href>` + 20,000 spaces cases was a hang, not a failed
  assertion.** The old regexes backtrack cubically on that input. I killed the
  run after 60 s, and the reviewer killed it after 300 s. The NetworkLink and
  Document cases failed with real mismatches (about 200-630 ms against
  4-20 ms), also after the test's final reshaping.
- **Where the AC's inputs sit in the test file.** Each piece goes at the end
  of the file, inside `<kml><Folder>…</Folder></kml>`, not inside a
  `<Document>`. The reason: if a `</Document>` follows, the old `DOCUMENT_BODY`
  regex finds it quickly, and the slow case does not show. The new scanning is
  linear wherever the piece sits, but the test only covers that one position.
- **Plan departure: the lower-cased copy is ASCII-only.** Plan step 3 said to
  scan a lower-cased copy. `String.prototype.toLowerCase` can change the
  length (`İ` becomes two characters), which would shift every position sliced
  from the original. So `asciiLowerCase` lowers only `A-Z`. That is also
  exactly what the old `/i` regexes (without `u`) treated as case-insensitive.
  It is pinned by a test with 30 × `İ` before a NetworkLink.
- **Plan departure: how the timing is measured.** The plan said the median of
  at least 5 runs and 1-2 MB. That was green when the machine was idle, but
  the first review found it failed in 4 of 8 runs with all cores busy. Now the
  test uses 3 MB and 9 runs, and alternates ordinary and pathological runs so
  that outside load hits both equally. As the plan said, I raised the size and
  the run count, not the bound. With all 24 cores busy it passed 8 of 8 runs.
- **Small change in matching:** the href inside a NetworkLink is now found
  with the same scanning helper as the NetworkLink itself. So `<href …>` with
  attributes now counts too, where the old `HREF` regex accepted only a bare
  `<href>`. Anything that matched before still matches the same way.
- **AC-9 (advanced only):** it rests on the existing tests in `kmz.test.ts`,
  `kml-fetch.test.ts` and `kml-actions.document.test.ts`, which are unchanged
  and green, plus the new pins in `kmz.test.ts`. Nobody imported a real Google
  "Meine Karten" export by hand.
- **`elementBodies` is not exported.** Ticket 04 will need to export it when
  it reuses it.

