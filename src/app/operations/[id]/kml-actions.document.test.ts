import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type FetchStub, scriptedFetch } from "@/test/scripted-fetch";

const createKmlOverlay = vi.fn();
const pinnedFetch = vi.fn();
vi.mock("@/server/kml/pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));

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
    _operationId: string,
    _id: string,
    fetcher: (url: string) => Promise<string>,
  ) => fetcher("http://93.184.216.34/x.kml"),
}));

import { addKmlUrlAction, reloadKmlAction } from "./kml-actions";

const NOT_KML_URL = "Die Adresse liefert keine KML-Datei.";
const HTML =
  "<!doctype html><html><head><title>Anmelden</title></head><body></body></html>";
const KML = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';
const networkLinkTo = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockImplementation(scriptedFetch(handler));

const savedContent = (): string => createKmlOverlay.mock.calls[0][1].content;

beforeEach(() => {
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
  pinnedFetch.mockReset();
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

  it("skips a NetworkLink target that delivers no KML like a dead link", async () => {
    const myMaps = `<kml><Document>${networkLinkTo(
      "http://93.184.216.34/html",
    )}${networkLinkTo("http://93.184.216.34/a.kml")}</Document></kml>`;
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

describe("an address outside the public unicast address space", () => {
  const NOT_ALLOWED = "Diese Adresse ist nicht erlaubt.";
  const requested: string[] = [];
  const serveKmlAndRecord = () =>
    serve((url) => {
      requested.push(url);
      return { body: KML };
    });

  beforeEach(() => {
    requested.length = 0;
  });

  it.each([
    "http://100.64.0.1/x.kml",
    "http://224.0.0.1/x.kml",
    "http://192.0.2.1/x.kml",
    "http://[2001:db8::1]/x.kml",
    "http://[64:ff9b::7f00:1]/x.kml",
  ])("is not fetched when added as URL %s", async (url) => {
    serveKmlAndRecord();

    const result = await addKmlUrlAction("op-1", "Pegel", url);

    expect(result).toEqual({ error: NOT_ALLOWED });
    expect(requested).toEqual([]);
    expect(createKmlOverlay).not.toHaveBeenCalled();
  });

  const linkToPublicAndCgnat = `<kml><Document>${networkLinkTo(
    "http://100.64.0.1/a.kml",
  )}${networkLinkTo("http://93.184.216.34/b.kml")}</Document></kml>`;
  const publicTarget =
    "<kml><Document><Placemark>B</Placemark></Document></kml>";

  it("skips such a NetworkLink behind a URL like a dead link", async () => {
    serve((url) => {
      requested.push(url);
      return {
        body: url.endsWith("/karte.kml") ? linkToPublicAndCgnat : publicTarget,
      };
    });

    const result = await addKmlUrlAction(
      "op-1",
      "Meine Karte",
      "http://93.184.216.34/karte.kml",
    );

    expect(result).toEqual({});
    expect(savedContent()).toBe(publicTarget);
    expect(requested).not.toContain("http://100.64.0.1/a.kml");
  });
});
