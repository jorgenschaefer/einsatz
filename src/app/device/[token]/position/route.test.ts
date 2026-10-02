import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { closeOperation } from "@/server/operations/operation-lifecycle";
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

afterEach(() => {
  vi.useRealTimers();
});

async function aDeviceLink() {
  const db = state.db as Db;
  const op = await insertOperation(db, { name: "Lage", description: null });
  const symbol = await createMapSymbol(db, {
    operationId: op.id,
    composition: {},
    lat: 1,
    lng: 2,
  });
  const token = await generateDeviceLink(db, symbol.id);
  return { db, op, token };
}

async function postAt(at: Date, token: string, body: unknown) {
  vi.setSystemTime(at);
  return post(token, body);
}

const first = new Date("2026-10-03T12:00:00.000Z");
const later = (ms: number) => new Date(first.getTime() + ms);

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

  describe("throttling", () => {
    it("answers 204 but neither stores nor publishes a report less than 5 s after the last stored one", async () => {
      const { db, op, token } = await aDeviceLink();

      expect((await postAt(first, token, { lat: 50, lng: 8 })).status).toBe(
        204,
      );
      const res = await postAt(later(4_900), token, { lat: 51, lng: 7 });

      expect(res.status).toBe(204);
      const [symbol] = await listMapSymbols(db, op.id);
      expect(symbol).toMatchObject({ lat: 50, lng: 8 });
      expect(symbol.reportedAt?.toISOString()).toBe(first.toISOString());
      expect(publishOperationChanged).toHaveBeenCalledTimes(1);
    });

    it("stores and publishes a report exactly 5 s after the last stored one", async () => {
      const { db, op, token } = await aDeviceLink();

      await postAt(first, token, { lat: 50, lng: 8 });
      await postAt(later(4_900), token, { lat: 51, lng: 7 });
      const res = await postAt(later(5_000), token, { lat: 52, lng: 6 });

      expect(res.status).toBe(204);
      const [symbol] = await listMapSymbols(db, op.id);
      expect(symbol).toMatchObject({ lat: 52, lng: 6 });
      expect(symbol.reportedAt?.toISOString()).toBe(later(5_000).toISOString());
      expect(publishOperationChanged).toHaveBeenCalledTimes(2);
    });

    it("still denies a closed Einsatz within 5 s of a stored report", async () => {
      const { db, op, token } = await aDeviceLink();
      await postAt(first, token, { lat: 50, lng: 8 });
      await closeOperation(db, op.id);

      const res = await postAt(later(1_000), token, { lat: 51, lng: 7 });

      expect(res.status).toBe(403);
      expect(publishOperationChanged).toHaveBeenCalledTimes(1);
    });

    it("still denies an unknown token within 5 s of a stored report", async () => {
      const { token } = await aDeviceLink();
      await postAt(first, token, { lat: 50, lng: 8 });

      const res = await postAt(later(1_000), "never-issued", {
        lat: 51,
        lng: 7,
      });

      expect(res.status).toBe(403);
      expect(publishOperationChanged).toHaveBeenCalledTimes(1);
    });
  });
});
