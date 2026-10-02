import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FetchStub, scriptedFetch } from "@/test/scripted-fetch";

const createKmlOverlay = vi.fn();

vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => ({ tag: "db" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: () => {},
}));
vi.mock("@/server/kml/kml-overlays", () => ({
  createKmlOverlay: (...args: unknown[]) => createKmlOverlay(...args),
  reloadKmlOverlay: (
    _db: unknown,
    _id: string,
    fetcher: (url: string) => Promise<string>,
  ) => fetcher("http://93.184.216.34/x.kml"),
}));

import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
} from "./kml-actions";

const NOT_KML_URL = "Die Adresse liefert keine KML-Datei.";
const NOT_KML_FILE = "Die Datei ist keine KML- oder KMZ-Datei.";
const HTML =
  "<!doctype html><html><head><title>Anmelden</title></head><body></body></html>";
const KML = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';

const serve = (handler: (url: string) => FetchStub) =>
  vi.stubGlobal("fetch", scriptedFetch(handler));

const savedContent = (): string => createKmlOverlay.mock.calls[0][1].content;

beforeEach(() => {
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a URL that does not deliver KML", () => {
  it("adds no overlay and says the address delivers no KML file", async () => {
    serve(() => ({ body: HTML }));

    const result = await addKmlUrlAction(
      "op-1",
      "Pegel",
      "http://93.184.216.34/pegel",
    );

    expect(result).toEqual({ error: NOT_KML_URL });
    expect(createKmlOverlay).not.toHaveBeenCalled();
  });

  it("says the address delivers no KML file when reloaded", async () => {
    serve(() => ({ body: HTML }));

    expect(await reloadKmlAction("op-1", "k1")).toEqual({
      error: NOT_KML_URL,
    });
  });
});

describe("a file that is not KML", () => {
  it.each([
    ["JSON", "{}"],
    ["HTML", "<html/>"],
  ])(
    "adds no overlay for %s and says it is no KML or KMZ file",
    async (_kind, content) => {
      const result = await addKmlFileAction("op-1", "Abschnitte", content);

      expect(result).toEqual({ error: NOT_KML_FILE });
      expect(createKmlOverlay).not.toHaveBeenCalled();
    },
  );
});

describe("KML that works today", () => {
  it("adds a URL whose KML has a declaration, a comment and whitespace before the root", async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Export -->\n  ${KML}`;
    serve(() => ({ body }));

    const result = await addKmlUrlAction(
      "op-1",
      "Pegel",
      "http://93.184.216.34/pegel.kml",
    );

    expect(result).toEqual({});
    expect(savedContent()).toBe(body);
  });

  it("adds a URL that delivers a KMZ", async () => {
    serve(() => ({ body: zipSync({ "doc.kml": strToU8(KML) }) }));

    const result = await addKmlUrlAction(
      "op-1",
      "Pegel",
      "http://93.184.216.34/pegel.kmz",
    );

    expect(result).toEqual({});
    expect(savedContent()).toBe(KML);
  });

  it("adds a file whose content is KML", async () => {
    expect(await addKmlFileAction("op-1", "Abschnitte", KML)).toEqual({});
    expect(savedContent()).toBe(KML);
  });

  it("skips a NetworkLink target that delivers no KML like a dead link", async () => {
    const link = (href: string) =>
      `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;
    const myMaps = `<kml><Document>${link("http://93.184.216.34/html")}${link(
      "http://93.184.216.34/a.kml",
    )}</Document></kml>`;
    const target = "<kml><Document><Placemark>A</Placemark></Document></kml>";
    serve((url) => {
      if (url.endsWith("/html")) return { body: HTML };
      if (url.endsWith("/a.kml")) return { body: target };
      return { body: myMaps };
    });

    const result = await addKmlUrlAction(
      "op-1",
      "Meine Karte",
      "http://93.184.216.34/karte.kml",
    );

    expect(result).toEqual({});
    expect(savedContent()).toBe(target);
  });
});
