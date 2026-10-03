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

  describe("body size", () => {
    const streamOf = (text: string) =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });

    const postStream = (
      token: string,
      body: ReadableStream<Uint8Array>,
      headers?: HeadersInit,
    ) =>
      POST(
        new Request("http://localhost/", {
          method: "POST",
          body,
          headers,
          duplex: "half",
        } as RequestInit),
        params(token),
      );

    const padded = (json: string, length: number) =>
      json + " ".repeat(length - json.length);

    it("rejects a 1,025-byte body sent as a stream without Content-Length, storing and publishing nothing", async () => {
      const { db, op, token } = await aDeviceLink();

      const res = await postStream(
        token,
        streamOf(padded('{"lat":50,"lng":8}', 1025)),
      );

      expect(res.status).toBe(413);
      const [symbol] = await listMapSymbols(db, op.id);
      expect(symbol).toMatchObject({ lat: 1, lng: 2, reportedAt: null });
      expect(publishOperationChanged).not.toHaveBeenCalled();
    });

    it("stops reading an endless stream shortly after 1 KB", async () => {
      const { token } = await aDeviceLink();
      const chunk = new TextEncoder().encode(" ".repeat(100));
      let pulls = 0;
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          controller.enqueue(chunk);
        },
      });

      const res = await postStream(token, endless);

      expect(res.status).toBe(413);
      expect(pulls * chunk.length).toBeLessThanOrEqual(1024 + 2 * chunk.length);
    });

    it("accepts a body of exactly 1,024 bytes", async () => {
      const { db, op, token } = await aDeviceLink();

      const res = await postStream(
        token,
        streamOf(padded('{"lat":50,"lng":8}', 1024)),
      );

      expect(res.status).toBe(204);
      const [symbol] = await listMapSymbols(db, op.id);
      expect(symbol).toMatchObject({ lat: 50, lng: 8 });
    });

    it("rejects an announced Content-Length over 1,024 without reading the body", async () => {
      const { token } = await aDeviceLink();
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls++;
            controller.enqueue(new TextEncoder().encode('{"lat":50,"lng":8}'));
            controller.close();
          },
        },
        { highWaterMark: 0 },
      );

      const res = await postStream(token, body, { "content-length": "1025" });

      expect(res.status).toBe(413);
      expect(pulls).toBe(0);
    });

    it("rejects an oversize body before checking the token", async () => {
      const res = await postStream(
        "never-issued",
        streamOf(padded('{"lat":50,"lng":8}', 1025)),
      );

      expect(res.status).toBe(413);
    });

    it("answers 400 when the body breaks off while being read", async () => {
      const { token } = await aDeviceLink();
      const broken = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("connection reset"));
        },
      });

      const res = await postStream(token, broken);

      expect(res.status).toBe(400);
      expect(publishOperationChanged).not.toHaveBeenCalled();
    });

    it("still answers 400 for a body that is not JSON", async () => {
      const { token } = await aDeviceLink();

      const res = await postStream(token, streamOf("not json"));

      expect(res.status).toBe(400);
    });
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
