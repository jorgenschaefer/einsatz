import { describe, expect, it } from "vitest";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import {
  deleteOperation,
  insertOperation,
} from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import {
  createViewLink,
  deleteViewLink,
  listViewLinks,
  resolveViewAccess,
} from "./view-links";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

describe("view links repository", () => {
  it("creates a named view link and lists it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const created = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    expect(created.id).toBeTruthy();
    expect(created.token).toBeTruthy();

    const [loaded] = await listViewLinks(db, op.id);
    expect(loaded).toMatchObject({
      id: created.id,
      operationId: op.id,
      label: "Leitstelle",
      token: created.token,
    });
    await db.close();
  });

  it("lists links oldest first", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await createViewLink(db, { operationId: op.id, label: "erster" });
    await createViewLink(db, { operationId: op.id, label: "zweiter" });
    const labels = (await listViewLinks(db, op.id)).map((l) => l.label);
    expect(labels).toEqual(["erster", "zweiter"]);
    await db.close();
  });

  it("gives each link a distinct token", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const a = await createViewLink(db, { operationId: op.id, label: "a" });
    const b = await createViewLink(db, { operationId: op.id, label: "b" });
    expect(a.token).not.toBe(b.token);
    await db.close();
  });

  it("deletes only the chosen link, leaving the others valid", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const a = await createViewLink(db, { operationId: op.id, label: "a" });
    const b = await createViewLink(db, { operationId: op.id, label: "b" });

    await deleteViewLink(db, a.id);

    const remaining = await listViewLinks(db, op.id);
    expect(remaining.map((l) => l.id)).toEqual([b.id]);
    expect(await resolveViewAccess(db, a.token)).toBeNull();
    expect(await resolveViewAccess(db, b.token)).toEqual({
      operationId: op.id,
    });
    await db.close();
  });

  it("resolves access only while the operation is active", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const link = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    expect(await resolveViewAccess(db, link.token)).toEqual({
      operationId: op.id,
    });
    expect(await resolveViewAccess(db, "nope")).toBeNull();

    await closeOperation(db, op.id);
    expect(await resolveViewAccess(db, link.token)).toBeNull();

    await reopenOperation(db, op.id);
    expect(await resolveViewAccess(db, link.token)).toEqual({
      operationId: op.id,
    });
    await db.close();
  });

  it("allows a blank label and lists it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const created = await createViewLink(db, { operationId: op.id, label: "" });
    const [loaded] = await listViewLinks(db, op.id);
    expect(loaded).toMatchObject({ id: created.id, label: "" });
    await db.close();
  });

  it("scopes links to their operation", async () => {
    const db = await freshDb();
    const a = await anOperation(db);
    const b = await anOperation(db);
    await createViewLink(db, { operationId: a.id, label: "a" });
    expect(await listViewLinks(db, b.id)).toHaveLength(0);
    await db.close();
  });

  it("cascades when the operation is deleted", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const link = await createViewLink(db, { operationId: op.id, label: "a" });

    await deleteOperation(db, op.id);

    expect(await resolveViewAccess(db, link.token)).toBeNull();
    await db.close();
  });
});
