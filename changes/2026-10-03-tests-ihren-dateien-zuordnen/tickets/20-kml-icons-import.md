---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
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
  of a file this ticket never opened. A file it names that has no test
  file gets one, `X.test.*` next to it, with tests of its own behaviour
  until the comparison is clean; say which in Left standing. Fixtures and
  `src/test/` helpers count too: code in them that no test uses any more
  is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- Before each commit that touches a test, fixture or `src/test/` file, run
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs`
  (ticket 01). Every name it lists as removed is in the commit's `Removed
  tests:` section; the names it lists as added show where a moved or
  renamed test went.
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
- **Review findings not fixed.** None. The one review round found no
  blocker and nothing that should be fixed, only three nits, and I fixed
  all three:
  - I renamed the "exactly 20 MB" test after what it pins: the size is
    checked before icons are embedded.
  - I moved the fresh-budget tests into the `loadKmlFromUrl` and
    `resolveKmlFile` blocks. Before, a `describe.each` repeated both
    block names.
  - Both budget blocks in `kml-fetch.test.ts` now count requests with one
    shared helper.
  Since only nits came back, there was no second round.
- **Checks not run.** None skipped. After the last edit:
  - `npm run check` is green: 203 files, 2676 tests.
  - `npm run test:coverage` and then `compare-coverage.mjs` exit 0, with
    no coverage drop. As after earlier tickets, the script names only
    helper and fixture files from tickets 02-19 as "new, compared with
    nothing". No file needed a new test file, and no helper code moved, so
    `coverage-splits.json` is unchanged.
  - No helper lost its last user: `src/test/kml-upload.ts` and
    `src/test/scripted-fetch.ts` are both still used.
- **Advanced without an automated test.**
  - AC-1, AC-2, AC-9: I checked by listing the files. The three files are
    gone. The test files this ticket writes to have 403
    (`kml-fetch.test.ts`), 204 (`kml-icons.test.ts`) and 193
    (`kml-import.test.ts`) lines.
  - AC-3, AC-11: I broke the code by hand to prove the moved tests, and
    restored each break:
    - Without the 256 KB cap: "… when it is larger than 256 KB" failed.
    - Without the `MAX_KML_BYTES` argument to `replaceIconStyleHrefs`:
      "adds at most 20 MB to the KML …" failed.
    - Without `takeAddress` in `fetchIconDataUri`: "fetches icons only
      while the budget has addresses left" failed.
    - With the address taken before the address check: "takes no address
      for an icon whose address is not allowed" failed.
    - With a fresh budget passed to `readCapped`: "keeps the address of an
      icon larger than the bytes left" failed.
    - Without the body cancel: both "is not read further …" failed.
    - With a fresh budget for the icons in `loadKmlFromUrl`: "fetches
      icons from the addresses the KML left in its budget" failed.
    - The same in `resolveKmlFile`: "keeps the address of an icon that no
      longer fits …" failed.
    - With one budget shared across loads: both "gives every load a fresh
      budget of 20 addresses" failed.
    - With the size checked after embedding: "checks the size before
      embedding icons …" failed.
    - With `addKmlFile` storing the raw file: "stores the file with its
      icons embedded …" failed.
    - Without the address check in `fetchKmlFromUrl`: five of the new
      budget tests in `kml-fetch.test.ts` failed.
    - Without the public-address check in `pinned-fetch.ts`: "refuses a
      name that resolves to a loopback address without connecting" failed.
    - With the name looked up again after the check: "connects to the
      checked address, not to a later answer for the same name" failed.
      These last two prove the two dropped `.icon-address` tests are
      duplicates.
  - AC-12: no production file changed, so `git diff` shows only test
    files.
- **AC-3 review list.** I created `kml-icons.test.ts` and
  `kml-import.test.ts` and added both to `ac3-reviewed.txt`. I only
  edited `kml-fetch.test.ts`, so it is not listed.
- **Departures from the plan.**
  - Nothing new went into `kmz.test.ts`. Its existing test, "replaces no
    further href once the result would grow by more than maxGrowth",
    already pins the growth limit, boundary included. So the old 20 MB
    test now lives only in `kml-icons`, as the capped-growth test the plan
    keeps there.
  - Nothing went into `fetch-budget.test.ts`. Its `readCapped` and
    `takeAddress` tests already pin the caps there. The action-level
    budget cases show the budget at work in `fetchKmlFromUrl` and
    `resolveKmlNetworkLinks`, so they went to `kml-fetch.test.ts`, which
    stays under 500 lines. `kml-fetch.ts` is not split.
  - Small changes made while moving tests:
    - The oversized icon is now 256 KB + 1 byte, not 300 KB, so it sits
      right on the limit.
    - The literal loopback address is `127.0.0.1:8080`, not a real server
      port, because nothing is ever requested from it.
    - `addKmlFile` is tested against the test database. Before, it ran
      with a mocked `createKmlOverlay`.
    - Tests that build a 20 MB KML compare counts, not strings. A failed
      `toContain` on a 20 MB string made vitest hang while it printed the
      diff.
- **Departures from a nudge.** None.
