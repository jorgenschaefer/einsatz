import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared, mutable harness state. Read lazily by the mocks below, set per test.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

// The trust/IO boundaries every route depends on, faked so the real auth logic
// (resolveDeviceAccess) runs unchanged.
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
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as deviceGeocodeGET } from "@/app/device/[token]/geocode/route";
import { POST as devicePositionPOST } from "@/app/device/[token]/position/route";
import { freshDb } from "@/test/db";

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = (url = "http://localhost/") => new Request(url);

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

describe("token route auth enforcement (403, not session)", () => {
  it("device events route returns 403 without a valid token", async () => {
    const res = await deviceEventsGET(req(), params({ token: "bad" }));
    expect(res.status).toBe(403);
  });

  it("device geocode route returns 403 without a valid token", async () => {
    const res = await deviceGeocodeGET(req(), params({ token: "bad" }));
    expect(res.status).toBe(403);
  });

  it("device position route returns 403 without a valid token", async () => {
    const res = await devicePositionPOST(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ lat: 53.55, lng: 9.99 }),
      }),
      params({ token: "bad" }),
    );
    expect(res.status).toBe(403);
  });
});
