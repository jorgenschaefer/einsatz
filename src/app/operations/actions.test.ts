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
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { listOperations } from "@/server/operations/operations";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
} from "@/test/action-checks";
import {
  aFile,
  type Bad,
  form,
  INVALID_FORM_DATA,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./actions";

const { createOperationAction } = actions;

let db: Db;

const actAs: ActAs = async (caller) => {
  state.token = caller === "anonymous" ? undefined : await signIn(db, caller);
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  await actAs("user");
});

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    createOperationAction: [
      rejects("no FormData", INVALID_FORM_DATA, () =>
        createOperationAction({}, "name=x" as Bad),
      ),
      rejects(
        "a Bezeichnung as a file",
        "Die Bezeichnung muss Text sein.",
        () => createOperationAction({}, form({ name: aFile() })),
      ),
      rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), () =>
        createOperationAction({}, form({ name: text(201) })),
      ),
      rejects(
        "a Beschreibung as a file",
        "Die Beschreibung muss Text sein.",
        () =>
          createOperationAction(
            {},
            form({ name: "Lage", description: aFile() }),
          ),
      ),
      rejects(
        "a Beschreibung of 2,001",
        tooLong("Die Beschreibung", "2.000"),
        () =>
          createOperationAction(
            {},
            form({ name: "Lage", description: text(2001) }),
          ),
      ),
    ],
  },
  { db: () => db, actAs },
);

describe("createOperationAction", () => {
  it("stores a Bezeichnung of 200 and a Beschreibung of 2,000 characters, trimmed, and opens the Einsatz", async () => {
    const name = text(200);
    const description = text(2000);

    const redirect = await createOperationAction(
      {},
      form({ name: ` ${name} `, description: ` ${description}\n` }),
    ).catch((error: { redirectTo?: string }) => error.redirectTo);

    const [operation] = await listOperations(db);
    expect(operation).toMatchObject({ name, description });
    expect(redirect).toBe(`/operations/${operation.id}`);
  });
});
