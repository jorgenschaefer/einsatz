import { describe, expect, it } from "vitest";
import {
  assertPasswordPolicy,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toBe("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong password!", hash)).toBe(false);
  });

  it("enforces the 12-character minimum length", () => {
    expect(() =>
      assertPasswordPolicy("a".repeat(MIN_PASSWORD_LENGTH - 1)),
    ).toThrow();
    expect(() =>
      assertPasswordPolicy("a".repeat(MIN_PASSWORD_LENGTH)),
    ).not.toThrow();
  });

  it("refuses to hash a password shorter than the minimum", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });
});
