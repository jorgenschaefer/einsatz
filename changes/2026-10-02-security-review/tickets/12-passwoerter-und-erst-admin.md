---
criteria:  CRITERIA.md
closes:    AC-26, AC-27, AC-28
advances:
after:
status:    done
attempts:  1
---

## Build
Passwords that are common, equal to the username, or longer than bcrypt reads are refused wherever a password is set. The first-admin seed no longer needs credentials once users exist, and `.env.example` stops shipping a password. Usernames are unique regardless of case, enforced by the database.

## Done when
> **AC-26** Beim Erst-Admin, beim Anlegen, Zurücksetzen und Wechseln wird ein Passwort mit einer Meldung abgelehnt, wenn es unter den 10.000 häufigsten Passwörtern ist, `change-me-please` lautet, dem Nutzernamen ohne Rücksicht auf Groß-/Kleinschreibung gleicht oder länger als 72 Byte ist.

> **AC-27** `.env.example` enthält kein Admin-Passwort. Gibt es schon Nutzer, startet der Container auch ohne `ADMIN_USERNAME` und `ADMIN_PASSWORD`.

> **AC-28** Ein Nutzername, der sich von einem vorhandenen nur in Groß-/Kleinschreibung unterscheidet, lässt sich nicht anlegen: „Dieser Nutzername ist bereits vergeben.".

## Nudges
> Die Liste häufiger Passwörter liegt als Datei im Repo (etwa die 10.000 häufigsten aus SecLists); keine Abhängigkeit.

> Ein eindeutiger Index auf `lower(username)`; die Migration bricht mit einer klaren Meldung ab, falls es schon Kollisionen gibt.

## Context
**Password rule today.** `assertPasswordPolicy(password)` in `src/server/auth/password.ts` checks only `MIN_PASSWORD_LENGTH` (12), and `hashPassword` calls it. The three production callers of `hashPassword`:
- `seedAdmin` (`src/server/auth/seed.ts`): the first admin.
- `createAccount` (`src/server/auth/account-admin.ts`): creating an account.
- `resetPassword` (same file): an admin resetting a password, and through `changePassword` a user changing their own.

The actions are `createAccountAction` / `resetPasswordAction` in `src/app/admin/users/actions.ts` (`guarded`: `requireAdmin`, `ValidationError` → `{ error }`) and `changePasswordAction` in `src/app/account/actions.ts`. `UserAdminPanel` and `ChangePasswordForm` already show `error`. About 12 test files call `hashPassword` to seed fixture users.

**Decided in this ticket:**
- The username rule needs the username, which `hashPassword` does not have. The check therefore becomes `assertPasswordPolicy(password, username)`, called explicitly by `seedAdmin`, `createAccount` and `resetPassword` (which looks the user up by id for the username; if the account no longer exists, behaviour stays as today). `hashPassword` only hashes. Every one of the four entry points is pinned by an AC-26 test, so a dropped check fails a test, and the fixture calls in the other test files stay as they are.
- The list is compared exactly, as AC-26 says ("unter den 10.000 häufigsten Passwörtern"), not case-folded.
- Proposed messages, wording for the approval:
  - "Dieses Passwort ist zu verbreitet. Bitte ein anderes wählen." (list and `change-me-please`)
  - "Das Passwort darf nicht dem Nutzernamen gleichen."
  - "Das Passwort darf höchstens 72 Byte lang sein (Umlaute zählen doppelt)."
- The list lives in `src/server/auth/common-passwords.txt`, one password per line, fetched once from SecLists (`Passwords/Common-Credentials/`, the 10k most common file; check the current path and name in the repository). SecLists is MIT licensed: keep its copyright and licence notice next to the file (e.g. `src/server/auth/common-passwords.LICENSE`). Read it once per process into a `Set`.
- Loading the file must work in three places: under `tsx` (`npm run db:seed`), under Vitest, and inside the Next server bundle. Server code is bundled by Turbopack, so a path built from `import.meta.url` may not point at the source tree. `src/` is copied into the runtime image (`Dockerfile`, `COPY --from=builder /app/src ./src`), and `process.cwd()` is the app root in all three. Try `new URL("./common-passwords.txt", import.meta.url)` first and check it in a production build (step 9). If the bundle breaks it, use `path.join(process.cwd(), "src/server/auth/common-passwords.txt")`, and say which one under `## Left standing`.

