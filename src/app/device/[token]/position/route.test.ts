import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
const publishOperationChanged = vi.fn();

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: (id: string) => publishOperationChanged(id),
}));

import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { POST } from "./route";

const params = (token: string) => ({ params: Promise.resolve({ token }) });
const post = (token: string, body: unknown) =>
  POST(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    params(token),
  );

beforeEach(async () => {
  state.db = await freshDb();
  publishOperationChanged.mockReset();
});

describe("device position route", () => {
  it("publishes with the operationId from reportPosition, without a second lookup", async () => {
    const db = state.db as Db;
    const op = await insertOperation(db, { name: "Lage", description: null });
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition: {},
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);

    const res = await post(token, { lat: 53.55, lng: 9.99 });

    expect(res.status).toBe(204);
    expect(publishOperationChanged).toHaveBeenCalledWith(op.id);
  });

  it("does not publish when the token is denied", async () => {
    const res = await post("never-issued", { lat: 53.55, lng: 9.99 });
    expect(res.status).toBe(403);
    expect(publishOperationChanged).not.toHaveBeenCalled();
  });
});
