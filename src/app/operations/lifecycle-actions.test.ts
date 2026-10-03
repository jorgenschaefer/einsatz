import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  revalidatedPaths: [] as string[],
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidatedPaths.push(path),
}));
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

import { subscribeOperation } from "@/server/events/operation-events";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
  reportPosition,
  resolveDeviceAccess,
} from "@/server/mapsymbols/map-symbols";
import { createOperation } from "@/server/operations/create-operation";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { getOperation } from "@/server/operations/operations";
import {
  createViewLink,
  listViewLinks,
  resolveViewAccess,
} from "@/server/viewlinks/view-links";
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
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./lifecycle-actions";

const { closeOperationAction, deleteOperationAction, reopenOperationAction } =
  actions;

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};

expectEveryActionRequiresLogin(actions, {
  adminOnly: ["deleteOperationAction"],
  actAs,
});

expectBadCallsRejected(
  actions,
  {
    closeOperationAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        closeOperationAction(NOT_A_UUID),
      ),
      rejects("an Einsatz-ID as a number", INVALID_ID, () =>
        closeOperationAction(7 as Bad),
      ),
    ],
    reopenOperationAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        reopenOperationAction(NOT_A_UUID),
      ),
      rejects("an Einsatz-ID of null", INVALID_ID, () =>
        reopenOperationAction(null as Bad),
      ),
    ],
    deleteOperationAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        deleteOperationAction(NOT_A_UUID),
      ),
      rejects("an Einsatz-ID as an object", INVALID_ID, () =>
        deleteOperationAction({} as Bad),
      ),
    ],
  },
  { db: () => state.db as Db, actAs },
);

async function operationWithUpload(status: "active" | "closed") {
  const db = state.db as Db;
  const op = await createOperation(db, { name: "Hochwasser" });
  await storeOverlayImage(op.id, Buffer.from("plan"));
  if (status === "closed") await closeOperation(db, op.id);
  return op;
}

async function expectUntouched(operationId: string) {
  const db = state.db as Db;
  expect(await getOperation(db, operationId)).not.toBeNull();
  expect(await listEntries(db, operationId)).not.toHaveLength(0);
  await access(join(uploadsDir, operationId));
}

let uploadsDir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  state.revalidatedPaths = [];
  uploadsDir = await mkdtemp(join(tmpdir(), "einsatz-uploads-"));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(uploadsDir, { recursive: true, force: true });
});

describe("deleteOperationAction", () => {
  it("refuses to delete an active Einsatz, even for an admin", async () => {
    await actAs("admin");
    const op = await operationWithUpload("active");

    expect(await deleteOperationAction(op.id)).toEqual({
      error: "Nur ein abgeschlossener Einsatz lässt sich löschen.",
    });

    await expectUntouched(op.id);
  });

  it("refreshes the overview after refusing, so it shows the Einsatz as active", async () => {
    await actAs("admin");
    const op = await operationWithUpload("active");

    await deleteOperationAction(op.id);

    expect(state.revalidatedPaths).toContain("/operations");
  });

  it("lets an admin delete a closed Einsatz and returns to the overview", async () => {
    await actAs("admin");
    const op = await operationWithUpload("closed");

    await expect(deleteOperationAction(op.id)).rejects.toMatchObject({
      redirectTo: "/operations",
    });

    expect(await getOperation(state.db as Db, op.id)).toBeNull();
    await expect(access(join(uploadsDir, op.id))).rejects.toThrow();
  });
});

describe.each([
  ["closeOperationAction", closeOperationAction, "active", "closed"],
  ["reopenOperationAction", reopenOperationAction, "closed", "active"],
] as const)("%s", (_, changeStatus, from, to) => {
  it("changes the status and refreshes the Einsatz and the overview", async () => {
    await actAs("user");
    const op = await operationWithUpload(from);

    expect(await changeStatus(op.id)).toEqual({});

    expect(await getOperation(state.db as Db, op.id)).toMatchObject({
      status: to,
    });
    expect(state.revalidatedPaths).toEqual(
      expect.arrayContaining([`/operations/${op.id}`, "/operations"]),
    );
  });
});

describe("closeOperationAction", () => {
  async function operationWithLinks() {
    const db = state.db as Db;
    const op = await createOperation(db, { name: "Hochwasser" });
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
      lat: 53.55,
      lng: 10,
    });
    const deviceToken = await generateDeviceLink(
      db,
      symbol.operationId,
      symbol.id,
    );
    const viewLink = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    return { op, deviceToken, viewToken: viewLink.token };
  }

  async function expectLinksClosed(deviceToken: string, viewToken: string) {
    const db = state.db as Db;
    expect(await resolveDeviceAccess(db, deviceToken)).toBeNull();
    expect(await resolveViewAccess(db, viewToken)).toBeNull();
  }

  it("ends every Gerätelink and Ansichtslink for good, also after reopening", async () => {
    await actAs("user");
    const { op, deviceToken, viewToken } = await operationWithLinks();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    try {
      await closeOperationAction(op.id);
    } finally {
      unsubscribe();
    }

    expect(listener).toHaveBeenCalledTimes(1);
    await expectLinksClosed(deviceToken, viewToken);

    await reopenOperationAction(op.id);

    await expectLinksClosed(deviceToken, viewToken);
    const db = state.db as Db;
    const [symbol] = await listMapSymbols(db, op.id);
    expect(symbol.deviceLinkToken).toBeNull();
    expect(await listViewLinks(db, op.id)).toEqual([]);
  });

  it("places Kartenzeichen whose device had reported by hand again", async () => {
    await actAs("user");
    const { op, deviceToken } = await operationWithLinks();
    const db = state.db as Db;
    await reportPosition(db, deviceToken, 53.6, 10.1);

    await closeOperationAction(op.id);

    const [symbol] = await listMapSymbols(db, op.id);
    expect(symbol).toMatchObject({
      lat: 53.6,
      lng: 10.1,
      positionSource: "manual",
    });
  });
});
