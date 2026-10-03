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

import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
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
  operationId = (
    await insertOperation(db(), { name: "Lage", description: null })
  ).id;
});

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
