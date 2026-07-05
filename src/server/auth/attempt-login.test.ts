import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import { attemptLogin } from "./login";
import { hashPassword } from "./password";
import { LoginRateLimiter } from "./rate-limit";
import { insertUser } from "./users";

async function seedAnna(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertUser(db, {
    username: "anna",
    passwordHash: await hashPassword("a-good-password"),
    role: "user",
  });
}

describe("attemptLogin", () => {
  it("returns ok with the user for correct credentials", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const result = await attemptLogin(
      db,
      new LoginRateLimiter(),
      "k",
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "ok", user });
    await db.close();
  });

  it("returns invalid and records a failure for wrong credentials", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(3, 1000);
    const result = await attemptLogin(
      db,
      limiter,
      "k",
      "anna",
      "wrong-password!",
    );
    expect(result).toEqual({ status: "invalid" });
    expect(limiter.isBlocked("k", 0)).toBe(false); // one failure, not yet blocked
    await db.close();
  });

  it("blocks once the failure threshold is reached and short-circuits before authenticating", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 60_000);
    await attemptLogin(db, limiter, "k", "anna", "wrong-1!!!!!!");
    await attemptLogin(db, limiter, "k", "anna", "wrong-2!!!!!!");
    // Even the correct password is now rejected as rate-limited.
    const result = await attemptLogin(
      db,
      limiter,
      "k",
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "rate-limited" });
    await db.close();
  });

  it("resets the failure count on a successful login", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 60_000);
    await attemptLogin(db, limiter, "k", "anna", "wrong!!!!!!!");
    await attemptLogin(db, limiter, "k", "anna", "a-good-password"); // success resets
    await attemptLogin(db, limiter, "k", "anna", "wrong!!!!!!!"); // one failure again
    const result = await attemptLogin(
      db,
      limiter,
      "k",
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
    await db.close();
  });
});
