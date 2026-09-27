import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import {
  assertPasswordPolicy,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password";

// Hier zählt der echte, produktive Kostenfaktor – nicht der schnelle Testmock.
vi.unmock("bcryptjs");

const costOf = (hash: string) => Number(hash.split("$")[2]);

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toBe("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("hashes with cost factor 12", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(costOf(hash)).toBe(12);
  });

  it("uses the same cost factor for the dummy timing-equalizer hash", () => {
    expect(costOf(DUMMY_PASSWORD_HASH)).toBe(12);
  });

  it("still verifies a legacy cost-10 hash (bcrypt is cost-agnostic)", async () => {
    const legacy = bcrypt.hashSync("correct horse battery", 10);
    expect(costOf(legacy)).toBe(10);
    expect(await verifyPassword("correct horse battery", legacy)).toBe(true);
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
