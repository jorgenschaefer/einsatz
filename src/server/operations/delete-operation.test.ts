import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { Db } from "@/server/db/db";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { appendEntry, listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { createStation, listStations } from "@/server/strength/stations";
import {
  listStrengthReports,
  recordStrengthReport,
} from "@/server/strength/strength-reports";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { createOperation } from "./create-operation";
import { deleteOperation } from "./delete-operation";
import { closeOperation } from "./operation-lifecycle";
import { getOperation } from "./operations";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 0,
  opacity: 1,
};

let uploadsDir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), "einsatz-uploads-"));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(uploadsDir, { recursive: true, force: true });
});

async function closedOperation(db: Db, name: string) {
  const op = await createOperation(db, { name });
  await closeOperation(db, op.id);
  return op;
}

describe("deleteOperation (domain)", () => {
  it("leaves an active operation and its upload directory alone", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await storeOverlayImage(op.id, Buffer.from("plan"));

    expect(await deleteOperation(db, op.id)).toBe(false);

    expect(await getOperation(db, op.id)).not.toBeNull();
    await access(join(uploadsDir, op.id));
  });

  it("reports that a closed operation was deleted", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Hochwasser");

    expect(await deleteOperation(db, op.id)).toBe(true);
  });

  it("deletes the operation and cascades its journal entries and map symbols", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Hochwasser"); // has an automatic entry
    await appendEntry(db, {
      operationId: op.id,
      text: "Lage",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });
    await createMapSymbol(db, {
      operationId: op.id,
      composition: { organisation: "hilfsorganisation" },
      lat: 1,
      lng: 2,
    });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(await listEntries(db, op.id)).toHaveLength(0);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
  });

  it("cascades the operation's Stellen, their Stärkemeldungen and ETB entries", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Cyclassics");
    const station = await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });
    await db.transaction((tx) =>
      recordStrengthReport(tx, {
        stationId: station.id,
        values: {
          leaders: 0,
          subLeaders: 1,
          crew: 6,
          additionalPersonnel: 2,
          note: null,
        },
        author: "anna",
      }),
    );

    await deleteOperation(db, op.id);

    expect(await listStations(db, op.id)).toHaveLength(0);
    expect(await listStrengthReports(db, op.id)).toHaveLength(0);
    expect(await listEntries(db, op.id)).toHaveLength(0);
    const { rows } = await db.query("SELECT id FROM strength_reports");
    expect(rows).toHaveLength(0);
  });

  it("removes the operation's upload directory along with the row", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Hochwasser");
    await createImageOverlay(db, {
      operationId: op.id,
      filePath: await storeOverlayImage(op.id, Buffer.from("plan")),
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: A_PLACEMENT,
    });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    await expect(access(join(uploadsDir, op.id))).rejects.toThrow();
  });

  it("deletes an operation that never had an upload directory", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Ruhig");

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
  });

  it("rejects an Einsatz-ID that is not a UUID", async () => {
    const db = await freshDb();
    await expect(deleteOperation(db, "op-1")).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );
  });
});
