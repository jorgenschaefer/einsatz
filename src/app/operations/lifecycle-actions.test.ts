import { randomUUID } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
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

import DevicePage from "@/app/device/[token]/page";
import ViewPage from "@/app/view/[token]/page";
import { DeviceClosed } from "@/map/DeviceClosed";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { createOperation } from "@/server/operations/create-operation";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { getOperation } from "@/server/operations/operations";
import { createViewLink, listViewLinks } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";
import {
  closeOperationAction,
  deleteOperationAction,
  reopenOperationAction,
} from "./lifecycle-actions";

async function login(role: "admin" | "user"): Promise<void> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role,
  });
  state.token = randomUUID();
  await insertSession(db, {
    token: state.token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
}

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
  it("refuses a non-admin and deletes nothing", async () => {
    await login("user");
    const op = await operationWithUpload("closed");

    await expect(deleteOperationAction(op.id)).rejects.toMatchObject({
      redirectTo: "/operations",
    });

    await expectUntouched(op.id);
  });

  it("refuses to delete an active Einsatz, even for an admin", async () => {
    await login("admin");
    const op = await operationWithUpload("active");

    expect(await deleteOperationAction(op.id)).toEqual({
      error: "Nur ein abgeschlossener Einsatz lässt sich löschen.",
    });

    await expectUntouched(op.id);
  });

  it("refreshes the overview after refusing, so it shows the Einsatz as active", async () => {
    await login("admin");
    const op = await operationWithUpload("active");

    await deleteOperationAction(op.id);

    expect(state.revalidatedPaths).toContain("/operations");
  });

  it("lets an admin delete a closed Einsatz and returns to the overview", async () => {
    await login("admin");
    const op = await operationWithUpload("closed");

    await expect(deleteOperationAction(op.id)).rejects.toMatchObject({
      redirectTo: "/operations",
    });

    expect(await getOperation(state.db as Db, op.id)).toBeNull();
    await expect(access(join(uploadsDir, op.id))).rejects.toThrow();
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
    const deviceToken = await generateDeviceLink(db, symbol.id);
    const viewLink = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    return { op, deviceToken, viewToken: viewLink.token };
  }

  async function expectLinksClosed(deviceToken: string, viewToken: string) {
    const closed = createElement(DeviceClosed);
    expect(
      await DevicePage({ params: Promise.resolve({ token: deviceToken }) }),
    ).toEqual(closed);
    expect(
      await ViewPage({ params: Promise.resolve({ token: viewToken }) }),
    ).toEqual(closed);
  }

  it("ends every Gerätelink and Ansichtslink for good, also after reopening", async () => {
    await login("user");
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
});
