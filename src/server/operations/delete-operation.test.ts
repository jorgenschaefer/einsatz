import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { uploadsDirPerTest } from "@/test/uploads-dir";
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

const uploadsDir = uploadsDirPerTest();

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
    await access(join(uploadsDir(), op.id));
  });

  it("reports that a closed operation was deleted", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Hochwasser");

    expect(await deleteOperation(db, op.id)).toBe(true);
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
    await expect(access(join(uploadsDir(), op.id))).rejects.toThrow();
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
