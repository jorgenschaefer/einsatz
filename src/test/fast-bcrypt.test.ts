import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const costOf = (hash: string) => Number(hash.split("$")[2]);

describe("bcrypt in tests", () => {
  it("hashes with the minimal cost factor so tests stay fast", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(costOf(hash)).toBe(4);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });
});
