import { describe, expect, it } from "vitest";
import { listEntries } from "@/server/journal/journal";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { createStation, listStations, renameStation } from "./stations";

type TestDb = Awaited<ReturnType<typeof freshDb>>;

async function anOperation(db: TestDb) {
  return insertOperation(db, { name: "Cyclassics", description: null });
}

describe("createStation", () => {
  it("creates a Stelle with its name and lists it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    const created = await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    expect(await listStations(db, op.id)).toEqual([
      { id: created.id, operationId: op.id, name: "UHSt 3" },
    ]);
  });

  it("records „Stelle angelegt: …“ in the ETB with its author", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    expect(await listEntries(db, op.id)).toEqual([
      expect.objectContaining({
        text: "Stelle angelegt: UHSt 3",
        type: "stelle-angelegt",
        author: "anna",
      }),
    ]);
  });

  it("trims the name", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    const created = await createStation(db, {
      operationId: op.id,
      name: "  UHSt 3 \n",
      author: "anna",
    });

    expect(created.name).toBe("UHSt 3");
    const [entry] = await listEntries(db, op.id);
    expect(entry.text).toBe("Stelle angelegt: UHSt 3");
  });

  it.each(["", "   "])(
    "rejects the empty name %j without writing anything",
    async (name) => {
      const db = await freshDb();
      const op = await anOperation(db);

      await expect(
        createStation(db, { operationId: op.id, name, author: "anna" }),
      ).rejects.toThrow(
        new ValidationError("Der Name der Stelle darf nicht leer sein."),
      );
      expect(await listStations(db, op.id)).toEqual([]);
      expect(await listEntries(db, op.id)).toEqual([]);
    },
  );

  it("rejects a name that differs from an existing Stelle only in case", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    await expect(
      createStation(db, { operationId: op.id, name: "uhst 3", author: "anna" }),
    ).rejects.toThrow(
      new ValidationError("Eine Stelle mit diesem Namen gibt es schon."),
    );
    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
    expect(await listEntries(db, op.id)).toHaveLength(1);
  });

  it("allows the same name in another Gesamteinsatz", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    await createStation(db, {
      operationId: other.id,
      name: "UHSt 3",
      author: "anna",
    });

    expect((await listStations(db, other.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
  });

  it("lists the Stellen of a Gesamteinsatz oldest first", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    for (const name of ["UHSt 3", "Ziel", "Start"]) {
      await createStation(db, { operationId: op.id, name, author: "anna" });
    }

    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
      "Ziel",
      "Start",
    ]);
  });

  it("creates concurrent Stellen of one Gesamteinsatz without deadlocking", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const names = Array.from({ length: 10 }, (_, i) => `UHSt ${i}`);

    await Promise.all(
      names.map((name) =>
        createStation(db, { operationId: op.id, name, author: "anna" }),
      ),
    );

    expect(await listStations(db, op.id)).toHaveLength(10);
    expect(await listEntries(db, op.id)).toHaveLength(10);
  });

  it("still accepts a Stelle once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await closeOperation(db, op.id);

    await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
  });
});

describe("renameStation", () => {
  async function aStation(db: TestDb, name = "UHSt 3") {
    const op = await anOperation(db);
    const station = await createStation(db, {
      operationId: op.id,
      name,
      author: "anna",
    });
    return { op, station };
  }

  it("renames the Stelle and records „Stelle umbenannt: alt → neu“", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    const operationId = await renameStation(db, {
      stationId: station.id,
      name: "  UHSt 3 Nord ",
      author: "bernd",
    });

    expect(operationId).toBe(op.id);
    expect(await listStations(db, op.id)).toEqual([
      { id: station.id, operationId: op.id, name: "UHSt 3 Nord" },
    ]);
    expect((await listEntries(db, op.id)).at(-1)).toMatchObject({
      text: "Stelle umbenannt: UHSt 3 → UHSt 3 Nord",
      type: "stelle-umbenannt",
      author: "bernd",
    });
  });
  it("allows a rename that only changes the case", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db, "UHSt 3");

    await renameStation(db, {
      stationId: station.id,
      name: "uhst 3",
      author: "bernd",
    });

    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "uhst 3",
    ]);
  });

  it("writes nothing when the name stays the same", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db, "UHSt 3");

    const operationId = await renameStation(db, {
      stationId: station.id,
      name: " UHSt 3 ",
      author: "bernd",
    });

    expect(operationId).toBe(op.id);
    expect(await listEntries(db, op.id)).toHaveLength(1);
  });

  it("rejects a rename onto another Stelle's name without writing anything", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db, "UHSt 3");
    await createStation(db, {
      operationId: op.id,
      name: "Ziel",
      author: "anna",
    });

    await expect(
      renameStation(db, {
        stationId: station.id,
        name: "ZIEL",
        author: "bernd",
      }),
    ).rejects.toThrow(
      new ValidationError("Eine Stelle mit diesem Namen gibt es schon."),
    );
    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
      "Ziel",
    ]);
    expect(await listEntries(db, op.id)).toHaveLength(2);
  });

  it.each(["", "   "])("rejects the empty name %j", async (name) => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await expect(
      renameStation(db, { stationId: station.id, name, author: "bernd" }),
    ).rejects.toThrow(
      new ValidationError("Der Name der Stelle darf nicht leer sein."),
    );
    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
  });

  it("rejects an unknown Stelle", async () => {
    const db = await freshDb();

    await expect(
      renameStation(db, {
        stationId: "00000000-0000-0000-0000-000000000000",
        name: "Ziel",
        author: "bernd",
      }),
    ).rejects.toThrow(new ValidationError("Stelle nicht gefunden."));
  });

  it("still renames once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    await closeOperation(db, op.id);

    await renameStation(db, {
      stationId: station.id,
      name: "UHSt 3 Nord",
      author: "bernd",
    });

    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3 Nord",
    ]);
  });
});
