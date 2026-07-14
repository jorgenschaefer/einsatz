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
  const IP = "10.0.0.1";

  it("returns ok with the user for correct credentials", async () => {
    const db = await freshDb();
    const user = await seedAnna(db);
    const result = await attemptLogin(
      db,
      new LoginRateLimiter(),
      IP,
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "ok", user });
    await db.close();
  });

  it("returns invalid and records a failure for wrong credentials", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(3, 1000, 1000);
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "wrong-password!",
    );
    expect(result).toEqual({ status: "invalid" });
    expect(limiter.isBlocked(IP, "anna", 0)).toBe(false); // one failure, not yet blocked
    await db.close();
  });

  it("blocks once the pair threshold is reached and short-circuits before authenticating", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "wrong-1!!!!!!");
    await attemptLogin(db, limiter, IP, "anna", "wrong-2!!!!!!");
    // Even the correct password is now rejected as rate-limited.
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "rate-limited" });
    await db.close();
  });

  it("resets the pair failure count on a successful login", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!");
    await attemptLogin(db, limiter, IP, "anna", "a-good-password"); // success resets pair
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!"); // one failure again
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
    await db.close();
  });
});
