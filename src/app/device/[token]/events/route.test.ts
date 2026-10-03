import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import {
  createMapSymbol,
  generateDeviceLink,
  removeDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import {
  elapse,
  expectAccepted,
  useStreamClock,
  WITHIN_A_HEARTBEAT,
} from "@/test/live-connections";
import { expectRouteRequiresToken } from "@/test/route-checks";
import { routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET } from "./route";

const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
});

const openLiveEvents = (token: string) =>
  GET(new Request("http://localhost/"), routeParams({ token }));

expectRouteRequiresToken(route, { GET: { send: openLiveEvents } });

describe("a Live-Verbindung of the Geräteansicht", () => {
  useStreamClock();

  let operationId: string;
  let symbolId: string;

  beforeEach(async () => {
    operationId = await newOperation();
    symbolId = await newMapSymbol(operationId);
  });

  const openGeraeteansicht = async (token: string) =>
    expectAccepted(await openLiveEvents(token));

  it("ends within 30 seconds after its Gerätelink was removed", async () => {
    const stream = await openGeraeteansicht(
      await generateDeviceLink(db(), operationId, symbolId),
    );
    await removeDeviceLink(db(), operationId, symbolId);
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(true);
  });

  it("ends within 30 seconds after its Gerätelink was regenerated, but not the new link's", async () => {
    const stream = await openGeraeteansicht(
      await generateDeviceLink(db(), operationId, symbolId),
    );
    const newStream = await openGeraeteansicht(
      await generateDeviceLink(db(), operationId, symbolId),
    );
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(true);
    expect(newStream.ended()).toBe(false);
  });

  it("ends within 30 seconds after its Einsatz was closed, but not another Einsatz's", async () => {
    const stream = await openGeraeteansicht(
      await generateDeviceLink(db(), operationId, symbolId),
    );
    const otherOperation = await newOperation();
    const otherStream = await openGeraeteansicht(
      await generateDeviceLink(
        db(),
        otherOperation,
        await newMapSymbol(otherOperation),
      ),
    );

    await closeOperation(db(), operationId);
    await elapse(WITHIN_A_HEARTBEAT);

    expect(stream.ended()).toBe(true);
    expect(otherStream.ended()).toBe(false);
  });

  it("lets ten in per Gerätelink, refuses the eleventh, and lets the next in once one closes", async () => {
    const token = await generateDeviceLink(db(), operationId, symbolId);
    const open = await Promise.all(
      Array.from({ length: 10 }, () => openGeraeteansicht(token)),
    );

    expect((await openLiveEvents(token)).status).toBe(429);

    await open[0].close();
    expectAccepted(await openLiveEvents(token));
  });

  it("still lets another Gerätelink of the same Einsatz in", async () => {
    const token = await generateDeviceLink(db(), operationId, symbolId);
    await Promise.all(
      Array.from({ length: 10 }, () => openGeraeteansicht(token)),
    );
    const otherSymbol = await newMapSymbol(operationId);
    expectAccepted(
      await openLiveEvents(
        await generateDeviceLink(db(), operationId, otherSymbol),
      ),
    );
  });
});

async function newOperation(): Promise<string> {
  return (await insertOperation(db(), { name: "Lage", description: null })).id;
}

async function newMapSymbol(operationId: string): Promise<string> {
  const symbol = await createMapSymbol(db(), {
    operationId,
    composition: {},
    lat: 53.55,
    lng: 9.99,
  });
  return symbol.id;
}