**Username uniqueness today.** `users.username` is `UNIQUE`, case-sensitive (`001_init.sql`). `createAccount` pre-checks with `findUserByUsername` (exact match) and throws "Dieser Nutzername ist bereits vergeben." The precedent for a case-insensitive unique name is `stations_operation_name_idx` on `lower(name)` (`011_stations.sql`), translated from `23505` in `rejectingDuplicateName` in `src/server/strength/stations.ts`. Login lookup (`findUserByUsername`) stays exact; AC-28 is about creating an account.

The migration is the next free number in `src/server/db/migrations/` when it is built. Tickets 13 and 14 also add migrations. Names only need to differ: `migrate` sorts by name and records each one.

**Seed and container today.** `docker-entrypoint.sh` runs `npm run db:migrate`, `npm run db:seed`, then the server, under `set -e`. `src/server/auth/seed-cli.ts` throws when `ADMIN_USERNAME` or `ADMIN_PASSWORD` is empty before it even looks at the database, so a container without them never starts. `docker-compose.prod.yml` passes both through from the environment, and an unset one arrives as an empty string. `.env.example` has `ADMIN_PASSWORD=change-me-please`. `README.md` says "at least 12 characters".

## Plan
1. **AC-26 as tests, red, where the password is set.**
   - New `src/app/admin/users/actions.test.ts`, mocked like `src/app/auth-enforcement.test.ts`, signed in as an admin. Each of these refused by `createAccountAction` and by `resetPasswordAction`, with a message and nothing stored:
     - a password from the list (pick one of 12+ characters so the length rule does not answer first, e.g. one found in the file)
     - `change-me-please`
     - the username in other case (`Anna-Maria-Admin` for user `anna-maria-admin`)
     - 73 bytes, e.g. 37 `ä`
   - The same four cases through `changePasswordAction` in `src/app/account/actions.test.ts` (tickets 11 and 14 also create it; whichever is built later extends the existing file and merges its mocks rather than replacing them).
   - The same through `seedAdmin` in `src/server/auth/seed.test.ts`.
   - Boundaries: exactly 72 bytes is accepted, and a 12-character password not on the list is accepted.

   *Proof:* red: every case is accepted today.
2. **The list file.** Add `src/server/auth/common-passwords.txt` and its licence notice, as decided above.
   *Proof:* `wc -l` shows 10,000 lines (or what the source file has; note the count under `## Left standing` if it differs); a `password.test.ts` case finds a known entry.
3. **The policy.** `assertPasswordPolicy(password, username)` in `src/server/auth/password.ts`, in this order: length below 12 → today's message; above 72 bytes (`Buffer.byteLength(…, "utf8")`); on the list or `change-me-please`; equal to the username after `toLowerCase()` on both. `hashPassword` stops checking. `seedAdmin`, `createAccount` and `resetPassword` call the policy with the username.
   *Proof:* step 1 green; `src/server/auth/password.test.ts` covers the rules and their boundaries; `account-admin.test.ts` and `seed.test.ts` stay green.
4. **AC-28 as a test, red.** In `src/app/admin/users/actions.test.ts`: with `anna` present, `createAccountAction("Anna", …)` returns "Dieser Nutzername ist bereits vergeben." and no second account exists. Two concurrent `createAccountAction` calls for `bob` and `Bob` → exactly one account.
   *Proof:* red: `Anna` is created.
5. **Migration.** New `src/server/db/migrations/0NN_username_lower_unique.sql`: a `DO` block that `RAISE EXCEPTION`s when `lower(username)` collides, naming the colliding usernames and saying to rename or delete one of each set before migrating again. After it, `CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username))`.
   *Proof:* `src/server/db/migrations.test.ts`: on `emptyDb()`, migrate up to the previous migration, insert `Anna` and `anna`, then `migrate` rejects with a message naming both, and the index does not exist (the transaction rolled back); without a collision the index exists.
6. **createAccount on the index.** Translate the unique violation on insert into "Dieser Nutzername ist bereits vergeben.", like `rejectingDuplicateName` in `src/server/strength/stations.ts`. Drop the exact-match pre-check, because the index decides, and only it is race-safe.
   *Proof:* step 4 green; the duplicate test in `account-admin.test.ts` stays green.
7. **AC-27: the seed without credentials.** `seedAdmin` takes `{ username?, password? }`. When users exist it does nothing, whatever is set. When there are none and either value is missing, it fails with a clear message: "ADMIN_USERNAME und ADMIN_PASSWORD müssen gesetzt sein, um den Erst-Admin anzulegen." `seed-cli.ts` passes the environment through, with an empty string counting as missing, and no longer throws before looking at the database.
   *Proof:* `seed.test.ts`: existing users and no credentials → resolves, nothing changes; empty database and no credentials → rejects with the message, no user. The existing idempotency tests stay green.
