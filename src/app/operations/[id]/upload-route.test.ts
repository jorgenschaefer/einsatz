import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "sec-fetch-mode": "cors" }),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));

import { findUserBySessionToken, insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { freshDb } from "@/test/db";
import { multipartRequest } from "@/test/upload-request";
import { formJson, handleUpload } from "./upload-route";

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
  state.token = "tok";
  await insertSession(db, {
    token: state.token,
    userId: user.id,
    expiresAt: new Date(LOGIN + 30 * 24 * HOUR),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("handleUpload", () => {
  it("counts an upload as use of the session", async () => {
    vi.setSystemTime(LOGIN + 23 * HOUR);
    const response = await handleUpload(
      await multipartRequest("POST", new FormData()),
      { tooLarge: "zu groß", failed: "fehlgeschlagen" },
      async () => "op-1",
    );
    expect(response.status).toBe(200);

    expect(
      await findUserBySessionToken(
        state.db as Db,
        "tok",
        new Date(LOGIN + 25 * HOUR),
      ),
    ).not.toBeNull();
  });
});

describe("formJson", () => {
  it("gives nothing for a field the form does not have", () => {
    expect(formJson(new FormData(), "view")).toBeUndefined();
  });

  it("gives nothing for a field that is not JSON", () => {
    const form = new FormData();
    form.append("view", "{lat: 53.55");

    expect(formJson(form, "view")).toBeUndefined();
  });
});
