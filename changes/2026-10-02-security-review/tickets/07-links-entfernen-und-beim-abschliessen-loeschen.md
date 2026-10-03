---
criteria:  CRITERIA.md
closes:    AC-11, AC-12
advances:
after:     06-einsatz-loeschen-nur-admin
status:    done
attempts:  1
---

## Build
A Gerätelink can be removed from its Kartenzeichen ("Gerätelink entfernen",
with a confirmation). "Abschließen" asks first, and closing an Einsatz deletes
all its Gerätelinks and Ansichtslinks in the same transaction as the status
change, so no old link works again after "Wieder öffnen".

## Done when
> **AC-11** Hat ein Kartenzeichen einen Gerätelink, bietet sein Panel „Gerätelink entfernen" mit Rückfrage an. Nach dem Bestätigen bietet das Panel „Gerätelink erzeugen" an, ein offenes Gerät zeigt ohne Neuladen „Zugang beendet", der alte Link führt zu „Zugang beendet", und das Kartenzeichen ist wieder manuell verortet.

> **AC-12** „Abschließen" fragt nach, bevor der Einsatz abgeschlossen wird; die Rückfrage sagt, dass dabei alle Gerätelinks und Ansichtslinks gelöscht werden. Nach dem Abschließen führen alle bisherigen Links zu „Zugang beendet", auch nach „Wieder öffnen"; die Panels bieten dann an, neue zu erzeugen. Kartenzeichen, deren Gerätelink so gelöscht wurde, sind wieder manuell verortet.

## Nudges
> `UBIQUITOUS_LANGUAGE.md` anpassen: Gerätelinks sind entfernbar, und Abschließen löscht Geräte- und Ansichtslinks.

## Context
- **Gerätelink storage.** The token is `map_symbols.device_link_token`
  (nullable). `generateDeviceLink(db, id)` in
  `src/server/mapsymbols/map-symbols.ts` sets a new one;
  `resolveDeviceAccess(db, token)` and `reportPosition` only accept a token
  whose Einsatz is `active`. Nothing sets the column back to `NULL` today.
- **Ansichtslinks** are rows of `view_links` (`src/server/viewlinks/view-links.ts`:
  `createViewLink`, `listViewLinks`, `deleteViewLink`, `resolveViewAccess`,
  which also requires an `active` Einsatz).
- **"Zugang beendet"** is `src/map/DeviceClosed.tsx`. `src/app/device/[token]/page.tsx`
  and `src/app/view/[token]/page.tsx` render it when the token does not
  resolve. An open device or view refreshes on every live event
  (`ReadOnlySituationMap` → `router.refresh()`), so a change published on the
  Einsatz's SSE bus makes an open device re-render the page and show
  "Zugang beendet" once its token no longer resolves. `operationAction`
  (`src/app/operations/[id]/operation-action.ts`) publishes after every
  successful run; `closeOperationAction` publishes through
  `revalidateStatusChange` → `revalidateOperation`.
- **The Gerätelink panel.** `src/map/DeviceLinkPanel.tsx` shows the link, QR
  code and "Gerätelink neu generieren" (with a `ConfirmationModal`) when there
  is a token, else "Gerätelink erzeugen". It is rendered by
  `src/map/SymbolDetailModal.tsx` with `onGenerate={() =>
  onGenerateDeviceLink(symbol.id)}`. The callback comes down
  `src/app/operations/[id]/page.tsx` (`generateDeviceLinkAction.bind(null,
  operation.id)`) → `SituationWorkspace` (props extend
  `SituationMapViewProps`) → `src/map/SituationMapView.tsx` →
  `SymbolDetailModal`. Test defaults for workspace props live in
  `src/map/SituationWorkspace.fixtures.tsx`.
- **The Ansichtslink panel** (`src/map/ViewLinkPanel.tsx`) always offers
  "Ansichtslink erzeugen"; with no rows it simply lists none.
