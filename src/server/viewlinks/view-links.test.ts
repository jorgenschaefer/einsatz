import { describe, expect, it } from "vitest";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import {
  deleteOperationRow,
  insertOperation,
} from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createViewLink,
  deleteAllViewLinks,
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
  });

  it("lists links oldest first", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await createViewLink(db, { operationId: op.id, label: "erster" });
    await createViewLink(db, { operationId: op.id, label: "zweiter" });
    const labels = (await listViewLinks(db, op.id)).map((l) => l.label);
    expect(labels).toEqual(["erster", "zweiter"]);
  });

  it("gives each link a distinct token", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const a = await createViewLink(db, { operationId: op.id, label: "a" });
    const b = await createViewLink(db, { operationId: op.id, label: "b" });
    expect(a.token).not.toBe(b.token);
  });

  it("deletes only the chosen link, leaving the others valid", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const a = await createViewLink(db, { operationId: op.id, label: "a" });
    const b = await createViewLink(db, { operationId: op.id, label: "b" });

    await deleteViewLink(db, op.id, a.id);

    const remaining = await listViewLinks(db, op.id);
    expect(remaining.map((l) => l.id)).toEqual([b.id]);
    expect(await resolveViewAccess(db, a.token)).toBeNull();
    expect(await resolveViewAccess(db, b.token)).toEqual({
      operationId: op.id,
    });
  });

  it("refuses to delete an Ansichtslink of another Einsatz and keeps it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    const link = await createViewLink(db, { operationId: op.id, label: "a" });

    await expect(deleteViewLink(db, other.id, link.id)).rejects.toThrow(
      new ValidationError("Ansichtslink nicht gefunden."),
    );
    expect(await listViewLinks(db, op.id)).toEqual([link]);
  });

  it("reports an Ansichtslink that no longer exists", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const link = await createViewLink(db, { operationId: op.id, label: "a" });
    await deleteViewLink(db, op.id, link.id);

    await expect(deleteViewLink(db, op.id, link.id)).rejects.toThrow(
      new ValidationError("Ansichtslink nicht gefunden."),
    );
  });

  it("resolves access only while the operation is active", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    expect(await resolveViewAccess(db, "nope")).toBeNull();

    await closeOperation(db, op.id);
    const link = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    expect(await resolveViewAccess(db, link.token)).toBeNull();

    await reopenOperation(db, op.id);
    expect(await resolveViewAccess(db, link.token)).toEqual({
      operationId: op.id,
    });
  });

  it("allows a blank label and lists it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const created = await createViewLink(db, { operationId: op.id, label: "" });
    const [loaded] = await listViewLinks(db, op.id);
    expect(loaded).toMatchObject({ id: created.id, label: "" });
  });

  it("scopes links to their operation", async () => {
    const db = await freshDb();
    const a = await anOperation(db);
    const b = await anOperation(db);
    await createViewLink(db, { operationId: a.id, label: "a" });
    expect(await listViewLinks(db, b.id)).toHaveLength(0);
  });

  it("cascades when the operation is deleted", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const link = await createViewLink(db, { operationId: op.id, label: "a" });
    await closeOperation(db, op.id);

    await deleteOperationRow(db, op.id);

    expect(await resolveViewAccess(db, link.token)).toBeNull();
  });
});

describe("deleteAllViewLinks", () => {
  it("leaves another Einsatz's Ansichtslinks alone", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    await createViewLink(db, { operationId: op.id, label: "Leitstelle" });
    const otherLink = await createViewLink(db, {
      operationId: other.id,
      label: "Stab",
    });

    await deleteAllViewLinks(db, op.id);

    expect(await listViewLinks(db, op.id)).toEqual([]);
    expect(await listViewLinks(db, other.id)).toEqual([otherLink]);
  });
});
