import { randomUUID } from "node:crypto";
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

import {
  createViewLinkAction,
  deleteViewLinkAction,
} from "@/app/operations/[id]/view-link-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink, listViewLinks } from "@/server/viewlinks/view-links";
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

async function anOperation() {
  return insertOperation(state.db as Db, { name: "Lage", description: null });
}

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("view link actions", () => {
  it("creates a named view link for a logged-in user", async () => {
    await login();
    const op = await anOperation();

    await createViewLinkAction(op.id, "Leitstelle");

    const [link] = await listViewLinks(state.db as Db, op.id);
    expect(link).toMatchObject({ label: "Leitstelle" });
  });

  it("deletes a view link for a logged-in user", async () => {
    await login();
    const op = await anOperation();
    const link = await createViewLink(state.db as Db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    await deleteViewLinkAction(op.id, link.id);

    expect(await listViewLinks(state.db as Db, op.id)).toHaveLength(0);
  });

  it("reports a deleted view link as a success without an error", async () => {
    await login();
    const op = await anOperation();
    const link = await createViewLink(state.db as Db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    expect(await deleteViewLinkAction(op.id, link.id)).toEqual({});
  });

  it("tells other open clients of the Einsatz that a view link was deleted", async () => {
    await login();
    const op = await anOperation();
    const link = await createViewLink(state.db as Db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    try {
      await deleteViewLinkAction(op.id, link.id);
    } finally {
      unsubscribe();
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells other open clients of the Einsatz that a view link was created", async () => {
    await login();
    const op = await anOperation();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    let result: unknown;
    try {
      result = await createViewLinkAction(op.id, "Leitstelle");
    } finally {
      unsubscribe();
    }

    expect(listener).toHaveBeenCalledTimes(1);
    expect(result).toEqual({});
  });

  it("refuses to create a link without a session and writes nothing", async () => {
    const op = await anOperation();
    await expect(createViewLinkAction(op.id, "Leitstelle")).rejects.toThrow();
    expect(await listViewLinks(state.db as Db, op.id)).toHaveLength(0);
  });

  it("refuses to delete a link without a session and keeps it", async () => {
    const op = await anOperation();
    const link = await createViewLink(state.db as Db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    await expect(deleteViewLinkAction(op.id, link.id)).rejects.toThrow();
    expect(await listViewLinks(state.db as Db, op.id)).toHaveLength(1);
  });
});
