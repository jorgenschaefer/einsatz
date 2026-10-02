---
criteria:  CRITERIA.md
closes:    AC-24, AC-25
advances:
after:
status:    ready
attempts:  0
---

## Build
The login limit holds under concurrent requests and across an IPv6 /64. An attempt is counted before the password is checked, not after, and the counter is keyed by the /64 for IPv6 addresses. The check of the current password when a user changes their password goes through the same limiter.

## Done when
> **AC-24** Von einer IP-Adresse aus – bei IPv6 einem /64 – werden in 5 Minuten höchstens 5 Fehlversuche je Nutzername und 20 insgesamt geprüft, auch bei gleichzeitigen Anfragen; jeder weitere Versuch bekommt „Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.".

> **AC-25** Die Prüfung des aktuellen Passworts beim Passwortwechsel unterliegt demselben Limit.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
**Today.** `LoginRateLimiter` (`src/server/auth/rate-limit.ts`) keeps timestamps per key in a `Map`: `pair:<ip>:<username lower-case>` (budget 5) and `ip:<ip>` (budget 20), with a 5 minute window. `isBlocked` reads and `recordFailure` writes; `resetPair` clears the pair after a success, and the IP counter deliberately stays. There is one process-wide instance, `loginRateLimiter`, in `src/server/auth/rate-limit-instance.ts`, pinned to `globalThis`.

`attemptLogin(db, limiter, ip, username, password)` in `src/server/auth/login.ts` does `isBlocked` → `await authenticate(...)` (bcrypt, also against `DUMMY_PASSWORD_HASH` for an unknown user) → `recordFailure` or `resetPair`. Concurrent requests all pass `isBlocked` before any of them records, so with enough parallel requests every one gets a bcrypt check. `loginAction` (`src/app/login/actions.ts`) gets the IP from `clientIpFromForwardedFor` (`src/server/http/client-ip.ts`, rightmost `X-Forwarded-For` entry, `"local"` when missing) and maps `rate-limited` to the message in AC-24.

`changePasswordAction` (`src/app/account/actions.ts`) calls `changePassword(db, id, currentPassword, newPassword)` (`src/server/auth/account-admin.ts`). That function verifies the current password with bcrypt and throws `ValidationError("Das aktuelle Passwort ist nicht korrekt.")`, with no limit at all.

**Design (from the slicing).** Reserve, then release. Checking and recording happen in one synchronous call with no `await` in between, so in single-threaded Node no other request can slip into the gap. A success gives the reservation back, so successes still do not count as failures. If the check itself throws (database down), the reservation is also given back: that was no failed attempt.

**Decided in this ticket:**
- The limiter normalises the IP for both keys, so every caller gets the same rule. An IPv6 address is keyed by its first four hextets, after expanding `::`. An IPv4-mapped address (`::ffff:203.0.113.7`) counts as its IPv4. Anything that is not an IP (`"local"`) stays as it is.
- AC-25's "demselben Limit" means the same counters. A failed current password and a failed login for the same IP and username count together, through the same `loginRateLimiter`. The key is the signed-in user's username.
- The message lives in one constant next to the limiter and is used by both actions.

## Plan
1. **AC-24 as tests, red.** New `src/app/login/actions.test.ts` (ticket 13 also creates it; the two are not ordered, so whichever is built second extends the existing file and merges the `next/headers` mock: 13 needs a cookie jar, this ticket a per-test `X-Forwarded-For`). Mock `next/headers` (an `X-Forwarded-For` per test) and `next/navigation` the way `src/app/auth-enforcement.test.ts` does, use a real `freshDb()` with a seeded user, and a distinct IP per test, because the limiter is process-wide.
   - 30 concurrent `loginAction` calls with a wrong password for one username → exactly 5 answer "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen." and 25 the AC-24 message.
   - 30 concurrent calls with 30 different usernames → exactly 20 failures and 10 AC-24 messages.
   - After 5 failures the correct password also gets the AC-24 message.
   - From `2001:db8:1:2::a`, `2001:db8:1:2:ffff::b` and so on, the 6th failure is refused. From `2001:db8:1:3::a` it is still checked.
   - `::ffff:203.0.113.7` and `203.0.113.7` share one counter.
   - After the 5-minute window (`vi.setSystemTime`) checking starts again.

   *Proof:* red. The concurrent case reports 30 failures, the /64 case is never refused.
2. **Reserve in the limiter.** In `src/server/auth/rate-limit.ts`, replace `isBlocked` and `recordFailure` with one call, e.g. `tryReserve(ip, username, now)`. It returns `null` when either budget is used up, or a reservation that has already been recorded and can be released. Keep `resetPair` and the sweep. Remove what is left unused, and rewrite `src/server/auth/rate-limit.test.ts` against the new API: budgets, window, pair and IP independent, release.
   *Proof:* `rate-limit.test.ts` green.
3. **IP normalisation.** In the limiter's key building, a pure helper (e.g. `limiterAddress(ip)` in `rate-limit.ts`).
   *Proof:* its own cases in `rate-limit.test.ts`: full and `::`-compressed IPv6, the same /64 in different spellings, a different /64, IPv4-mapped in dotted and hex form, plain IPv4, `"local"`, upper-case hex.
4. **attemptLogin uses the reservation.** `attemptLogin` (`src/server/auth/login.ts`): reserve → `rate-limited` if none. On failure keep the reservation; on success release it and `resetPair`; if `authenticate` throws, release and rethrow.
   *Proof:* step 1 green; `src/server/auth/attempt-login.test.ts` adjusted and green, with a case where `authenticate` throws and the attempt does not count.
5. **AC-25 as a test, red.** New `src/app/account/actions.test.ts` (tickets 12 and 14 also create it; whichever is built later extends the existing file and merges its mocks rather than replacing them). Signed in as `anna` from one IP:
   - 5 `changePasswordAction` calls with a wrong current password → "Das aktuelle Passwort ist nicht korrekt." each; the 6th, even with the right current password, gets the AC-24 message, and the password is unchanged.
   - 3 failed logins plus 2 wrong current passwords from the same IP for `anna` → the next attempt of either kind is refused.

   *Proof:* red: the 6th call changes the password.
6. **changePassword through the limiter.** `changePasswordAction` reads the IP like `loginAction` and passes `loginRateLimiter` and the IP to `changePassword`. That function reserves for `(ip, user.username)` before `verifyPassword`, throws `ValidationError` with the shared message when refused, keeps the reservation on a wrong password, and releases it and resets the pair on a correct one.
   *Proof:* step 5 green; the `changePassword` tests in `src/server/auth/account-admin.test.ts` adjusted and green.
7. `npm run check` green.

## Not here
- From *Out of scope*: a login limit per username across all IPs, CAPTCHA, locking accounts. The limit stays per IP (agreed design: „Das Login-Limit bleibt je IP.").
- From *Out of scope*: whether the client IP behind Caddy is correct, and other containers reaching port 3000 directly. Those belong to `../drk-barmbek`; `clientIpFromForwardedFor` stays as it is.
- The new-password rules (common passwords, username, 72 bytes): ticket `12-passwoerter-und-erst-admin`. It also touches `changePassword` and `src/app/account/actions.test.ts`.
- Sessions (hashing, `__Host-` cookie, ending the previous session on login): ticket `13-sitzungs-token`.

## Left standing
