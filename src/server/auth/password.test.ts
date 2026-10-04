import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  assertPasswordPolicy,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password";

// Der Testmock (`src/test/fast-bcrypt.ts`) hasht mit Kostenfaktor 4, gleich
// welchen `password.ts` verlangt; den verlangten Faktor zeigen die Spies.
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

  it("hashes with cost factor 12", async () => {
    const hash = vi.spyOn(bcrypt, "hash");
    await hashPassword("correct horse battery");
    expect(hash).toHaveBeenCalledWith("correct horse battery", 12);
    hash.mockRestore();
  });

  it("uses the same cost factor for the dummy timing-equalizer hash", async () => {
    vi.resetModules();
    const { default: freshBcrypt } = await import("bcryptjs");
    const hashSync = vi.spyOn(freshBcrypt, "hashSync");
    await import("./password");
    expect(hashSync).toHaveBeenCalledWith(expect.any(String), 12);
    hashSync.mockRestore();
  });

  it("still verifies a legacy cost-10 hash (bcrypt is cost-agnostic)", async () => {
    const { default: realBcrypt } =
      await vi.importActual<typeof import("bcryptjs")>("bcryptjs");
    const legacy = realBcrypt.hashSync("correct horse battery", 10);
    expect(legacy.split("$")[2]).toBe("10");
    expect(await verifyPassword("correct horse battery", legacy)).toBe(true);
  });
});

describe("assertPasswordPolicy", () => {
  const accepts = (password: string, username = "anna") =>
    expect(() => assertPasswordPolicy(password, username)).not.toThrow();
  const refuses = (password: string, message: string, username = "anna") =>
    expect(() => assertPasswordPolicy(password, username)).toThrow(
      new ValidationError(message),
    );

  it("enforces the 12-character minimum length", () => {
    refuses(
      "q".repeat(MIN_PASSWORD_LENGTH - 1),
      "Das Passwort muss mindestens 12 Zeichen haben.",
    );
    accepts("q".repeat(MIN_PASSWORD_LENGTH));
  });

  it("allows at most 72 bytes, counting an umlaut as two", () => {
    accepts("ä".repeat(36));
    accepts("q".repeat(72));
    refuses("q".repeat(73), TOO_LONG);
    refuses(`q${"ä".repeat(36)}`, TOO_LONG);
  });

  it("accepts common passwords that meet the length rule", () => {
    accepts("password1234");
    accepts("unbelievable");
    accepts("change-me-please");
  });

  it("refuses the username, ignoring case on both sides", () => {
    refuses("ANNA-maria-admin", SAME_AS_USERNAME, "Anna-Maria-Admin");
    accepts("anna-maria-admin!", "Anna-Maria-Admin");
  });
});

const TOO_LONG =
  "Das Passwort darf höchstens 72 Byte lang sein (Umlaute zählen doppelt).";
const SAME_AS_USERNAME = "Das Passwort darf nicht dem Nutzernamen gleichen.";