- **Closing.** `closeOperation` in `src/server/operations/operation-lifecycle.ts`
  runs `transition` in a transaction: lock the Einsatz row, check the status,
  set it, append the ETB milestone. The menu item "Abschließen" in
  `src/app/operations/OperationLifecycleActions.tsx` calls `onClose()` directly
  (no confirmation); `closeOperationAction` returns `Promise<void>`.
  `ConfirmationModal` (`src/app/ConfirmationModal.tsx`) needs
  `onConfirm: () => Promise<ActionResult>`.
- **Tests that pin the old behaviour and change here.**
  `src/server/mapsymbols/map-symbols.test.ts` "denies reports for a closed
  operation and accepts again once reopened" and
  `src/server/viewlinks/view-links.test.ts` (the `resolveViewAccess` test that
  reopens and expects access again) assert that an old link works again after
  "Wieder öffnen" — the opposite of AC-12. The "Abschließen" tests in
  `OperationLifecycleActions.test.tsx` and `OperationsOverview.test.tsx` expect
  `onClose` right after the menu click.
- **Action test pattern.** `src/app/operations/[id]/view-link-actions.test.ts`
  (DB, faked cookies, `subscribeOperation` to observe the publish). There is
  no `map-symbol-actions.test.ts` yet.

## Plan
1. **Red: removing a Gerätelink ends the device's access.** New
   `src/app/operations/[id]/map-symbol-actions.test.ts` (harness as in
   `view-link-actions.test.ts`). A logged-in user calls
   `removeDeviceLinkAction(operationId, symbolId)` on a Kartenzeichen with a
   Gerätelink: the result is `{}`; a `subscribeOperation` listener was called
   once (an open device refreshes); `await DevicePage({ params:
   Promise.resolve({ token: oldToken }) })` equals `<DeviceClosed />`; the
   Kartenzeichen keeps its position and composition and its
   `deviceLinkToken` is `null`. Without a session the call is refused and the
   link stays. Proof: fails, the action does not exist.
2. **The domain and the action.** Add `removeDeviceLink(db, id)` to
   `src/server/mapsymbols/map-symbols.ts` (`UPDATE map_symbols SET
   device_link_token = NULL WHERE id = $1`) and `removeDeviceLinkAction` to
   `src/app/operations/[id]/map-symbol-actions.ts` through `operationAction`,
   like `generateDeviceLinkAction`. Add it to `userGuardedActions` in
   `src/app/auth-enforcement.test.ts`. Proof: a repository test in
   `map-symbols.test.ts` (token gone, `resolveDeviceAccess(old)` null, a new
   `generateDeviceLink` works again); step 1 green.
