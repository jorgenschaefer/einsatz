import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  assertPasswordPolicy,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "./password";

// Den produktiven Kostenfaktor pinnt `password-cost.test.ts`; hier läuft der
// schnelle Testmock.
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

  it("refuses entries of the common-password list", () => {
    refuses("unbelievable", COMMON);
    refuses("scandinavian", COMMON);
  });

  it("compares the list exactly, not ignoring case", () => {
    accepts("Unbelievable");
  });

  it("refuses the former example password", () => {
    refuses("change-me-please", COMMON);
  });

  it("refuses the username, ignoring case on both sides", () => {
    refuses("ANNA-maria-admin", SAME_AS_USERNAME, "Anna-Maria-Admin");
    accepts("anna-maria-admin!", "Anna-Maria-Admin");
  });
});

const TOO_LONG =
  "Das Passwort darf höchstens 72 Byte lang sein (Umlaute zählen doppelt).";
const COMMON = "Dieses Passwort ist zu verbreitet. Bitte ein anderes wählen.";
const SAME_AS_USERNAME = "Das Passwort darf nicht dem Nutzernamen gleichen.";
