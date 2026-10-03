import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import {
  type FetchStub,
  generatedBody,
  scriptedFetch,
} from "@/test/scripted-fetch";

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
  reloadKmlOverlay: async (
    _db: unknown,
    _id: string,
    fetcher: (url: string) => Promise<string>,
  ) => createKmlOverlay("db", { content: await fetcher(MAIN_URL) }),
}));

import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
} from "./kml-actions";

const TOO_LARGE = "Die KML-Datei ist größer als 20 MB.";
const MAIN_URL = "http://93.184.216.34/karte.kml";
const MB = 1024 * 1024;
const CHUNK = 64 * 1024;

const placemark = (marker: string) => `<Placemark>${marker}</Placemark>`;
const doc = (marker: string) =>
  `<kml><Document>${placemark(marker)}</Document></kml>`;
const networkLinkTo = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;
const linkUrl = (i: number) => `http://93.184.216.34/link-${i}.kml`;
const kmlWithLinks = (count: number, url: (i: number) => string = linkUrl) =>
  `<kml><Document>${Array.from({ length: count }, (_, i) =>
    networkLinkTo(url(i + 1)),
  ).join("")}</Document></kml>`;

const requested: string[] = [];
const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockImplementation(
    scriptedFetch((url) => {
      requested.push(url);
      return handler(url);
    }),
  );

const savedContent = (call = 0): string =>
  createKmlOverlay.mock.calls[call][1].content;
const mergedMarkers = (content: string): string[] =>
  [...content.matchAll(/<Placemark>(.*?)<\/Placemark>/g)].map((m) => m[1]);
const markers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `L${from + i}`);

beforeEach(() => {
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
  pinnedFetch.mockReset();
  requested.length = 0;
});

describe("a URL with an endless body and no Content-Length", () => {
  it("says the file is larger than 20 MB and stops reading", async () => {
    const endless = generatedBody({ start: "<kml>", chunkBytes: CHUNK });
    serve(() => ({ body: endless.stream }));

    const result = await addKmlUrlAction("op-1", "Pegel", MAIN_URL);

    expect(result).toEqual({ error: TOO_LARGE });
    expect(endless.pulled()).toBeLessThanOrEqual(MAX_KML_BYTES + CHUNK);
    expect(createKmlOverlay).not.toHaveBeenCalled();
  });
});

describe("at most 20 addresses per import", () => {
  const serveLinkedDocs = (main: string) =>
    serve((url) => {
      if (url === MAIN_URL) return { body: main };
      return { body: doc(`L${url.match(/link-(\d+)/)?.[1]}`) };
    });

  it("fetches the URL and 19 of its 25 NetworkLinks", async () => {
    serveLinkedDocs(kmlWithLinks(25));

    const result = await addKmlUrlAction("op-1", "Karte", MAIN_URL);

    expect(result).toEqual({});
    expect(requested).toHaveLength(20);
    expect(mergedMarkers(savedContent())).toEqual(markers(1, 19));
  });

  it("fetches 20 of a file's 25 NetworkLinks", async () => {
    serveLinkedDocs("");

    const result = await addKmlFileAction("op-1", "Karte", kmlWithLinks(25));

    expect(result).toEqual({});
    expect(requested).toHaveLength(20);
    expect(mergedMarkers(savedContent())).toEqual(markers(1, 20));
  });

  it("shares the budget with nested NetworkLinks", async () => {
    const nested = kmlWithLinks(25, (i) => linkUrl(100 + i));
    serve((url) => {
      if (url === linkUrl(1)) return { body: nested };
      return { body: doc(`L${url.match(/link-(\d+)/)?.[1]}`) };
    });

    const result = await addKmlFileAction("op-1", "Karte", kmlWithLinks(1));

    expect(result).toEqual({});
    expect(requested).toHaveLength(20);
    expect(mergedMarkers(savedContent())).toEqual(markers(101, 119));
  });

  it("counts a NetworkLink reached through 3 redirects as one address", async () => {
    serve((url) => {
      const hop = url.match(/hop-(\d)/)?.[1];
      if (url === linkUrl(1)) return { status: 302, location: "/hop-1" };
      if (hop === "1" || hop === "2")
        return { status: 302, location: `/hop-${Number(hop) + 1}` };
      if (hop === "3") return { body: doc("L1") };
      return { body: doc(`L${url.match(/link-(\d+)/)?.[1]}`) };
    });

    const result = await addKmlFileAction("op-1", "Karte", kmlWithLinks(21));

    expect(result).toEqual({});
    expect(requested).toHaveLength(23);
    expect(mergedMarkers(savedContent())).toEqual(markers(1, 20));
  });

  it("gives every reload a fresh budget", async () => {
    serveLinkedDocs(kmlWithLinks(25));

    expect(await reloadKmlAction("op-1", "k1")).toEqual({});
    expect(await reloadKmlAction("op-1", "k1")).toEqual({});

    expect(requested).toHaveLength(40);
    expect(mergedMarkers(savedContent(1))).toEqual(markers(1, 19));
  });
});

describe("at most 20 MB read per import", () => {
  it("skips the NetworkLink that would exceed 20 MB together", async () => {
    const bodies = [1, 2, 3].map((i) =>
      generatedBody({
        start: `<kml><Document>${placemark(`L${i}`)}</Document></kml>`,
        totalBytes: 8 * MB,
      }),
    );
    serve((url) => ({
      body: bodies[Number(url.match(/link-(\d+)/)?.[1]) - 1].stream,
    }));

    const result = await addKmlFileAction("op-1", "Karte", kmlWithLinks(3));

    expect(result).toEqual({});
    expect(mergedMarkers(savedContent())).toEqual(["L1", "L2"]);
    const read = bodies.reduce((sum, body) => sum + body.pulled(), 0);
    expect(read).toBeLessThanOrEqual(MAX_KML_BYTES + CHUNK);
  });

  it("requests no further NetworkLink once 20 MB are read", async () => {
    serve((url) => {
      const i = url.match(/link-(\d+)/)?.[1];
      return {
        body: generatedBody({
          start: doc(`L${i}`),
          totalBytes: MAX_KML_BYTES / 2,
        }).stream,
      };
    });

    const result = await addKmlFileAction("op-1", "Karte", kmlWithLinks(3));

    expect(result).toEqual({});
    expect(requested).toEqual([linkUrl(1), linkUrl(2)]);
    expect(mergedMarkers(savedContent())).toEqual(["L1", "L2"]);
  });
});
