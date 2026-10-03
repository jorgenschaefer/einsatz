import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

import DevicePage from "@/app/device/[token]/page";
import { removeDeviceLinkAction } from "@/app/operations/[id]/map-symbol-actions";
import { DeviceClosed } from "@/map/DeviceClosed";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";

async function login(): Promise<void> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role: "user",
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  state.token = token;
}

async function aSymbolWithDeviceLink() {
  const db = state.db as Db;
  const op = await insertOperation(db, { name: "Lage", description: null });
  const symbol = await createMapSymbol(db, {
    operationId: op.id,
    composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
    lat: 53.55,
    lng: 10,
  });
  const token = await generateDeviceLink(db, symbol.id);
  return { op, symbol, token };
}

function devicePageFor(token: string) {
  return DevicePage({ params: Promise.resolve({ token }) });
}

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("removeDeviceLinkAction", () => {
  it("ends the device's access and tells open clients, keeping the Kartenzeichen", async () => {
    await login();
    const { op, symbol, token } = await aSymbolWithDeviceLink();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    let result: unknown;
    try {
      result = await removeDeviceLinkAction(op.id, symbol.id);
    } finally {
      unsubscribe();
    }

    expect(result).toEqual({});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await devicePageFor(token)).toEqual(createElement(DeviceClosed));
    const [after] = await listMapSymbols(state.db as Db, op.id);
    expect(after).toEqual({ ...symbol, deviceLinkToken: null });
  });

  it("refuses without a session and keeps the link", async () => {
    const { op, symbol, token } = await aSymbolWithDeviceLink();

    await expect(removeDeviceLinkAction(op.id, symbol.id)).rejects.toThrow();

    const [after] = await listMapSymbols(state.db as Db, op.id);
    expect(after.deviceLinkToken).toBe(token);
  });
});
