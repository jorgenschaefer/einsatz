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
import {
  findUserById,
  findUserByUsername,
  insertUser,
  listUsers,
  type User,
} from "@/server/auth/users";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
} from "@/test/action-checks";
import {
  type Bad,
  INVALID_ID,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { POLICY_USERNAME, REFUSED_PASSWORDS } from "@/test/refused-passwords";
import { signIn } from "@/test/sign-in";
import * as actions from "./actions";

const {
  createAccountAction,
  deleteAccountAction,
  resetPasswordAction,
  setRoleAction,
} = actions;

const PASSWORD = "a-good-password";
const NEW_PASSWORD = "brand-new-password";
const TAKEN = "Dieser Nutzername ist bereits vergeben.";
const NOT_TEXT = "Das Passwort muss Text sein.";

let db: Db;

const actAs: ActAs = async (caller) => {
  state.token = caller === "anonymous" ? undefined : await signIn(db, caller);
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  await actAs("admin");
});

expectEveryActionRequiresLogin(actions, {
  adminOnly: [
    "createAccountAction",
    "setRoleAction",
    "resetPasswordAction",
    "deleteAccountAction",
  ],
  actAs,
});

expectBadCallsRejected(
  actions,
  {
    createAccountAction: [
      rejects(
        "a Nutzername as a number",
        "Der Nutzername muss Text sein.",
        () => createAccountAction(7 as Bad, NEW_PASSWORD, false),
      ),
      rejects("a Nutzername of 201", tooLong("Der Nutzername", "200"), () =>
        createAccountAction(text(201), NEW_PASSWORD, false),
      ),
      rejects("a password of null", NOT_TEXT, () =>
        createAccountAction("anna", null as Bad, false),
      ),
      rejects("a password as a number", NOT_TEXT, () =>
        createAccountAction("anna", 7 as Bad, false),
      ),
      rejects(
        'admin as "yes"',
        "„Administrator“ muss wahr oder falsch sein.",
        () => createAccountAction("anna", NEW_PASSWORD, "yes" as Bad),
      ),
    ],
    setRoleAction: [
      rejects("a non-UUID Konto-ID", INVALID_ID, () =>
        setRoleAction(NOT_A_UUID, "admin"),
      ),
      rejects('the role "root"', "Unbekannte Rolle.", (f) =>
        setRoleAction(f.userId, "root" as Bad),
      ),
    ],
    resetPasswordAction: [
      rejects("a non-UUID Konto-ID", INVALID_ID, () =>
        resetPasswordAction(NOT_A_UUID, NEW_PASSWORD),
      ),
      rejects("a password as a number", NOT_TEXT, (f) =>
        resetPasswordAction(f.userId, 7 as Bad),
      ),
    ],
    deleteAccountAction: [
      rejects("a non-UUID Konto-ID", INVALID_ID, () =>
        deleteAccountAction(NOT_A_UUID),
      ),
    ],
  },
  { db: () => db, actAs },
);

async function insertAccount(username: string): Promise<User> {
  return insertUser(db, {
    username,
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
}

describe("createAccountAction", () => {
  it("stores a Nutzername of 200 characters, trimmed", async () => {
    const username = text(200);

    expect(await createAccountAction(` ${username} `, PASSWORD, false)).toEqual(
      {},
    );

    expect(await findUserByUsername(db, username)).toMatchObject({
      username,
      role: "user",
    });
  });
});

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
