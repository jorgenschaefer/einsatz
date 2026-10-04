import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";
import { type FetchStub, scriptedFetch } from "@/test/scripted-fetch";

// IO-/Trust-Grenzen faken, damit die echte Routen-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  revalidatedPaths: [] as string[],
  published: [] as string[],
}));
const pinnedFetch = vi.fn();
vi.mock("@/server/kml/pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidatedPaths.push(path),
}));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: (id: string) => state.published.push(id),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import { MAX_KML_BYTES } from "@/kml/kmz";
import * as kmlOverlays from "@/server/kml/kml-overlays";
import { listKmlOverlays } from "@/server/kml/kml-overlays";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { snapshotDb } from "@/test/db-snapshot";
import {
  expectRouteRequiresLogin,
  expectUploadRules,
  type SendAs,
} from "@/test/route-checks";
import { signIn } from "@/test/sign-in";
import {
  multipartRequest,
  routeParams,
  streamedRequest,
} from "@/test/upload-request";
import * as route from "./route";
import { POST } from "./route";

const LOAD_FAILED = "KML konnte nicht geladen werden.";
const KML = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';
const networkLinkTo = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

const kmlFileForm = (name: string, content: string): FormData => {
  const form = new FormData();
  form.append("name", name);
  form.append("content", new Blob([content]), "karte.kml");
  return form;
};

const db = () => state.db as Db;
const stored = (operationId: string) => listKmlOverlays(db(), operationId);

let operationId: string;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(db());
  state.revalidatedPaths = [];
  state.published = [];
  pinnedFetch.mockReset();
  operationId = (
    await insertOperation(db(), { name: "Lage", description: null })
  ).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const send = (request: Request, id = operationId) =>
  POST(request, routeParams({ id }));

const post = async (form: FormData) => {
  const response = await send(await multipartRequest("POST", form));
  return { status: response.status, body: await response.json() };
};

const sendAs: SendAs = async (caller) => {
  if (caller === "anonymous") state.token = undefined;
  else if (caller === "an unknown session") state.token = "no-such-session";
  else state.token = await signIn(db());
};

expectRouteRequiresLogin(
  route,
  {
    POST: {
      send: async () =>
        send(await multipartRequest("POST", kmlFileForm("Karte", KML)), "op-1"),
      answer: { status: 401 },
    },
  },
  { sendAs },
);

expectUploadRules(
  route,
  {
    POST: {
      send,
      tooLarge: "Die KML-Datei ist größer als 20 MB.",
      stored: () => snapshotDb(db()),
    },
  },
  { sendAs },
);

describe("POST /operations/[id]/kml", () => {
  it("adds a file whose content is KML, then refreshes the Einsatz", async () => {
    expect(await post(kmlFileForm("Abschnitte", KML))).toEqual({
      status: 200,
      body: {},
    });

    expect(await stored(operationId)).toMatchObject([
      { name: "Abschnitte", sourceType: "file", sourceUrl: null, content: KML },
    ]);
    expect(state.revalidatedPaths).toEqual([`/operations/${operationId}`]);
    expect(state.published).toEqual([operationId]);
  });

  it.each([
    ["JSON", "{}"],
    ["HTML", "<html/>"],
  ])(
    "refuses %s as no KML or KMZ file and adds nothing",
    async (_, content) => {
      expect(await post(kmlFileForm("Abschnitte", content))).toEqual({
        status: 400,
        body: { error: "Die Datei ist keine KML- oder KMZ-Datei." },
      });

      expect(await stored(operationId)).toEqual([]);
      expect(state.revalidatedPaths).toEqual([]);
    },
  );

  it("skips a NetworkLink outside the public address space like a dead link", async () => {
    const requested: string[] = [];
    const publicTarget =
      "<kml><Document><Placemark>B</Placemark></Document></kml>";
    pinnedFetch.mockImplementation(
      scriptedFetch((url): FetchStub => {
        requested.push(url);
        return { body: publicTarget };
      }),
    );
    const linked = `<kml><Document>${networkLinkTo(
      "http://100.64.0.1/a.kml",
    )}${networkLinkTo("http://93.184.216.34/b.kml")}</Document></kml>`;

    expect((await post(kmlFileForm("Meine Karte", linked))).status).toBe(200);

    expect((await stored(operationId))[0].content).toBe(publicTarget);
    expect(requested).toEqual(["http://93.184.216.34/b.kml"]);
  });

  it("refuses a file name of 201 characters and adds nothing", async () => {
    expect(await post(kmlFileForm("x".repeat(201), KML))).toEqual({
      status: 400,
      body: { error: "Der Dateiname darf höchstens 200 Zeichen lang sein." },
    });

    expect(await stored(operationId)).toEqual([]);
  });

  it("refuses a name sent as a file and adds nothing", async () => {
    const form = new FormData();
    form.append("name", new Blob(["Karte"]), "name.txt");
    form.append("content", new Blob([KML]), "karte.kml");

    expect(await post(form)).toEqual({
      status: 400,
      body: { error: "Der Dateiname muss Text sein." },
    });
    expect(await stored(operationId)).toEqual([]);
  });

  it("refuses an Einsatz-ID that is not a UUID and adds nothing", async () => {
    const response = await send(
      await multipartRequest("POST", kmlFileForm("Karte", KML)),
      "op-1",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Ungültige ID." });
    const { rows } = await db().query("SELECT id FROM kml_overlays");
    expect(rows).toEqual([]);
  });

  it("adds a file of just under 20 MB", async () => {
    const head = "<kml><Document>";
    const tail = "</Document></kml>";
    const kml = `${head}${" ".repeat(MAX_KML_BYTES - head.length - tail.length)}${tail}`;

    expect(await post(kmlFileForm("Abschnitte", kml))).toEqual({
      status: 200,
      body: {},
    });

    const [added] = await stored(operationId);
    expect(added).toMatchObject({ name: "Abschnitte", sourceType: "file" });
    expect(added.content).toHaveLength(MAX_KML_BYTES);
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
  ])("adds a file with an Origin matching %s", async (_, headers) => {
    const response = await send(
      await multipartRequest(
        "POST",
        kmlFileForm("Abschnitte", "<kml/>"),
        headers,
      ),
    );

    expect(response.status).toBe(200);
    expect(await stored(operationId)).toHaveLength(1);
  });

  it("names the KML-Ebene „KML-Datei“ when no name is sent", async () => {
    const form = new FormData();
    form.append("content", new Blob([KML]), "karte.kml");

    expect((await post(form)).status).toBe(200);

    expect(await stored(operationId)).toMatchObject([{ name: "KML-Datei" }]);
  });

  it("refuses a form without content as no KML file", async () => {
    const form = new FormData();
    form.append("name", "Karte");

    expect(await post(form)).toEqual({
      status: 400,
      body: { error: "Die Datei ist keine KML- oder KMZ-Datei." },
    });
  });

  it("answers 400 with the load failure message for a body that is no form", async () => {
    const body = new Blob(["kein Formular"]).stream();

    const response = await send(
      streamedRequest("POST", body, { "content-type": "text/plain" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: LOAD_FAILED });
    expect(await stored(operationId)).toEqual([]);
  });

  it("answers 500 with the load failure message and logs an unexpected error", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(kmlOverlays, "createKmlOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await post(kmlFileForm("Abschnitte", KML))).toEqual({
      status: 500,
      body: { error: LOAD_FAILED },
    });

    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
    expect(state.revalidatedPaths).toEqual([]);
  });
});
