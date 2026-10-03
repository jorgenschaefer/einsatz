import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";
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

describe("a Live-Verbindung of the Ansicht", () => {
  useStreamClock();

  let operationId: string;

  beforeEach(async () => {
    operationId = (
      await insertOperation(db(), { name: "Lage", description: null })
    ).id;
  });

  const newViewLink = (label = "Stab") =>
    createViewLink(db(), { operationId, label });

  const openAnsicht = async (token: string) =>
    expectAccepted(await openLiveEvents(token));

  it("ends within 30 seconds after its Ansichtslink was deleted, but not another one", async () => {
    const link = await newViewLink();
    const stream = await openAnsicht(link.token);
    const otherStream = await openAnsicht((await newViewLink("Presse")).token);

    await deleteViewLink(db(), operationId, link.id);
    await elapse(WITHIN_A_HEARTBEAT);

    expect(stream.ended()).toBe(true);
    expect(otherStream.ended()).toBe(false);
  });

  it("ends within 30 seconds after its Einsatz was closed", async () => {
    const stream = await openAnsicht((await newViewLink()).token);
    await closeOperation(db(), operationId);
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(true);
  });

  it("lets fifty in per Ansichtslink, refuses the fifty-first, and lets the next in once one closes", async () => {
    const { token } = await newViewLink();
    const open = await Promise.all(
      Array.from({ length: 50 }, () => openAnsicht(token)),
    );

    expect((await openLiveEvents(token)).status).toBe(429);

    await open[0].close();
    expectAccepted(await openLiveEvents(token));
  });

  it("still lets another Ansichtslink of the same Einsatz in", async () => {
    const { token } = await newViewLink();
    await Promise.all(Array.from({ length: 50 }, () => openAnsicht(token)));
    expectAccepted(await openLiveEvents((await newViewLink("Presse")).token));
  });
});
