---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
Three of the seven `kml-actions.<topic>.test.ts` files - `.icons`,
`.icon-address` and `.budget` - test KML icon embedding and the fetch
budget through the action; their tests move to the modules that implement
them (`kml-icons`, `kml-import`, `fetch-budget`, `kml-fetch`), duplicates
are dropped, and the three files are deleted.

## Done when
Toward AC-1 and AC-2: `kml-actions.icons.test.ts`,
`kml-actions.icon-address.test.ts` and `kml-actions.budget.test.ts` in
`src/app/operations/[id]/` are gone.

Toward AC-3: each moved test drives the module that implements it
(`src/server/kml/kml-icons.test.ts` and `src/server/kml/kml-import.test.ts`
are new), not the action, and inspects the KML it produces without
another project module as the judge.

Toward AC-9: every test file this ticket writes to is under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if `kml-fetch.ts` is split, KML loading behaves as before;
only file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `kml-actions.ts` (67) only validates the URL, calls `loadKmlFromUrl` and
  the `kml-overlays` functions, inside `operationAction`. This ticket does
  not touch `kml-actions.test.ts` (tickets 04 and 25 do).
- Server modules: `src/server/kml/kml-import.ts` (47: `addKmlFile`,
  `loadKmlFromUrl`, `resolveKmlFile` - each makes a fresh budget, then
  embeds icons; no test); `kml-icons.ts` (53: `embedKmlIcons`,
  `fetchIconDataUri`, 256 KB cap, MIME check; no test); `fetch-budget.ts`
  (45, test 95); `kml-fetch.ts` (208, test 268; `assertFetchableKmlUrl`
  refuses literal loopback, private, link-local addresses, tested by
  "rejects loopback, private and link-local hosts"); `pinned-fetch.ts` (98,
  test 189: "refuses a name that resolves to a loopback address", "connects
  to the checked address").
- `.icons` (278; mocks `pinned-fetch`): embedding, an escaped query, MIME
  without parameters, exactly 256 KB, fetched once, failures (it.each), a
  refused address → `kml-icons`; growth limit of 20 MB →
  `kmz.replaceIconStyleHrefs`, into `kmz.test.ts` (393 lines; ticket 25
  adds to it later and keeps it under 500) - and one test stays with
  `kml-icons`: embedding through `embedKmlIcons` is capped at
  `MAX_KML_BYTES`, because the cap only applies since `embedKmlIcons`
  passes it (the default is `Infinity`); embedded on file / URL / reload and My-Maps NetworkLink icons →
  `kml-import`; "is embedded in a file of just under 20 MB" (L172) pins
  that `resolveKmlFile` checks the size before it embeds icons - also
  `kml-import`. It reads its results with `parseKml` from
  `@/map/kml-layer` - a client parser of another module; check the produced
  KML text directly instead (the `href`s and data URIs it contains).
- `.icon-address` (102; only the file route, a real HTTP server, real
  `pinned-fetch` with mocked DNS):
  - literal addresses (`http://127.0.0.1:…`, `http://100.64.0.1/`) are
    refused by `assertFetchableKmlUrl` in `kml-fetch.ts`, which
    `fetchIconDataUri` calls before any fetch - so in `kml-icons.test.ts`
    the mocked `pinnedFetch` is simply never called for them; the refusal
    itself is pinned in `kml-fetch.test.ts` (add 100.64.0.1 there if it is
    missing);
  - loopback by name duplicates `pinned-fetch.test.ts` "refuses a name that
    resolves to a loopback address";
  - DNS rebinding duplicates "connects to the checked address".
- `.budget` (260; action and the file route, mocked `pinned-fetch`): an
  endless body (`fetch-budget.readCapped`); 20 addresses including nested
  links and redirects, 20 MB (`fetch-budget` + `kml-fetch`: one address per
  URL, `resolveKmlNetworkLinks`); a fresh budget per load and reload
  (`kml-import`); an oversized icon is skipped, no address for a refused
  icon (`kml-icons`); icons spending from the same budget as the KML -
  that sharing is `loadKmlFromUrl`/`resolveKmlFile` in `kml-import.ts`
  passing one budget to both the fetch and `embedKmlIcons`, so its test
  goes to `kml-import.test.ts`, not `kml-icons`.
- If `kml-fetch.test.ts` would go over 500 lines with the budget cases, the
  seam is `resolveKmlNetworkLinks` and its helpers into a file of their own
  (for example `kml-network-links.ts`) with their tests, in a commit of its
  own, with the coverage-splits entry in this change's directory.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all - a test moved away can drop the coverage
  of a file this ticket never opened. Fixtures and `src/test/` helpers
  count too: code in them that no test uses any more is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- AC-3 review list: add a test file to `ac3-reviewed.txt` in this change's
  directory (one path per line, in the same commit) only if this ticket
  created it, or held every test in it against its own file - say which in
  Left standing. A test file this ticket only edited (added helper calls,
  moved some tests in or out) is not listed: the review tickets 26-31 read
  it. A file listed here is skipped by them and judged only here.

## Plan
1. `src/server/kml/kml-icons.test.ts` (new, `pinned-fetch` mocked as in
   `.icons`) with the `kml-icons` cases from `.icons`, the literal-address
   cases from `.icon-address` and the icon cases of `.budget`, and the 20 MB
   growth case into `kmz.test.ts` with one capped-growth test through
   `embedKmlIcons` kept in `kml-icons.test.ts` (drop the `MAX_KML_BYTES`
   argument by hand and see it fail; restore); drop the
   duplicates named under Context; delete `.icons` and `.icon-address`.
   Proof: green; drop the 256 KB cap by hand and see a test fail; restore.
2. `src/server/kml/kml-import.test.ts` (new) with the fresh-budget-per-load,
   icons-share-the-budget and embedding-on-load cases (give the icons a
   fresh budget by hand and see the sharing test fail; restore); the address and byte limits into
   `fetch-budget.test.ts` / `kml-fetch.test.ts`; delete `.budget`. Proof:
   `npm run check` green; every file under 500; the coverage comparison names no
   file.

## Not here
- `.document`, `.timing`, `.address` and `.name` (ticket 25).
- `kml-actions.test.ts`'s login, input and other-Einsatz checks (ticket 04).
- No change to the KML modules.

## Left standing
