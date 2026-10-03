import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { deleteAccount } from "@/server/auth/account-admin";
import { createSession } from "@/server/auth/login";
import {
  deleteOtherSessionsOfUser,
  deleteSession,
  findUserBySessionToken,
} from "@/server/auth/sessions";
import { deleteOperation } from "@/server/operations/delete-operation";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import {
  elapse,
  expectAccepted,
  useStreamClock,
  WITHIN_A_HEARTBEAT,
} from "@/test/live-connections";
import { expectRouteRequiresLogin, type SendAs } from "@/test/route-checks";
import { signIn } from "@/test/sign-in";
import { routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET } from "./route";

const db = () => state.db as Db;

let operationId: string;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(db());
  operationId = await newOperation();
});

async function newOperation(): Promise<string> {
  return (await insertOperation(db(), { name: "Lage", description: null })).id;
}

const sendAs: SendAs = async (caller) => {
  if (caller === "anonymous") state.token = undefined;
  else if (caller === "an unknown session") state.token = "no-such-session";
  else state.token = await signIn(db());
};

const openLiveEvents = (id: string) =>
  GET(new Request("http://localhost/"), routeParams({ id }));

expectRouteRequiresLogin(
  route,
  {
    GET: {
      send: () => openLiveEvents("op-1"),
      answer: { redirectTo: "/login" },
    },
  },
  { sendAs },
);

describe("GET /operations/[id]/events", () => {
  it("answers 404 for an Einsatz that does not exist", async () => {
    const response = await openLiveEvents(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(response.status).toBe(404);
  });
});

describe("a Live-Verbindung of the Lageansicht", () => {
  useStreamClock();

  const openLageansicht = async (id = operationId) =>
    expectAccepted(await openLiveEvents(id));

  async function signedInUserId(): Promise<string> {
    return (await findUserBySessionToken(db(), state.token!))!.id;
  }

  it("stays open while access remains", async () => {
    const stream = await openLageansicht();
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(false);
  });

  it.each([
    ["after Abmelden", (token: string) => deleteSession(db(), token)],
    [
      "after the session ran out unused",
      () =>
        db().query(
          "UPDATE sessions SET last_seen_at = now() - interval '2 days'",
        ),
    ],
    [
      "after the session expired",
      () =>
        db().query("UPDATE sessions SET expires_at = now() - interval '1 s'"),
    ],
  ])("ends within 30 seconds %s", async (_, endSession) => {
    const stream = await openLageansicht();
    await endSession(state.token!);
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(true);
  });

  it("ends within 30 seconds after „Überall abmelden“ on another device, but not on that device", async () => {
    const userId = await signedInUserId();
    const stream = await openLageansicht();
    state.token = (await createSession(db(), userId)).token;
    const otherDevice = await openLageansicht();

    await deleteOtherSessionsOfUser(db(), userId, state.token);
    await elapse(WITHIN_A_HEARTBEAT);

    expect(stream.ended()).toBe(true);
    expect(otherDevice.ended()).toBe(false);
  });

  it("ends within 30 seconds after the user was deleted, but not another user's", async () => {
    const userId = await signedInUserId();
    const stream = await openLageansicht();
    state.token = await signIn(db());
    const otherUsersStream = await openLageansicht();

    await deleteAccount(db(), userId);
    await elapse(WITHIN_A_HEARTBEAT);

    expect(stream.ended()).toBe(true);
    expect(otherUsersStream.ended()).toBe(false);
  });

  it("stays open after its Einsatz was closed", async () => {
    const stream = await openLageansicht();
    await closeOperation(db(), operationId);
    await elapse(WITHIN_A_HEARTBEAT);
    expect(stream.ended()).toBe(false);
  });

  it("ends within 30 seconds after its Einsatz was deleted, and frees the user's places", async () => {
    await closeOperation(db(), operationId);
    const streams = await Promise.all(
      Array.from({ length: 10 }, () => openLageansicht()),
    );
    const otherOperation = await newOperation();

    await deleteOperation(db(), operationId);
    await elapse(WITHIN_A_HEARTBEAT);

    expect(streams.every((s) => s.ended())).toBe(true);
    expectAccepted(await openLiveEvents(otherOperation));
  });

  it("lets ten in per user, refuses the eleventh, and lets the next in once one closes", async () => {
    const open = await Promise.all(
      Array.from({ length: 10 }, () => openLageansicht()),
    );

    expect((await openLiveEvents(operationId)).status).toBe(429);

    await open[0].close();
    expectAccepted(await openLiveEvents(operationId));
  });

  it("still lets another user in when one user is at the limit", async () => {
    await Promise.all(Array.from({ length: 10 }, () => openLageansicht()));
    state.token = await signIn(db());
    expectAccepted(await openLiveEvents(operationId));
  });
});
