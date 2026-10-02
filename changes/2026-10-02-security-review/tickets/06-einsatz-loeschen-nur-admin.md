---
criteria:  CRITERIA.md
closes:    AC-10
advances:
after:
status:    done
attempts:  1
---

## Build
Only an Admin can delete an Einsatz, and only a closed one. The server
refuses everything else and deletes nothing. The card menu in the
Einsatzübersicht shows "Einsatz löschen" only to Admins, and only on a closed
Einsatz.

## Done when
> **AC-10** „Einsatz löschen" sehen nur Admins, und nur bei einem abgeschlossenen Einsatz. Ruft ein Nicht-Admin die Löschung trotzdem auf, oder wird ein laufender Einsatz gelöscht, ist danach nichts gelöscht.

## Nudges

## Context
- **The action.** `deleteOperationAction(operationId)` in
  `src/app/operations/lifecycle-actions.ts` calls only `requireUser()`, then
  `deleteOperation(getDb(), operationId)`, `publishOperationChanged` and
  `redirect("/operations")`. It returns `Promise<never>`. It is bound in
  `src/app/operations/page.tsx` as `onDeleteOperation`.
- **The domain function.** `deleteOperation(db, id)` in
  `src/server/operations/delete-operation.ts` calls `deleteOperationRow`
  (`DELETE FROM operations WHERE id = $1`, in
  `src/server/operations/operations.ts`; journal, Kartenobjekte, Stellen
  cascade) and then `deleteOperationUploads(id)`. It does not look at the
  status.
- **Admin check.** `requireAdmin()` in `src/server/auth/current-user.ts`
  redirects anonymous callers to `/login` and non-Admins to `/operations`
  (it throws `NEXT_REDIRECT`), so nothing after it runs.
- **Status.** `operations.status` is `'active'` or `'closed'`; "Abschließen"
  sets `closed` (`closeOperation` in
  `src/server/operations/operation-lifecycle.ts`). A closed Einsatz stays
  editable; that is not changed here.
