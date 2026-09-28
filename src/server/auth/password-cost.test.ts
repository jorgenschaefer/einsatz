import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";

// Hier zählt der echte, produktive Kostenfaktor – nicht der schnelle Testmock.
vi.unmock("bcryptjs");

const costOf = (hash: string) => Number(hash.split("$")[2]);

describe("password hashing cost", () => {
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
});