8. **`.env.example` and docs.** `ADMIN_PASSWORD=` with no value, and a comment that it is needed only for the first start and must not be one of the common passwords. Update `README.md` (Getting started, Configuration table: the password rules; the credentials are needed only while there are no users).
   *Proof:* `grep ADMIN_PASSWORD .env.example` shows no value.
9. **On a real server and container.**
   - `npm run build && npm start` with a dev `.env`: creating a user with a password from the list in the user administration (skill `run-einsatz`) shows the message, which proves the list loads inside the bundle.
   - `ADMIN_USERNAME= ADMIN_PASSWORD= npm run db:seed` against the dev database (which has users) exits 0.
   - `docker build` and a container start against a database with users, without the two variables, reaches "Ready".

   *Proof:* observations under `## Left standing`.
10. `npm run check` green.

## Not here
- The login limit and the limit on the current-password check: ticket `11-login-limit`. It also changes `changePassword` and `src/app/account/actions.test.ts`.
- `exec next start` in `docker-entrypoint.sh`, `USER node` and the other container hardening: ticket `19-container-haerten`. This ticket leaves the entrypoint as it is; the seed CLI's exit code is what changes.
- Username length (200) and type checks on these actions: ticket `25-einsatz-und-konten-eingaben` (AC-22 is closed by `18-eingaben-pruefen`).
- Case-insensitive login (`findUserByUsername`): not asked for; it stays exact.
- From *Out of scope*: locking accounts.

## Left standing

- **Review finding not fixed (should-fix): the list adds almost nothing above the length rule.** Only 10 of the SecLists entries are 12 characters or longer (`unbelievable`, `scandinavian`, `motherfucker` …); every other entry is already refused for being too short. In the running app the reviewer reset a password to `password1234` and it was accepted; `qwertyuiop12` and `123456789012` would be too. AC-26 names "die 10.000 häufigsten Passwörter" and the nudge names the SecLists 10k file, so picking a different list (e.g. a larger one filtered to 12+ characters, or normalised matching) is a decision for whoever owns the criterion, not this build. It is the one place where this ticket meets the letter of its criterion without much of the protection.
- **Review nit not fixed: `resetPassword` with an unknown id.** It skips the policy, hashes, updates no row and the action reports success (reachable when a second admin tab deleted the account first). The ticket says behaviour stays as today for a missing account, and today it already reported success; left as is.
- **Fixed beyond the plan:** the hints under "Start-Passwort" and "Neues Passwort" said only "Mindestens 12 Zeichen."; they now read "12 Zeichen bis 72 Byte, nicht der Nutzername, kein verbreitetes Passwort." (reviewer nit, pinned in `UserAdminPanel.test.tsx` and `ChangePasswordForm.test.tsx`). This change came after the review, so no second review round looked at it; I checked both screens at 390 px myself (the hint wraps to two lines, nothing cut off).
- **List file:** `10k-most-common.txt` from SecLists has 10,001 lines, all distinct, no blank lines; kept whole.
- **How the list is loaded (plan step 9): `path.join(process.cwd(), "src/server/auth/common-passwords.txt")`.** `new URL("./common-passwords.txt", import.meta.url)` passed Vitest but broke `next build` ("Failed to collect configuration for /account": the bundled `URL` was not accepted by `readFileSync`). With `process.cwd()` the build passes.
- **Step 9 observations:**
  - `npm run build` and `next start -p 3001` against the dev DB: creating `prod-bundle-test` with `unbelievable` in the user administration showed "Dieses Passwort ist zu verbreitet. Bitte ein anderes wählen." and created nothing.
  - `ADMIN_USERNAME= ADMIN_PASSWORD= npm run db:seed` against the dev DB (which has users, migrated with 016) exits 0.
  - `docker build` and a container run against the dev DB with `ADMIN_USERNAME=` and `ADMIN_PASSWORD=` empty: migrate, "Admin-Konto sichergestellt.", "✓ Ready", `/login` 200.
- **Order of refusals changed in `createAccount`:** the password policy now runs before the insert, so a taken username with a bad password reports the password rule first; only the unique index decides "Dieser Nutzername ist bereits vergeben.". The old case-sensitive `UNIQUE` on `users.username` stays; an exact duplicate trips it with the same code and message.
- **Dev `.env`:** the local `.env` still has `ADMIN_PASSWORD=change-me-please` for the existing dev admin. Not touched (not in the repo); the seed ignores it while users exist.

