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

import { findUserByUsername } from "@/server/auth/users";
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

describe("createAccountAction", () => {
  it.each([
    ["a Nutzer", false, "user"],
    ["an Administrator", true, "admin"],
  ])("creates %s as asked", async (_, admin, role) => {
    expect(await createAccountAction("bob", PASSWORD, admin)).toEqual({});

    expect(await findUserByUsername(db, "bob")).toMatchObject({ role });
  });
});
