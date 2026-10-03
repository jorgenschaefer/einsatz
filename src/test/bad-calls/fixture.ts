import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createArea } from "@/server/areas/areas";
import { hashPassword } from "@/server/auth/password";
import { insertUser } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { appendEntry } from "@/server/journal/journal";
import { createKmlOverlay } from "@/server/kml/kml-overlays";
import { createMapSymbol } from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { createStation } from "@/server/strength/stations";
import { recordStrengthReport } from "@/server/strength/strength-reports";
import { createViewLink } from "@/server/viewlinks/view-links";

/** Je ein Objekt jeder Art in einem Einsatz, dazu ein weiteres Konto. */
export interface Fixture {
  operationId: string;
  symbolId: string;
  areaId: string;
  kmlId: string;
  imageId: string;
  viewLinkId: string;
  entryId: string;
  stationId: string;
  reportId: string;
  userId: string;
}

export const PLACEMENT = {
  centerLat: 50,
  centerLng: 8,
  scaleM: 10,
  rotationDeg: 0,
  opacity: 1,
};
export const STYLE = { color: "#e2001a", opacity: 0.4, label: "Zone" };
export const ENTRY = {
  text: "Lage ruhig",
  sender: null,
  recipient: null,
  channel: null,
};
export const VALUES = {
  leaders: 1,
  subLeaders: 2,
  crew: 6,
  additionalPersonnel: 0,
  note: null,
};
/** Das Passwort jedes Kontos hier, auch des angemeldeten aus `signIn`. */
export const PASSWORD = "a-very-good-password";

/**
 * Je ein Objekt jeder Art in einem neuen Einsatz, die Datei des Bild-Overlays
 * unter `uploadsDir`, dazu ein weiteres Konto.
 */
export async function oneOfEach(db: Db, uploadsDir: string): Promise<Fixture> {
  const { id: operationId } = await insertOperation(db, {
    name: "Lage",
    description: null,
  });
  const symbol = await createMapSymbol(db, {
    operationId,
    composition: { text: "Florian 1" },
    lat: 53.55,
    lng: 9.99,
  });
  const area = await createArea(db, {
    operationId,
    geometry: { shape: "circle", center: { lat: 53.5, lng: 10 }, radius: 100 },
    ...STYLE,
  });
  const kml = await createKmlOverlay(db, {
    operationId,
    sourceType: "url",
    sourceUrl: "https://example.org/pegel.kml",
    name: "Pegel",
    content: "<kml>alt</kml>",
  });
  const filePath = `${operationId}/plan.webp`;
  await mkdir(join(uploadsDir, operationId), { recursive: true });
  await writeFile(join(uploadsDir, filePath), "webp");
  const image = await createImageOverlay(db, {
    operationId,
    filePath,
    name: "Plan",
    widthPx: 1000,
    heightPx: 1000,
    placement: PLACEMENT,
  });
  const viewLink = await createViewLink(db, {
    operationId,
    label: "Leitstelle",
  });
  const entry = await db.transaction((tx) =>
    appendEntry(tx, {
      operationId,
      text: ENTRY.text,
      type: "manuell",
      author: "anna",
      route: ENTRY,
    }),
  );
  const station = await createStation(db, {
    operationId,
    name: "UHSt 1",
    author: "anna",
  });
  await db.transaction((tx) =>
    recordStrengthReport(tx, {
      stationId: station.id,
      values: VALUES,
      author: "anna",
    }),
  );
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM strength_reports",
  );
  const user = await insertUser(db, {
    username: "berta",
    passwordHash: await hashPassword(PASSWORD),
    role: "user",
  });
  return {
    operationId,
    symbolId: symbol.id,
    areaId: area.id,
    kmlId: kml.id,
    imageId: image.id,
    viewLinkId: viewLink.id,
    entryId: entry.id,
    stationId: station.id,
    reportId: rows[0].id,
    userId: user.id,
  };
}
