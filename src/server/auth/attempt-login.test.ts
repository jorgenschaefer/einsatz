import { describe, expect, it } from "vitest";
import type { Queryable } from "@/server/db/db";
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
  });

  it("counts a wrong password and refuses even the correct one once the pair budget is used up", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    expect(
      await attemptLogin(db, limiter, IP, "anna", "wrong-1!!!!!!"),
    ).toEqual({ status: "invalid" });
    await attemptLogin(db, limiter, IP, "anna", "wrong-2!!!!!!");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result).toEqual({ status: "rate-limited" });
  });

  it("resets the pair failure count on a successful login", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(2, 1000, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!");
    await attemptLogin(db, limiter, IP, "anna", "a-good-password");
    await attemptLogin(db, limiter, IP, "anna", "wrong!!!!!!!");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });

  it("does not count a successful login against the IP budget", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(5, 1, 60_000);
    await attemptLogin(db, limiter, IP, "anna", "a-good-password");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });

  it("does not count an attempt whose check fails, and passes the error on", async () => {
    const db = await freshDb();
    await seedAnna(db);
    const limiter = new LoginRateLimiter(1, 1, 60_000);
    const down: Queryable = {
      query: () => Promise.reject(new Error("database down")),
    };
    await expect(
      attemptLogin(down, limiter, IP, "anna", "a-good-password"),
    ).rejects.toThrow("database down");
    const result = await attemptLogin(
      db,
      limiter,
      IP,
      "anna",
      "a-good-password",
    );
    expect(result.status).toBe("ok");
  });
});
