import { randomUUID } from "node:crypto";
import type { Db, Queryable } from "@/server/db/db";
import { appendEntry } from "@/server/journal/journal";
import { ValidationError } from "@/server/validation";

export interface Station {
  id: string;
  operationId: string;
  name: string;
}

interface StationRow {
  id: string;
  operation_id: string;
  name: string;
}

const toStation = (row: StationRow): Station => ({
  id: row.id,
  operationId: row.operation_id,
  name: row.name,
});

const COLUMNS = "id, operation_id, name";

// Der ETB-Eintrag wird vor der Stelle geschrieben: so sperrt appendEntry die
// Einsatz-Zeile (FOR UPDATE), bevor der Fremdschlüssel sie per FOR KEY SHARE
// belegt – andersherum verklemmt sich paralleles Anlegen.

export async function createStation(
  db: Db,
  input: { operationId: string; name: string; author: string },
): Promise<Station> {
  const name = requireStationName(input.name);
  return db.transaction(async (tx) => {
    await appendEntry(tx, {
      operationId: input.operationId,
      text: `Stelle angelegt: ${name}`,
      type: "stelle-angelegt",
      author: input.author,
    });
    const { rows } = await rejectingDuplicateName(() =>
      tx.query<StationRow>(
        `INSERT INTO stations (id, operation_id, name)
         VALUES ($1, $2, $3)
         RETURNING ${COLUMNS}`,
        [randomUUID(), input.operationId, name],
      ),
    );
    return toStation(rows[0]);
  });
}

/** Benennt die Stelle um; liefert die `operationId` ihres Gesamteinsatzes. */
export async function renameStation(
  db: Db,
  input: { stationId: string; name: string; author: string },
): Promise<string> {
  const name = requireStationName(input.name);
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<StationRow>(
      `SELECT ${COLUMNS} FROM stations WHERE id = $1 FOR UPDATE`,
      [input.stationId],
    );
    if (!rows[0]) throw new ValidationError("Stelle nicht gefunden.");
    const station = toStation(rows[0]);
    if (station.name === name) return station.operationId;
    await appendEntry(tx, {
      operationId: station.operationId,
      text: `Stelle umbenannt: ${station.name} → ${name}`,
      type: "stelle-umbenannt",
      author: input.author,
    });
    await rejectingDuplicateName(() =>
      tx.query("UPDATE stations SET name = $2 WHERE id = $1", [
        station.id,
        name,
      ]),
    );
    return station.operationId;
  });
}

export async function listStations(
  db: Queryable,
  operationId: string,
): Promise<Station[]> {
  const { rows } = await db.query<StationRow>(
    `SELECT ${COLUMNS} FROM stations WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toStation);
}

function requireStationName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new ValidationError("Der Name der Stelle darf nicht leer sein.");
  }
  return name;
}

const UNIQUE_VIOLATION = "23505";

/** Übersetzt den Verstoß gegen den eindeutigen Namen (stations_operation_name_idx). */
async function rejectingDuplicateName<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new ValidationError("Eine Stelle mit diesem Namen gibt es schon.");
    }
    throw err;
  }
}
