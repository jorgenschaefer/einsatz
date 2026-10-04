import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
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

import { insertOperation } from "@/server/operations/operations";
import { createViewLink, listViewLinks } from "@/server/viewlinks/view-links";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import {
  type Bad,
  INVALID_ID,
  idCalls,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { liveEventsFor } from "@/test/live-events";
import { signIn } from "@/test/sign-in";
import * as actions from "./view-link-actions";

const { createViewLinkAction, deleteViewLinkAction } = actions;

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    createViewLinkAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        createViewLinkAction(NOT_A_UUID, "Leitstelle"),
      ),
      rejects(
        "a Bezeichnung as a number",
        "Die Bezeichnung muss Text sein.",
        (f) => createViewLinkAction(f.operationId, 7 as Bad),
      ),
      rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
        createViewLinkAction(f.operationId, text(201)),
      ),
    ],
    deleteViewLinkAction: idCalls("viewLinkId", deleteViewLinkAction),
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    createViewLinkAction: "takes only the Einsatz-ID",
    deleteViewLinkAction: {
      error: "Ansichtslink nicht gefunden.",
      call: (a, b) => deleteViewLinkAction(b, a.viewLinkId),
    },
  },
  { db, actAs },
);

async function anOperation() {
  return insertOperation(db(), { name: "Lage", description: null });
}

describe("createViewLinkAction", () => {
  beforeEach(() => actAs("user"));

  it("creates a named view link and tells open clients", async () => {
    const op = await anOperation();

    const { result, events } = await liveEventsFor(op.id, () =>
      createViewLinkAction(op.id, "Leitstelle"),
    );

    expect(result).toEqual({});
    expect(events).toBe(1);
    const [link] = await listViewLinks(db(), op.id);
    expect(link).toMatchObject({ label: "Leitstelle" });
  });

  it("stores a Bezeichnung of 200 characters", async () => {
    const op = await anOperation();
    const label = text(200);

    expect(await createViewLinkAction(op.id, label)).toEqual({});

    const [link] = await listViewLinks(db(), op.id);
    expect(link.label).toBe(label);
  });
});

describe("deleteViewLinkAction", () => {
  beforeEach(() => actAs("user"));

  it("deletes the view link and tells open clients", async () => {
    const op = await anOperation();
    const link = await createViewLink(db(), {
      operationId: op.id,
      label: "Leitstelle",
    });

    const { result, events } = await liveEventsFor(op.id, () =>
      deleteViewLinkAction(op.id, link.id),
    );

    expect(result).toEqual({});
    expect(events).toBe(1);
    expect(await listViewLinks(db(), op.id)).toEqual([]);
  });
});
