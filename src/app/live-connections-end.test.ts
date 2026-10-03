import { setTimeout as realDelay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
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

import { logoutAction, logoutOtherSessionsAction } from "@/app/account/actions";
import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { GET as viewEventsGET } from "@/app/view/[token]/events/route";
import { deleteAccount } from "@/server/auth/account-admin";
import { createSession } from "@/server/auth/login";
import { type AuthenticatedUser, insertUser } from "@/server/auth/users";
import {
  createMapSymbol,
  generateDeviceLink,
  removeDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { deleteOperation } from "@/server/operations/delete-operation";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink, deleteViewLink } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";

const WITHIN = 30_000;
const HOUR = 60 * 60_000;

let db: Db;
let anna: AuthenticatedUser;
let operationId: string;
const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];

beforeEach(async () => {
  // Nur die Uhr des Stroms faken; die DB braucht echte Timer.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  db = await freshDb();
  state.db = db;
  anna = await signUp("anna");
  state.token = await signIn(anna);
  operationId = await newOperation();
});

afterEach(async () => {
  for (const reader of openReaders.splice(0)) await reader.cancel();
  vi.useRealTimers();
});

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = () => new Request("http://localhost/");

const signUp = (username: string) =>
  insertUser(db, { username, passwordHash: "h", role: "user" });

async function signIn(user: AuthenticatedUser): Promise<string> {
  return (await createSession(db, user.id)).token;
}

async function newOperation(): Promise<string> {
  return (await insertOperation(db, { name: "Lage", description: null })).id;
}

async function newMapSymbol(operation = operationId): Promise<string> {
  const symbol = await createMapSymbol(db, {
    operationId: operation,
    composition: {},
    lat: 53.55,
    lng: 9.99,
  });
  return symbol.id;
}

interface Watched {
  ended: () => boolean;
}

/** Hält die Antwort offen und liest sie im Hintergrund, bis sie endet. */
function watch(res: Response): Watched {
  expect(res.status).toBe(200);
  const reader = res.body!.getReader();
  openReaders.push(reader);
  let ended = false;
  void (async () => {
    while (!(await reader.read()).done);
    ended = true;
  })();
  return { ended: () => ended };
}

const openLageansicht = async (operation = operationId) =>
  watch(await operationEventsGET(req(), params({ id: operation })));
const openGeraeteansicht = async (token: string) =>
  watch(await deviceEventsGET(req(), params({ token })));
const openAnsicht = async (token: string) =>
  watch(await viewEventsGET(req(), params({ token })));

/** Lässt `ms` Stromzeit vergehen und wartet die echte DB-Arbeit der Prüfung ab. */
async function elapse(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await realDelay(150);
}

describe("a Live-Verbindung ends within 30 seconds", () => {
  it("after Abmelden", async () => {
    const stream = await openLageansicht();
    await logoutAction().catch(() => {});
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
  });

  it("after the session ran out unused", async () => {
    const stream = await openLageansicht();
    await db.query(
      "UPDATE sessions SET last_seen_at = now() - interval '2 days'",
    );
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
  });

  it("after the session expired", async () => {
    const stream = await openLageansicht();
    await db.query("UPDATE sessions SET expires_at = now() - interval '1 s'");
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
  });

  it("after „Überall abmelden“ on another device, but not on that device", async () => {
    const stream = await openLageansicht();
    state.token = await signIn(anna);
    const otherDevice = await openLageansicht();
    await logoutOtherSessionsAction();
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
    expect(otherDevice.ended()).toBe(false);
  });

  it("after the user was deleted, but not another user's", async () => {
    const stream = await openLageansicht();
    state.token = await signIn(await signUp("bert"));
    const bertsStream = await openLageansicht();
    await deleteAccount(db, anna.id);
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
    expect(bertsStream.ended()).toBe(false);
  });

  it("after its Ansichtslink was deleted, but not another one", async () => {
    const link = await createViewLink(db, { operationId, label: "Stab" });
    const other = await createViewLink(db, { operationId, label: "Presse" });
    const stream = await openAnsicht(link.token);
    const otherStream = await openAnsicht(other.token);
    await deleteViewLink(db, link.id);
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
    expect(otherStream.ended()).toBe(false);
  });

  it("after its Gerätelink was removed", async () => {
    const symbolId = await newMapSymbol();
    const stream = await openGeraeteansicht(
      await generateDeviceLink(db, symbolId),
    );
    await removeDeviceLink(db, symbolId);
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
  });

  it("after its Gerätelink was regenerated, but not the new link's", async () => {
    const symbolId = await newMapSymbol();
    const stream = await openGeraeteansicht(
      await generateDeviceLink(db, symbolId),
    );
    const newStream = await openGeraeteansicht(
      await generateDeviceLink(db, symbolId),
    );
    await elapse(WITHIN);
    expect(stream.ended()).toBe(true);
    expect(newStream.ended()).toBe(false);
  });

  it("after its Einsatz was closed – for links, not for the Lageansicht or another Einsatz", async () => {
    const device = await openGeraeteansicht(
      await generateDeviceLink(db, await newMapSymbol()),
    );
    const view = await openAnsicht(
      (await createViewLink(db, { operationId, label: "Stab" })).token,
    );
    const lageansicht = await openLageansicht();
    const otherOperation = await newOperation();
    const otherDevice = await openGeraeteansicht(
      await generateDeviceLink(db, await newMapSymbol(otherOperation)),
    );

    await closeOperation(db, operationId);
    await elapse(WITHIN);

    expect(device.ended()).toBe(true);
    expect(view.ended()).toBe(true);
    expect(lageansicht.ended()).toBe(false);
    expect(otherDevice.ended()).toBe(false);
  });

  it("after its Einsatz was deleted, and frees the user's place", async () => {
    await closeOperation(db, operationId);
    const streams = await Promise.all(
      Array.from({ length: 10 }, () => openLageansicht()),
    );
    const otherOperation = await newOperation();

    await deleteOperation(db, operationId);
    await elapse(WITHIN);

    expect(streams.every((s) => s.ended())).toBe(true);
    await openLageansicht(otherOperation); // 200, not 429
  });
});

describe("a Live-Verbindung", () => {
  it("stays open while access remains", async () => {
    const stream = await openLageansicht();
    await elapse(WITHIN);
    expect(stream.ended()).toBe(false);
  });

  it("ends after one hour, and frees its place", async () => {
    const streams = await Promise.all(
      Array.from({ length: 10 }, () => openLageansicht()),
    );
    await elapse(HOUR);
    expect(streams.every((s) => s.ended())).toBe(true);
    await openLageansicht(); // 200, not 429
  });
});
