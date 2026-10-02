import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
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
import { freshDb } from "@/test/db";
import { createOperation } from "./create-operation";
import { deleteOperation } from "./delete-operation";
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

describe("deleteOperation (domain)", () => {
  it("deletes the operation and cascades its journal entries and map symbols", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" }); // has an automatic entry
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
    const op = await createOperation(db, { name: "Cyclassics" });
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
    const op = await createOperation(db, { name: "Hochwasser" });
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
    const op = await createOperation(db, { name: "Ruhig" });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
  });
});
