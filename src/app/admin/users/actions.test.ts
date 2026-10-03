import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { hashPassword, verifyPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import {
  findUserById,
  findUserByUsername,
  insertUser,
  listUsers,
  type User,
} from "@/server/auth/users";
import { freshDb } from "@/test/db";
import { POLICY_USERNAME, REFUSED_PASSWORDS } from "@/test/refused-passwords";
import { createAccountAction, resetPasswordAction } from "./actions";

const PASSWORD = "a-good-password";
const TAKEN = "Dieser Nutzername ist bereits vergeben.";

let db: Db;

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  const admin = await insertUser(db, {
    username: "chef",
    passwordHash: await hashPassword("admin-secret-1"),
    role: "admin",
  });
  state.token = randomUUID();
  await insertSession(db, {
    token: state.token,
    userId: admin.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
});

async function insertAccount(username: string): Promise<User> {
  return insertUser(db, {
    username,
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
}

describe("createAccountAction password policy", () => {
  it.each(REFUSED_PASSWORDS)(
    "refuses a password $rule and creates nothing",
    async ({ password, message }) => {
      expect(
        await createAccountAction(POLICY_USERNAME, password, false),
      ).toEqual({ error: message });
      expect(await findUserByUsername(db, POLICY_USERNAME)).toBeNull();
    },
  );

  it("accepts exactly 72 bytes", async () => {
    expect(
      await createAccountAction(POLICY_USERNAME, "ä".repeat(36), false),
    ).toEqual({});
  });

  it("accepts 12 characters that are not on the list", async () => {
    expect(
      await createAccountAction(POLICY_USERNAME, "qx7-vb2-kw9m", false),
    ).toEqual({});
  });
});

describe("resetPasswordAction password policy", () => {
  it.each(REFUSED_PASSWORDS)(
    "refuses a password $rule and keeps the old one",
    async ({ password, message }) => {
      const user = await insertAccount(POLICY_USERNAME);
      expect(await resetPasswordAction(user.id, password)).toEqual({
        error: message,
      });
      const stored = await findUserById(db, user.id);
      expect(await verifyPassword(PASSWORD, stored!.passwordHash)).toBe(true);
    },
  );
});

describe("createAccountAction username uniqueness", () => {
  it("refuses a username that differs from an existing one only in case", async () => {
    await insertAccount("anna");
    expect(await createAccountAction("Anna", PASSWORD, false)).toEqual({
      error: TAKEN,
    });
    expect(await findUserByUsername(db, "Anna")).toBeNull();
  });

  it("creates exactly one account for two concurrent requests differing in case", async () => {
    const results = await Promise.all([
      createAccountAction("bob", PASSWORD, false),
      createAccountAction("Bob", PASSWORD, false),
    ]);
    expect(results).toContainEqual({});
    expect(results).toContainEqual({ error: TAKEN });
    const bobs = (await listUsers(db)).filter(
      (u) => u.username.toLowerCase() === "bob",
    );
    expect(bobs).toHaveLength(1);
  });
});
