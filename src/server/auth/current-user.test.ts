import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The browser's request headers and cookies, set per request.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  cookieJar: new Map<string, { value: string; options?: CookieOptions }>(),
  headers: {} as Record<string, string>,
}));

type CookieOptions = Record<string, unknown>;

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headers),
  cookies: async () => ({
    get: (name: string) => state.cookieJar.get(name),
    set: (name: string, value: string, options?: CookieOptions) => {
      state.cookieJar.set(name, { value, options });
    },
  }),
}));

import { freshDb } from "@/test/db";
import { getCurrentUser, setSessionCookie } from "./current-user";
import { insertSession } from "./sessions";
import { insertUser } from "./users";

const HOUR = 60 * 60_000;
const LOGIN = Date.parse("2026-10-01T08:00:00Z");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(LOGIN);
  const db = await freshDb();
  state.db = db;
  const user = await insertUser(db, {
    username: "anna",
    passwordHash: "h",
    role: "user",
  });
  state.cookieJar.clear();
  state.cookieJar.set("einsatz_session", { value: "tok" });
  await insertSession(db, {
    token: "tok",
    userId: user.id,
    expiresAt: new Date(LOGIN + 30 * 24 * HOUR),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("getCurrentUser", () => {
  it.each([
    [
      "a page load",
      { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
    ],
    ["an action", { "next-action": "abc123", "sec-fetch-mode": "cors" }],
  ])("counts %s as use", async (_, headers) => {
    expect(await signedInAt(23 * HOUR, headers)).toBe(true);

    expect(await signedInAt(25 * HOUR)).toBe(true);
  });

  it("counts a request as use when the caller says so", async () => {
    expect(
      await signedInAt(23 * HOUR, { "sec-fetch-mode": "cors" }, true),
    ).toBe(true);

    expect(await signedInAt(25 * HOUR)).toBe(true);
  });

  it.each([
    [
      "an automatic reload after a change",
      { rsc: "1", "sec-fetch-mode": "cors" },
    ],
    [
      "the Live-Verbindung",
      { accept: "text/event-stream", "sec-fetch-mode": "cors" },
    ],
    [
      "an image overlay load",
      { "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" },
    ],
    ["a request without Sec-Fetch-Mode", {}],
  ])("serves %s without counting it as use", async (_, headers) => {
    expect(await signedInAt(23 * HOUR, headers)).toBe(true);

    expect(await signedInAt(25 * HOUR)).toBe(false);
  });
});

describe("setSessionCookie", () => {
  const expiresAt = new Date(LOGIN + 30 * 24 * HOUR);

  it("names the cookie __Host-einsatz_session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.cookieJar.clear();

    await setSessionCookie("tok", expiresAt);

    expect([...state.cookieJar.keys()]).toEqual(["__Host-einsatz_session"]);
    const { options } = state.cookieJar.get("__Host-einsatz_session") ?? {};
    expect(options).toMatchObject({ secure: true, path: "/" });
    expect(options).not.toHaveProperty("domain");
    expect(await getCurrentUser()).toMatchObject({ username: "anna" });
  });

  it("keeps the name einsatz_session, without Secure, outside production", async () => {
    state.cookieJar.clear();

    await setSessionCookie("tok", expiresAt);

    expect([...state.cookieJar.keys()]).toEqual(["einsatz_session"]);
    expect(state.cookieJar.get("einsatz_session")?.options).toMatchObject({
      secure: false,
      path: "/",
    });
  });
});

/** Whether a request `sinceLogin` after the login, with `headers`, is signed in. */
async function signedInAt(
  sinceLogin: number,
  headers: Record<string, string> = {},
  recordUse?: boolean,
): Promise<boolean> {
  vi.setSystemTime(LOGIN + sinceLogin);
  state.headers = headers;
  return (await getCurrentUser({ recordUse })) !== null;
}