- **The UI.** `src/app/operations/OperationLifecycleActions.tsx` renders the
  card's "⋯" menu: "Abschließen" or "Wieder öffnen", a `Menu.Divider`, and
  "Einsatz löschen" for everyone, with a `ConfirmationModal` ("Endgültig
  löschen") that calls `onDelete(): Promise<ActionResult>` and shows a
  returned `error` in the open dialog. `src/app/operations/OperationsOverview.tsx`
  already receives `isAdmin` (from `page.tsx`, `user.role === "admin"`) and
  uses it only for the Nutzerverwaltung link.
- **Tests that pin today's behaviour and change here.**
  `src/app/auth-enforcement.test.ts` lists `deleteOperationAction` under
  `userGuardedActions`; it moves to `adminGuardedActions` (anonymous →
  `/login`, non-Admin → `/operations`).
  `src/server/operations/delete-operation.test.ts` deletes active Einsätze
  (`createOperation` makes them active); those tests close them first.
  `OperationLifecycleActions.test.tsx` and `OperationsOverview.test.tsx`
  open the delete dialog on active Einsätze without `isAdmin`; they get a
  closed Einsatz and an Admin.
- **Test pattern for the action.** `src/app/operations/[id]/view-link-actions.test.ts`:
  `freshDb()`, `vi.mock("@/server/db/pg")`, `next/headers` cookies faked from
  a session row; `src/app/auth-enforcement.test.ts` additionally fakes
  `next/navigation`'s `redirect` to throw an error carrying `redirectTo`.

## Plan
1. **Red: the action refuses and deletes nothing.** New
   `src/app/operations/lifecycle-actions.test.ts` (DB test, harness as in
   `auth-enforcement.test.ts`, with `deleteOperationUploads`' directory under
   a temp `UPLOADS_DIR` as in `delete-operation.test.ts`). Cases:
   - a logged-in non-Admin calls `deleteOperationAction` on a closed Einsatz:
     the call rejects with the `/operations` redirect, and the Einsatz, its ETB
     entries and its upload directory are still there;
   - an Admin calls it on an active Einsatz: the Einsatz and its ETB are still
     there and the result is an `{ error }`;
   - an Admin calls it on a closed Einsatz: the Einsatz is gone and the call
     redirects to `/operations` (today's success path).
   Proof: the first two fail (today any user deletes any Einsatz).
2. **Admin only.** Replace `requireUser()` with `requireAdmin()` in
   `deleteOperationAction`. Move the `deleteOperationAction` row in
   `src/app/auth-enforcement.test.ts` from `userGuardedActions` to
   `adminGuardedActions`. Proof: step 1's non-Admin case and the
   auth-enforcement table are green.
3. **Closed only, decided in the delete itself.** Change `deleteOperationRow`
   to `DELETE FROM operations WHERE id = $1 AND status = 'closed'` and return
   whether a row was deleted; `deleteOperation` returns that and removes the
   upload directory only when the row went. In the action, a `false` returns
   `{ error: "Nur ein abgeschlossener Einsatz lässt sich löschen." }` without
   publishing or redirecting; the return type becomes `Promise<ActionResult>`
   (success still redirects). The condition sits in the `DELETE` so a
   "Wieder öffnen" between check and delete cannot slip through. Proof: in
   `src/server/operations/delete-operation.test.ts`, a new test that an active
   Einsatz is not deleted and keeps its upload directory; the existing tests
   close the Einsatz before deleting and stay green. Step 1's active case is
   green.
4. **Red, then green: the menu.** In
   `src/app/operations/OperationLifecycleActions.test.tsx`, test that
   "Einsatz löschen" is absent for a non-Admin (active and closed) and for an
   Admin on an active Einsatz, and present for an Admin on a closed one; move
   the existing delete-dialog tests to `status: "closed"` with the Admin
   prop. Add an `isAdmin: boolean` prop to `OperationLifecycleActions` and
   render the divider, the "Einsatz löschen" item and its `ConfirmationModal`
   only when `isAdmin && status === "closed"`. Proof: the new tests fail, then
   pass.
5. **The overview passes it on.** In `src/app/operations/OperationsOverview.tsx`,
   pass `isAdmin` to each `OperationLifecycleActions`. In
   `src/app/operations/OperationsOverview.test.tsx`, a non-Admin sees no
   "Einsatz löschen" on a closed card; the two existing delete tests render
   with `isAdmin` and a closed Einsatz. Proof: the new test fails before the
   prop is passed.
6. **Check.** `npm run check` green. In the browser (`run-einsatz` skill), as
   the seeded Admin: an active Einsatz's menu has no "Einsatz löschen", a
   closed one has it and deletes; as a non-Admin user, no card has it.

Decided here: the refusal for an active Einsatz is the message "Nur ein
abgeschlossener Einsatz lässt sich löschen."; no user normally sees it, since
the menu does not offer the deletion there.

## Not here
- Live connections of a deleted Einsatz ending within 30 seconds (AC-18):
  ticket 15 (`15-live-verbindungen-begrenzen`).
- What "Abschließen" does to Gerätelinks and Ansichtslinks, and its
  confirmation: ticket 07.
- UUID checks on the `operationId` argument (AC-22): ticket 18.
- The Datenschutzerklärung's text about retention until an Admin deletes:
  ticket 20.
- Rechte je Einsatz; das flache Vertrauensmodell bleibt.
- Automatische Löschfristen.
- Ein abgeschlossener Einsatz bleibt bearbeitbar; Abschließen sperrt nichts außer den Links.

## Left standing
- **Departed from the plan: a refused delete refreshes the overview, and the
  dialog is no longer tied to the menu item.** The plan only returned the
  error. Review found the overview then still showed the Einsatz as closed and
  still offered "Einsatz löschen", right next to "Nur ein abgeschlossener
  Einsatz lässt sich löschen.". So the refusal now calls
  `revalidatePath("/operations")`. Only the menu item checks
  `isAdmin && status === "closed"`; the `ConfirmationModal` is always
  rendered, so the refusal stays visible in the open dialog while the card
  behind it turns "aktiv". The test pins this by watching the faked
  `revalidatePath` (Next's cache boundary), not the rendered overview.
- **Departed from the plan, step 5's proof:** "a non-Admin sees no deletion"
  in `OperationsOverview.test.tsx` passed before `isAdmin` was passed on,
  because a prop that is not passed is falsy. The admin delete tests there
  were the ones that failed first. `tsc` would also have caught the missing
  required prop.
- **Also changed, outside the plan's list:** `image-overlays.test.ts` and
  `view-links.test.ts` call `deleteOperationRow` on an active Einsatz to test
  the cascade. They now close it first, and their assertions are unchanged.
- **Same refusal when the Einsatz is already gone:** if another Admin deleted
  it first, the action also says "Nur ein abgeschlossener Einsatz lässt sich
  löschen.". The refresh removes the card, and with it the dialog, so the
  message disappears straight away. I didn't add a separate message.
- **Browser check (plan step 6):** I didn't do it myself. Both review rounds
  drove `/operations` per `run-einsatz` at 390 px and 1440/1920 px. As Admin,
  an active Einsatz had no "Einsatz löschen" and a closed one had it and
  deleted. As a non-Admin, no card had it. An Einsatz reopened behind an open
  dialog was refused, nothing was deleted, and the card showed "aktiv".
