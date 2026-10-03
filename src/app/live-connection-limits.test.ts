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

import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { GET as viewEventsGET } from "@/app/view/[token]/events/route";
import { createSession } from "@/server/auth/login";
import { insertUser } from "@/server/auth/users";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";

let db: Db;
let operationId: string;

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  operationId = (await insertOperation(db, { name: "Lage", description: null }))
    .id;
});

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = () => new Request("http://localhost/");

async function signIn(username: string): Promise<void> {
  const user = await insertUser(db, {
    username,
    passwordHash: "h",
    role: "user",
  });
  state.token = (await createSession(db, user.id)).token;
}

const openLageansicht = () =>
  operationEventsGET(req(), params({ id: operationId }));

async function deviceLink(): Promise<string> {
  const symbol = await createMapSymbol(db, {
    operationId,
    composition: {},
    lat: 53.55,
    lng: 9.99,
  });
  return generateDeviceLink(db, symbol.operationId, symbol.id);
}

async function viewLink(): Promise<string> {
  return (await createViewLink(db, { operationId, label: "Stab" })).token;
}

/** Öffnet `count` Live-Verbindungen; der Test schließt sie über `closeAll`. */
async function openMany(
  count: number,
  open: () => Promise<Response>,
): Promise<Response[]> {
  const responses: Response[] = [];
  for (let i = 0; i < count; i++) responses.push(await open());
  return responses;
}

async function closeAll(responses: Response[]): Promise<void> {
  for (const res of responses) if (res.body) await res.body.cancel();
}

const statuses = (responses: Response[]) => responses.map((r) => r.status);

describe("Live-Verbindungen je Nutzer", () => {
  it("lets ten in, refuses the eleventh, and lets the next in once one closes", async () => {
    await signIn("anna");
    const open = await openMany(10, openLageansicht);
    expect(statuses(open)).toEqual(Array(10).fill(200));

    const refused = await openLageansicht();
    expect(refused.status).toBe(429);

    await open[0].body?.cancel();
    const next = await openLageansicht();
    expect(next.status).toBe(200);
    await closeAll([...open.slice(1), next]);
  });

  it("still lets another user in when one user is at the limit", async () => {
    await signIn("anna");
    const open = await openMany(10, openLageansicht);
    await signIn("bert");
    const other = await openLageansicht();
    expect(other.status).toBe(200);
    await closeAll([...open, other]);
  });

  it("answers 404 for an Einsatz that does not exist", async () => {
    await signIn("anna");
    const res = await operationEventsGET(
      req(),
      params({ id: "00000000-0000-4000-8000-000000000000" }),
    );
    expect(res.status).toBe(404);
  });
});

describe("Live-Verbindungen je Gerätelink", () => {
  it("lets ten in, refuses the eleventh, and lets the next in once one closes", async () => {
    const token = await deviceLink();
    const openDevice = () => deviceEventsGET(req(), params({ token }));
    const open = await openMany(10, openDevice);
    expect(statuses(open)).toEqual(Array(10).fill(200));

    expect((await openDevice()).status).toBe(429);

    await open[0].body?.cancel();
    const next = await openDevice();
    expect(next.status).toBe(200);
    await closeAll([...open.slice(1), next]);
  });

  it("still lets another Gerätelink of the same Einsatz in", async () => {
    const token = await deviceLink();
    const open = await openMany(10, () =>
      deviceEventsGET(req(), params({ token })),
    );
    const other = await deviceEventsGET(
      req(),
      params({ token: await deviceLink() }),
    );
    expect(other.status).toBe(200);
    await closeAll([...open, other]);
  });
});

describe("Live-Verbindungen je Ansichtslink", () => {
  it("lets fifty in, refuses the fifty-first, and lets the next in once one closes", async () => {
    const token = await viewLink();
    const openView = () => viewEventsGET(req(), params({ token }));
    const open = await openMany(50, openView);
    expect(statuses(open)).toEqual(Array(50).fill(200));

    expect((await openView()).status).toBe(429);

    await open[0].body?.cancel();
    const next = await openView();
    expect(next.status).toBe(200);
    await closeAll([...open.slice(1), next]);
  });

  it("still lets another Ansichtslink of the same Einsatz in", async () => {
    const token = await viewLink();
    const open = await openMany(50, () =>
      viewEventsGET(req(), params({ token })),
    );
    const other = await viewEventsGET(
      req(),
      params({ token: await viewLink() }),
    );
    expect(other.status).toBe(200);
    await closeAll([...open, other]);
  });
});
