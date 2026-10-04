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

import { MAX_KML_BYTES } from "@/kml/kmz";
import { findUserBySessionToken, insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { MAX_UPLOAD_BYTES } from "@/server/image-overlays/image-upload";
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

  it.each([
    ["KML file", MAX_KML_BYTES],
    ["Bild-Overlay file", MAX_UPLOAD_BYTES],
  ])("reads a form carrying a %s of the largest size", async (_, bytes) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), "gross");
    let received: number | undefined;

    const response = await handleUpload(
      await multipartRequest("POST", form),
      { tooLarge: "zu groß", failed: "fehlgeschlagen" },
      async (_db, sent) => {
        received = (sent.get("file") as File).size;
        return "op-1";
      },
    );

    expect(response.status).toBe(200);
    expect(received).toBe(bytes);
  });

  it.each([
    ["its Host", { origin: "https://einsatz.test", host: "einsatz.test" }],
    [
      "the host the reverse proxy forwards",
      {
        origin: "https://einsatz.drk.test",
        host: "app:3000",
        "x-forwarded-host": "einsatz.drk.test, proxy.internal",
      },
    ],
  ])("accepts an upload with an Origin matching %s", async (_, headers) => {
    const response = await handleUpload(
      await multipartRequest("POST", new FormData(), headers),
      { tooLarge: "zu groß", failed: "fehlgeschlagen" },
      async () => "op-1",
    );

    expect(response.status).toBe(200);
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
