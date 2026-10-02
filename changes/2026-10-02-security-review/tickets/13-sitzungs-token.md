---
criteria:  CRITERIA.md
closes:    AC-31, AC-32, AC-33
advances:
after:
status:    ready
attempts:  0
---

## Build
Session tokens are stored only as their SHA-256 hash, a new login in a browser
ends that browser's previous session, and the session cookie is called
`__Host-einsatz_session` in production.

## Done when
> **AC-31** Meldet man sich in einem Browser neu an, ist die vorherige Sitzung dieses Browsers beendet.

> **AC-32** Aus dem Inhalt der Datenbank lässt sich keine gültige Sitzung gewinnen.

> **AC-33** Das Sitzungs-Cookie heißt in Produktion mit dem Präfix `__Host-`.

## Nudges
> Session-Tokens als SHA-256 speichern; die Migration beendet alle bestehenden Sitzungen.

## Context
- **Today:** `createSession` (`src/server/auth/login.ts`) makes a 32-byte
  base64url token and `insertSession` (`src/server/auth/sessions.ts`) stores
  it as-is in `sessions.token` (primary key, `001_init.sql`).
  `findUserBySessionToken`, `deleteSession` look rows up by the plain token;
  `deleteSessionsForUser` and `deleteExpiredSessions` don't need the token.
  Whoever reads the `sessions` table can paste a token into a cookie and is
  logged in - that is what AC-32 removes.
- **Cookie:** `SESSION_COOKIE = "einsatz_session"` in
  `src/server/auth/current-user.ts`; `setSessionCookie` sets it `httpOnly`,
  `sameSite: "lax"`, `path: "/"`, `secure` only when
  `NODE_ENV === "production"`. Readers of the name: `getCurrentUser`,
  `logoutAction` (`src/app/account/actions.ts`). `loginAction`
  (`src/app/login/actions.ts`) and `changePasswordAction` set it.
- **`__Host-` needs `Secure`, `Path=/` and no `Domain`**; browsers drop a
  `__Host-` cookie without `Secure`. Dev runs on plain http (`npm run dev`,
  phones in the LAN by IP). Decided here: **production uses
  `__Host-einsatz_session` with `Secure`; development and test keep
  `einsatz_session` without `Secure`**, the same split the `secure` flag
  already makes. The name therefore becomes a function of `NODE_ENV`
  (`sessionCookieName()`), not a module constant, so a test can stub the
  environment per test.
- **Today `loginAction` ignores an existing cookie**: the old session stays
  valid until it expires (AC-31).
- **Agreed design:** "Session-Tokens werden gehasht gespeichert, Link-Tokens
  nicht." Gerätelink and Ansichtslink tokens stay as they are.
- **Tests:** `src/app/auth-enforcement.test.ts` (394 lines) and many action
  tests insert sessions through `insertSession(db, { token, … })` and mock
  `cookies().get` to return that token whatever the name. Keeping the raw
  token as `insertSession`'s argument and hashing inside `sessions.ts` keeps
  them all working unchanged. Don't add to `auth-enforcement.test.ts`; new
  tests go in new files.
- Migrations are numbered `NNN_name.sql` in `src/server/db/migrations/`
  (last today: `015_station_named_at.sql`); other tickets of this change add
  migrations too - take the next free number at build time.

## Plan
1. **AC tests first, red.** New `src/app/login/actions.test.ts` (ticket 11 also
   creates it; the two are not ordered, so whichever is built second extends
   the existing file and merges the `next/headers` mock: 11 needs a per-test
   `X-Forwarded-For`, this ticket a cookie jar), harness like
   `auth-enforcement.test.ts`: `getDb` mocked to a `freshDb()`, `next/headers`
   mocked with a small cookie jar (a `Map` recording `set` with its options
   and `delete`), `redirect` throwing. A user exists with a known password.
   - AC-31: `loginAction` once, keep the jar's token; `loginAction` again with
     that cookie in the jar → `findUserBySessionToken(db, firstToken)` is
     `null`, the new token resolves; a session of the same user in *another*
     browser (inserted directly) still resolves.
   - AC-32: after `loginAction`, no column of any `sessions` row equals the
     cookie's token, and every stored text value put into the jar as the
     cookie gives `getCurrentUser()` → `null`.
   - AC-33: with `vi.stubEnv("NODE_ENV", "production")`, `loginAction` sets a
     cookie named `__Host-einsatz_session` with `secure: true`, `path: "/"`
     and no `domain`; `getCurrentUser()` reads it back.
   Proof: `npx vitest run src/app/login/actions.test.ts` fails on the
   assertions (old session still valid, raw token in the table, wrong name).
2. **Hash in the repository.** `src/server/auth/sessions.ts`: a private
   `hashSessionToken(token)` (`createHash("sha256")…digest("hex")`,
   `node:crypto`); `insertSession`, `deleteSession` and
   `findUserBySessionToken` take the raw token and use its hash. New
   migration `NNN_session_token_hash.sql`: `DELETE FROM sessions;` then
   `ALTER TABLE sessions RENAME COLUMN token TO token_hash;`. Proof:
   `src/server/auth/sessions.test.ts` - existing tests stay green; new test:
   the row's `token_hash` is not the token and is not accepted as a token.
   The `deleteExpiredSessions` test reads `SELECT token …` - switch it to
   counting rows or to `token_hash`. AC-32 test from step 1 green.
3. **Migration ends existing sessions.** Proof: new test in
   `src/server/db/migrations.test.ts` (or a new
   `src/server/db/session-token-hash-migration.test.ts`): apply migrations up
   to the one before, insert a session, apply the new one → `sessions` empty.
   `emptyDb()` from `src/test/db.ts` plus `migrate(db, loadMigrations()
   .filter(…))` gives the database before the new migration.
4. **Cookie name.** `src/server/auth/current-user.ts`: replace
   `SESSION_COOKIE` with `sessionCookieName()`
   (`"__Host-einsatz_session"` in production, else `"einsatz_session"`);
   `setSessionCookie`, `clearSessionCookie`, `getCurrentUser` and
   `logoutAction` use it. Proof: AC-33 test green; `npm run check` (tsc
   finds every former `SESSION_COOKIE` user).
5. **Login ends the browser's previous session.** `src/app/login/actions.ts`:
   on success, before `createSession`, read the current cookie (via a small
   `currentSessionToken()` in `current-user.ts`, also used by
   `logoutAction`) and `deleteSession` it. Only after the password check
   succeeded - a failed login leaves the session alone. Proof: AC-31 test
   green; add the case "failed login with a cookie keeps the old session".
6. `npm run check` green.

## Not here
- Idle timeout, `last_seen_at`, "Überall abmelden": `14-sitzungs-laufzeit`.
- Ending open Live-Verbindungen when a session ends:
  `15-live-verbindungen-begrenzen`.
- Login rate limit and the password check in `changePasswordAction`:
  `11-login-limit`; password rules: `12-passwoerter-und-erst-admin`.
- The cookie name in the Datenschutzerklärung (`src/app/datenschutz/page.tsx`
  says „einsatz_session") is rewritten in `20-datenschutzerklaerung`.
- Out of scope: "Gehashte Gerätelink- und Ansichtslink-Tokens." and
  "Konten sperren."

## Left standing
