import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The browser's request headers and session cookie, set per request.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  headers: {} as Record<string, string>,
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: () => {},
  subscribeOperation: () => () => {},
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.headers),
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

import AccountPage from "@/app/account/page";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { POST as addKmlFilePOST } from "@/app/operations/[id]/kml/route";
import { GET as operationOverlayGET } from "@/app/operations/[id]/overlays/[overlayId]/route";
import { createOperationAction } from "@/app/operations/actions";
import { createSession } from "@/server/auth/login";
import { insertUser } from "@/server/auth/users";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { kmlFileForm } from "@/test/kml-upload";
import { multipartRequest, routeParams } from "@/test/upload-request";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const LOGIN = Date.parse("2026-10-01T08:00:00Z");
let operationId: string;

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
  state.token = (await createSession(db, user.id)).token;
  operationId = (await insertOperation(db, { name: "Lage", description: null }))
    .id;
});

afterEach(() => {
  vi.useRealTimers();
});

type Outcome = "signed in" | "login";

/** What the user's browser sends, by kind of request. */
const requests = {
  "a page load": async () => {
    state.headers = {
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    };
    return outcome(() => AccountPage());
  },
  "an action": async () => {
    state.headers = { "next-action": "abc123", "sec-fetch-mode": "cors" };
    const form = new FormData();
    form.set("name", `Lage ${Date.now()}`);
    return outcome(() => createOperationAction({}, form));
  },
  "an upload": async () => {
    state.headers = { "sec-fetch-mode": "cors" };
    const response = await addKmlFilePOST(
      await multipartRequest("POST", kmlFileForm("Abschnitte", "<kml/>"), {
        "sec-fetch-mode": "cors",
      }),
      routeParams({ id: operationId }),
    );
    return response.status === 401 ? "login" : "signed in";
  },
  "an automatic reload after a change": async () => {
    state.headers = { rsc: "1", "sec-fetch-mode": "cors" };
    return outcome(() => AccountPage());
  },
  "the Live-Verbindung": async () => {
    state.headers = { accept: "text/event-stream", "sec-fetch-mode": "cors" };
    return outcome(async () => {
      const response = await operationEventsGET(
        new Request("http://localhost/"),
        routeParams({ id: operationId }),
      );
      await response.body?.cancel();
    });
  },
  "an image overlay load": async () => {
    state.headers = { "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" };
    return outcome(() =>
      operationOverlayGET(
        new Request("http://localhost/"),
        routeParams({ id: operationId, overlayId: crypto.randomUUID() }),
      ),
    );
  },
} satisfies Record<string, () => Promise<Outcome>>;

async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    await run();
    return "signed in";
  } catch (error) {
    const to = (error as { redirectTo?: string }).redirectTo;
    if (to === "/login") return "login";
    if (to !== undefined) return "signed in";
    throw error;
  }
}

function at(sinceLogin: number) {
  vi.setSystemTime(LOGIN + sinceLogin);
}

describe("session idle timeout", () => {
  it("keeps the session 24 h 5 min after the last use", async () => {
    at(DAY + 5 * MINUTE - 1000);
    expect(await requests["a page load"]()).toBe("signed in");
  });

  it.each(["a page load", "an action", "an upload"] as const)(
    "ends the session for %s 24 h 5 min 1 s after the last use",
    async (request) => {
      at(DAY + 5 * MINUTE + 1000);
      expect(await requests[request]()).toBe("login");
    },
  );

  it("never ends before 24 h after a use that was not written down", async () => {
    at(DAY - 2 * MINUTE);
    expect(await requests["a page load"]()).toBe("signed in");
    at(DAY + 2 * MINUTE);
    expect(await requests["a page load"]()).toBe("signed in");
    at(2 * DAY + MINUTE);
    expect(await requests["a page load"]()).toBe("signed in");
  });

  it.each(["a page load", "an action", "an upload"] as const)(
    "counts %s as use",
    async (request) => {
      at(23 * HOUR);
      expect(await requests[request]()).toBe("signed in");
      at(25 * HOUR);
      expect(await requests["a page load"]()).toBe("signed in");
    },
  );

  it.each([
    "an automatic reload after a change",
    "the Live-Verbindung",
    "an image overlay load",
  ] as const)("serves %s without counting it as use", async (request) => {
    at(23 * HOUR);
    expect(await requests[request]()).toBe("signed in");
    at(25 * HOUR);
    expect(await requests["a page load"]()).toBe("login");
  });

  it("counts no request as use from a browser without Sec-Fetch-Mode", async () => {
    at(23 * HOUR);
    state.headers = {};
    expect(await outcome(() => AccountPage())).toBe("signed in");
    at(25 * HOUR);
    expect(await requests["a page load"]()).toBe("login");
  });
});

describe("session lifetime", () => {
  it("ends the session 30 days after login, however recently it was used", async () => {
    for (let elapsed = 20 * HOUR; elapsed < 30 * DAY; elapsed += 20 * HOUR) {
      at(elapsed);
      expect(await requests["a page load"]()).toBe("signed in");
    }
    at(30 * DAY - MINUTE);
    expect(await requests["a page load"]()).toBe("signed in");
    at(30 * DAY);
    expect(await requests["a page load"]()).toBe("login");
  });
});
