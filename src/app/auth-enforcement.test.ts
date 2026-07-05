import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// Shared, mutable harness state. Read lazily by the mocks below, set per test.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

// The trust/IO boundaries every action and route depends on, faked so the real
// auth logic (requireUser/requireAdmin/resolveDeviceAccess) runs unchanged.
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
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

import { changePasswordAction } from "@/app/account/actions";
import { createAccountAction } from "@/app/admin/users/actions";
import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as deviceGeocodeGET } from "@/app/device/[token]/geocode/route";
import { POST as devicePositionPOST } from "@/app/device/[token]/position/route";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { addJournalEntryAction } from "@/app/operations/[id]/journal-actions";
import { GET as operationOverlayGET } from "@/app/operations/[id]/overlays/[overlayId]/route";
import { createOperationAction } from "@/app/operations/actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { freshDb } from "@/test/db";

async function login(role: "admin" | "user"): Promise<string> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role,
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}

const expectRedirect = (fn: () => Promise<unknown>, to: string) =>
  expect(fn()).rejects.toMatchObject({ redirectTo: to });

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = (url = "http://localhost/") => new Request(url);

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

describe("server action auth enforcement", () => {
  it("createOperationAction redirects to /login when unauthenticated", async () => {
    await expectRedirect(
      () => createOperationAction({}, new FormData()),
      "/login",
    );
  });

  it("addJournalEntryAction redirects to /login when unauthenticated", async () => {
    await expectRedirect(() => addJournalEntryAction("op-1", "Lage"), "/login");
  });

  it("changePasswordAction redirects to /login when unauthenticated", async () => {
    await expectRedirect(
      () => changePasswordAction({}, new FormData()),
      "/login",
    );
  });

  it("createAccountAction redirects an anonymous caller to /login", async () => {
    await expectRedirect(
      () => createAccountAction("neu", "a-very-good-password", false),
      "/login",
    );
  });

  it("createAccountAction redirects a non-admin to /operations", async () => {
    state.token = await login("user");
    await expectRedirect(
      () => createAccountAction("neu", "a-very-good-password", false),
      "/operations",
    );
  });

  it("createAccountAction succeeds for an admin", async () => {
    state.token = await login("admin");
    expect(
      await createAccountAction("neu", "a-very-good-password", false),
    ).toEqual({});
  });
});

describe("route handler auth enforcement", () => {
  it("operation events route redirects to /login when unauthenticated", async () => {
    await expectRedirect(
      () => operationEventsGET(req(), params({ id: "op-1" })),
      "/login",
    );
  });

  it("operation overlay route redirects to /login when unauthenticated", async () => {
    await expectRedirect(
      () =>
        operationOverlayGET(req(), params({ id: "op-1", overlayId: "ov-1" })),
      "/login",
    );
  });

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
