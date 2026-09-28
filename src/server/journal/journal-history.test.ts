import { describe, expect, it } from "vitest";
import { createOperation } from "@/server/operations/create-operation";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { annulEntry, appendEntry, correctEntry, listEntries } from "./journal";

async function manualEntry(db: Awaited<ReturnType<typeof freshDb>>) {
  const op = await insertOperation(db, {
    name: "Hochwasser",
    description: null,
  });
  const entry = await appendEntry(db, {
    operationId: op.id,
    text: "Deich hält",
    type: "manuell",
    author: "anna",
  });
  return { op, entry };
}

describe("correctEntry", () => {
  it("keeps the prior fassung with its original author and makes the new one current", async () => {
    const db = await freshDb();
    const { entry } = await manualEntry(db);

    const corrected = await correctEntry(
      db,
      entry.id,
      "Deich hält nicht",
      "bernd",
    );
    expect(corrected.text).toBe("Deich hält nicht");
    expect(corrected.author).toBe("bernd");
    expect(corrected.editedAt).toBeInstanceOf(Date);
    expect(corrected.revisions).toHaveLength(1);
    expect(corrected.revisions[0]).toMatchObject({
      text: "Deich hält",
      author: "anna",
    });
    // The archived fassung keeps its own (original) timestamp, not the correction time.
    expect(corrected.revisions[0].createdAt.getTime()).toBe(
      entry.createdAt.getTime(),
    );
    expect(corrected.number).toBe(entry.number);
  });

  it("accumulates history over multiple corrections, oldest first", async () => {
    const db = await freshDb();
    const { entry } = await manualEntry(db);
    await correctEntry(db, entry.id, "zweite", "bernd");
    await correctEntry(db, entry.id, "dritte", "clara");

    const [reloaded] = await listEntries(db, entry.operationId);
    expect(reloaded.text).toBe("dritte");
    expect(reloaded.revisions.map((r) => r.text)).toEqual([
      "Deich hält",
      "zweite",
    ]);
  });

  it("rejects correcting an automatic entry (unantastbar)", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Sturm" });
    const [auto] = await listEntries(db, op.id);
    expect(auto.type).toBe("einsatz-eröffnet");
    await expect(
      correctEntry(db, auto.id, "manipuliert", "anna"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects correcting an unknown entry", async () => {
    const db = await freshDb();

    await expect(
      correctEntry(
        db,
        "00000000-0000-0000-0000-000000000000",
        "Deich hält",
        "bernd",
      ),
    ).rejects.toThrow(new ValidationError("Eintrag nicht gefunden."));
  });

  it("rejects an empty correction and changes nothing", async () => {
    const db = await freshDb();
    const { entry } = await manualEntry(db);
    await expect(
      correctEntry(db, entry.id, "   ", "bernd"),
    ).rejects.toBeInstanceOf(ValidationError);
    const [reloaded] = await listEntries(db, entry.operationId);
    expect(reloaded.text).toBe("Deich hält");
    expect(reloaded.revisions).toHaveLength(0);
  });
});

describe.each([
  "stelle-angelegt",
  "stelle-umbenannt",
  "stärkemeldung",
] as const)("a %s entry", (type) => {
  async function stationEntry(db: Awaited<ReturnType<typeof freshDb>>) {
    const op = await insertOperation(db, {
      name: "Cyclassics",
      description: null,
    });
    return appendEntry(db, {
      operationId: op.id,
      text: "Stelle angelegt: UHSt 3",
      type,
      author: "anna",
    });
  }
  const onlyManual = new ValidationError(
    "Nur manuelle Einträge können geändert werden.",
  );

  it("cannot be corrected", async () => {
    const db = await freshDb();
    const entry = await stationEntry(db);
    await expect(
      correctEntry(db, entry.id, "manipuliert", "bernd"),
    ).rejects.toThrow(onlyManual);
  });

  it("cannot be annulled", async () => {
    const db = await freshDb();
    const entry = await stationEntry(db);
    await expect(annulEntry(db, entry.id)).rejects.toThrow(
      new ValidationError("Dieser Eintrag kann nicht annulliert werden."),
    );
  });
});

describe("a gesamtstärke-gemeldet entry", () => {
  async function totalStrengthEntry(db: Awaited<ReturnType<typeof freshDb>>) {
    const op = await insertOperation(db, {
      name: "Cyclassics",
      description: null,
    });
    return appendEntry(db, {
      operationId: op.id,
      text: "Gesamtstärke gemeldet: 0/0/0//0, +0 zusätzlich, 0 Personen (0 Stellen)",
      type: "gesamtstärke-gemeldet",
      author: "anna",
    });
  }

  it("can be annulled", async () => {
    const db = await freshDb();
    const entry = await totalStrengthEntry(db);
    const annulled = await annulEntry(db, entry.id);
    expect(annulled.state).toBe("annulliert");
    expect(annulled.text).toBe(entry.text);
  });

  it("cannot be annulled twice", async () => {
    const db = await freshDb();
    const entry = await totalStrengthEntry(db);
    await annulEntry(db, entry.id);
    await expect(annulEntry(db, entry.id)).rejects.toThrow(
      new ValidationError("Annullierte Einträge können nicht geändert werden."),
    );
  });

  it("cannot be corrected", async () => {
    const db = await freshDb();
    const entry = await totalStrengthEntry(db);
    await expect(
      correctEntry(db, entry.id, "manipuliert", "bernd"),
    ).rejects.toThrow(
      new ValidationError("Nur manuelle Einträge können geändert werden."),
    );
  });
});

describe("annulEntry", () => {
  it("marks a manual entry annulliert while keeping its number and text", async () => {
    const db = await freshDb();
    const { entry } = await manualEntry(db);
    const annulled = await annulEntry(db, entry.id);
    expect(annulled.state).toBe("annulliert");
    expect(annulled.number).toBe(entry.number);
    expect(annulled.text).toBe("Deich hält");
  });

  it("rejects annulling an unknown entry", async () => {
    const db = await freshDb();
    await expect(
      annulEntry(db, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(new ValidationError("Eintrag nicht gefunden."));
  });

  it("rejects annulling an automatic entry (unantastbar)", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Sturm" });
    const [auto] = await listEntries(db, op.id);
    await expect(annulEntry(db, auto.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects correcting an already-annulled entry", async () => {
    const db = await freshDb();
    const { entry } = await manualEntry(db);
    await annulEntry(db, entry.id);
    await expect(
      correctEntry(db, entry.id, "neu", "bernd"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
