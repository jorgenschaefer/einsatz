import { describe, expect, it } from "vitest";
import type { AreaGeometry } from "@/map/area";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createArea,
  deleteArea,
  listAreas,
  updateAreaGeometry,
  updateAreaStyle,
} from "./areas";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

const polygon: AreaGeometry = {
  shape: "polygon",
  points: [
    { lat: 1, lng: 2 },
    { lat: 3, lng: 4 },
    { lat: 5, lng: 6 },
  ],
};
const line: AreaGeometry = {
  shape: "line",
  points: [
    { lat: 1, lng: 2 },
    { lat: 3, lng: 4 },
  ],
};
const circle: AreaGeometry = {
  shape: "circle",
  center: { lat: 53.5, lng: 9.9 },
  radius: 250,
};

describe("areas repository", () => {
  it("creates and lists areas with their geometry round-tripped, for all three shapes", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    for (const geometry of [polygon, line, circle]) {
      await createArea(db, {
        operationId: op.id,
        geometry,
        color: "#e2001a",
        opacity: 0.4,
        label: "Zone",
      });
    }
    const areas = await listAreas(db, op.id);
    expect(areas.map((a) => a.geometry)).toEqual([polygon, line, circle]);
    expect(
      areas.every(
        (a) => a.color === "#e2001a" && a.opacity === 0.4 && a.label === "Zone",
      ),
    ).toBe(true);
  });

  it("scopes areas to their operation", async () => {
    const db = await freshDb();
    const a = await anOperation(db);
    const b = await anOperation(db);
    await createArea(db, {
      operationId: a.id,
      geometry: circle,
      color: "#000",
      opacity: 0.5,
      label: "",
    });
    expect(await listAreas(db, b.id)).toHaveLength(0);
  });

  it("updates style and geometry, and deletes", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const area = await createArea(db, {
      operationId: op.id,
      geometry: polygon,
      color: "#000",
      opacity: 0.5,
      label: "alt",
    });

    await updateAreaStyle(db, area.id, {
      color: "#00ff00",
      opacity: 0.8,
      label: "neu",
    });
    await updateAreaGeometry(db, area.id, circle);
    const [loaded] = await listAreas(db, op.id);
    expect(loaded).toMatchObject({
      color: "#00ff00",
      opacity: 0.8,
      label: "neu",
    });
    expect(loaded.geometry).toEqual(circle);

    await deleteArea(db, area.id);
    expect(await listAreas(db, op.id)).toHaveLength(0);
  });

  it("rejects geometry with an out-of-range point", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const bad: AreaGeometry = {
      shape: "polygon",
      points: [
        { lat: 1, lng: 2 },
        { lat: 200, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    };
    await expect(
      createArea(db, {
        operationId: op.id,
        geometry: bad,
        color: "#e2001a",
        opacity: 0.4,
        label: "",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listAreas(db, op.id)).toHaveLength(0);
  });

  it("rejects a circle with a non-positive radius", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const bad: AreaGeometry = {
      shape: "circle",
      center: { lat: 53.55, lng: 9.99 },
      radius: 0,
    };
    await expect(
      createArea(db, {
        operationId: op.id,
        geometry: bad,
        color: "#e2001a",
        opacity: 0.4,
        label: "",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a style with opacity out of range", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const area = await createArea(db, {
      operationId: op.id,
      geometry: polygon,
      color: "#e2001a",
      opacity: 0.4,
      label: "",
    });
    await expect(
      updateAreaStyle(db, area.id, {
        color: "#e2001a",
        opacity: 2,
        label: "",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