3. **Red, then green: the panel offers it.** In
   `src/map/DeviceLinkPanel.test.tsx`: with a token there is a "Gerätelink
   entfernen" button; clicking it opens a confirmation and calls `onRemove`
   only after confirming, not on cancel; a returned error shows in the open
   confirmation. Without a token there is no such button. Add `onRemove: () =>
   Promise<ActionResult>` to `DeviceLinkPanel` and a second
   `ConfirmationModal` next to the regenerate one (`stackId`
   `"geraetelink-entfernen"`, title "Gerätelink entfernen", confirm label
   "Entfernen", text: "Der Link funktioniert sofort nicht mehr. Ein Gerät,
   das ihn offen hat, zeigt „Zugang beendet“."). Proof: the new tests fail,
   then pass.
4. **Wire it to the Lagekarte.** Add `onRemoveDeviceLink: (id: string) =>
   Promise<ActionResult>` to `SymbolDetailModal`, `SituationMapViewProps` /
   `SituationMapView` and the fixture defaults in
   `src/map/SituationWorkspace.fixtures.tsx`; bind
   `removeDeviceLinkAction.bind(null, operation.id)` in
   `src/app/operations/[id]/page.tsx`. Proof: a test in
   `src/map/SymbolDetailModal.test.tsx` that, for a Kartenzeichen with a
   token, confirming "Gerätelink entfernen" calls `onRemoveDeviceLink` with its
   id and the detail stays open; rerendered with `deviceLinkToken: null` it
   offers "Gerätelink erzeugen" (AC-11). `npm run check` (tsc) catches a
   missing prop on the way.
5. **Red: closing ends every old link, also after reopening.** New or
   extended `src/app/operations/lifecycle-actions.test.ts` (ticket 06 may
   already have created it): a logged-in user calls `closeOperationAction` on
   an Einsatz with a Gerätelink and an Ansichtslink. It publishes once, and
   afterwards both `DevicePage` and `ViewPage` (`src/app/view/[token]/page.tsx`)
   for the old tokens equal `<DeviceClosed />`, also after
   `reopenOperationAction`; the Kartenzeichen's `deviceLinkToken` is `null`
   and `listViewLinks` is empty, so the panels offer to create new ones.
   Proof: fails after `reopenOperationAction` (old links work again today).
6. **Red: the transition, at the domain.** In
   `src/server/operations/operation-lifecycle.test.ts`: closing an Einsatz with
   two Kartenzeichen with Gerätelinks and two Ansichtslinks leaves every
   `deviceLinkToken` `null` and no Ansichtslink; another Einsatz's links stay;
   closing an already closed Einsatz changes nothing; after reopening, a newly
   generated Gerätelink and a new Ansichtslink work. Rewrite the two old tests
   named in Context to this behaviour. Proof: the new and rewritten tests
   fail.
7. **Delete the links in the transition.** In `closeOperation`'s transaction,
   after the status change, `UPDATE map_symbols SET device_link_token = NULL
   WHERE operation_id = $1` and `DELETE FROM view_links WHERE operation_id =
   $1` (small functions next to `removeDeviceLink` / in `view-links.ts`, called
   with the transaction's `tx`). Only the `active → closed` transition does
   this; `reopenOperation` does not. Proof: steps 5 and 6 green.
8. **Red, then green: "Abschließen" asks first.** In
   `src/app/operations/OperationLifecycleActions.test.tsx`: clicking
   "Abschließen" opens a dialog titled `Einsatz „‹Name›“ abschließen` whose
   text says "Dabei werden alle Gerätelinks und Ansichtslinks dieses
   Einsatzes gelöscht."; `onClose` is called only after its "Abschließen"
   button, not on "Abbrechen". Add a `ConfirmationModal` for it in
   `OperationLifecycleActions.tsx` with `onConfirm={async () => { await
   onClose(); return {}; }}` (or change `closeOperationAction` to return
   `ActionResult` — builder's choice, both keep the props simple). Update the
   "Abschließen" test in `src/app/operations/OperationsOverview.test.tsx` to
   confirm the dialog. Proof: the new tests fail before the modal exists.
9. **Glossary.** In `UBIQUITOUS_LANGUAGE.md`: **Gerätelink** – "Neu
   generierbar und entfernbar", drop "nicht löschbar"; both **Gerätelink** and
   **Ansichtslink** say that Abschließen des Einsatzes alle Gerätelinks und
   Ansichtslinks löscht und sie auch nach „Wieder öffnen" ungültig bleiben.
   Proof: read the diff.
10. **Check.** `npm run check` green. In the browser (`run-einsatz` skill):
    open a Gerätelink in a second tab, remove it in the Lageansicht, and
    watch the second tab switch to "Zugang beendet" without reloading; close
    the Einsatz via the confirmation, reopen it, and check that the old
    device and view links show "Zugang beendet" and the panels offer
    "Gerätelink erzeugen" / "Ansichtslink erzeugen".

Decided here: the names `removeDeviceLink` / `removeDeviceLinkAction` /
`onRemoveDeviceLink`, after the domain action "Gerätelink entfernen"; the
confirmation texts above. Removing a Gerätelink leaves the Kartenzeichen's
position and Positionsquelle as they are (nothing in AC-11 asks to reset
them).

## Not here
- Live connections (SSE) of removed or deleted links closing within 30
  seconds (AC-18), and per-link connection limits: ticket 15.
- Hidden KML-Ebenen and Bild-Overlays in Ansichts- and Geräteansicht (AC-13):
  ticket 16.
- Checking that a Kartenzeichen belongs to the given Einsatz (AC-23): ticket
  17 adds `AND operation_id = $n` to `removeDeviceLink` with the other
  Kartenzeichen updates.
- The Datenschutzerklärung's sentence about links being deleted on closing:
  ticket 20.
- Ablaufdatum für Links und eine Anzeige, wann ein Link zuletzt benutzt wurde.
- Gehashte Gerätelink- und Ansichtslink-Tokens.
- Ein abgeschlossener Einsatz bleibt bearbeitbar; Abschließen sperrt nichts außer den Links.

## Left standing
- **Review should-fix not fixed: the Positionsquelle stays "Live (Gerät)".**
  `removeDeviceLink` and `removeAllDeviceLinks` only clear the token. A
  Kartenzeichen whose device had reported keeps `position_source = 'device'`
  after its Gerätelink is removed, or after "Abschließen". Its panel then shows
  "Gerätelink erzeugen" right under "Positionsquelle: Live (Gerät) – zuletzt
  gemeldet …", and the marker later fades as if the device had gone silent.
  The plan decided this on purpose ("leaves the Kartenzeichen's position and
  Positionsquelle as they are"), so I didn't change it. But it contradicts the
  glossary's **Kartenzeichen** entry, "Ohne Gerätelink immer manuell
  verortet". Acceptance should decide which one gives way. If it is the
  behaviour, the fix is to add `position_source = 'manual'` to both UPDATEs.
- **"Ohne Neuladen" is proven in two halves.** The tests show that removing a
  Gerätelink and closing an Einsatz each publish once on the Einsatz's bus, and
  that `DevicePage`/`ViewPage` then render `<DeviceClosed />`. That an open
  page refreshes on the event was not tested here; the reviewer saw it in the
  running app. An open Gerätelink page (phone, 390×844) switched to "Zugang
  beendet" after "Gerätelink entfernen", and an open Ansichtslink page did the
  same after "Abschließen". Both happened without reloading.
- **Browser check (plan step 10):** I didn't do it myself; the reviewer drove
  it at 1280×800 and 390×844. After "Abschließen" and "Wieder öffnen", the old
  Gerätelink and Ansichtslink still showed "Zugang beendet", and a position
  report over the old token got 403. The Teilen dialog showed "Noch kein
  Ansichtslink", and the Kartenzeichen panel offered "Gerätelink erzeugen".
  Both confirmations fit at both sizes.
- **Plan detail: the close confirmation has a second sentence.** After the
  required "Dabei werden alle Gerätelinks und Ansichtslinks dieses Einsatzes
  gelöscht.", it also says "Sie funktionieren auch nach „Wieder öffnen“ nicht
  mehr." Its confirm button keeps `ConfirmationModal`'s default red, because
  deleting the links can't be undone. `closeOperationAction` still returns
  `Promise<void>`; the modal wraps it (`await onClose(); return {};`).
- **Plan detail: the old tests became two each.** In `view-links.test.ts`
  and `map-symbols.test.ts`, the reopen tests now use a link created while the
  Einsatz is closed (no access) and reopened (access). That keeps the
  `status = 'active'` check pinned, because a closed Einsatz stays editable
  and can still get new links. A second test in each shows that a link from
  before closing stays dead after reopening. I also added a workspace-level
  test (`SituationWorkspace.symbols.test.tsx`) that shows
  `onRemoveDeviceLink` is passed through `SituationMapView`.
- **Tests that passed before their code existed:** the panel test "is not
  offered when there is no device link" guards that the button is absent, so
  it was green from the start. In `SymbolDetailModal.test.tsx`, the cancel
  cases of the new "removing the device link" confirmation row were also green
  before the wiring, because the panel already rendered the button. The tests
  that confirm the dialog failed first, as they should.

