import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import {
  type FetchStub,
  generatedBody,
  scriptedFetch,
} from "@/test/scripted-fetch";
import { listKmlOverlays } from "./kml-overlays";

const pinnedFetch = vi.fn();
vi.mock("./pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));

import { addKmlFile, loadKmlFromUrl, resolveKmlFile } from "./kml-import";

const MAIN_URL = "http://93.184.216.34/karte.kml";
const PIN = "http://93.184.216.34/pin.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PNG_DATA_URI = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;

const iconStyle = (href: string) =>
  `<Style><IconStyle><Icon><href>${href}</href></Icon></IconStyle></Style>`;
const kmlWith = (...parts: string[]) =>
  `<kml><Document>${parts.join("")}</Document></kml>`;
const kmlWithIcon = (href: string) => kmlWith(iconStyle(href));
const networkLinkTo = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;
const linkUrl = (i: number) => `http://93.184.216.34/link-${i}.kml`;
const kmlWithLinks = (count: number) =>
  kmlWith(
    ...Array.from({ length: count }, (_, i) => networkLinkTo(linkUrl(i + 1))),
  );
const iconUrl = (i: number) => `http://93.184.216.34/icon-${i}.png`;
const embeddedCount = (kml: string) => kml.match(/<href>data:/g)?.length ?? 0;

const requested: string[] = [];
const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockImplementation(
    scriptedFetch((url) => {
      requested.push(url);
      return handler(url);
    }),
  );
const png: FetchStub = { contentType: "image/png", body: PNG };
const serveKmlAndPng = (kml: string) =>
  serve((url) => (url === MAIN_URL ? { body: kml } : png));
const serve25Links = () =>
  serve((url) => ({
    body: url === MAIN_URL ? kmlWithLinks(25) : kmlWith("<Placemark/>"),
  }));

beforeEach(() => {
  pinnedFetch.mockReset();
  requested.length = 0;
});

describe("loadKmlFromUrl", () => {
  it("embeds the icons of the fetched KML", async () => {
    serveKmlAndPng(kmlWithIcon(PIN));

    expect(await loadKmlFromUrl(MAIN_URL)).toBe(kmlWithIcon(PNG_DATA_URI));
  });

  it("embeds the icons of a Google „Meine Karten“ layer behind a NetworkLink, fetching each once", async () => {
    const LAYER_URL = "http://93.184.216.34/layer.kml";
    const FLAG = "http://93.184.216.34/flag.png";
    const normalAndHighlight = (href: string) =>
      iconStyle(href) +
      `<Style><IconStyle><scale>1.2</scale><Icon><href>${href}</href></Icon></IconStyle></Style>`;
    serve((url) => {
      if (url === MAIN_URL) return { body: kmlWith(networkLinkTo(LAYER_URL)) };
      if (url === LAYER_URL)
        return {
          body: kmlWith(normalAndHighlight(PIN), normalAndHighlight(FLAG)),
        };
      return png;
    });

    const kml = await loadKmlFromUrl(MAIN_URL);

    expect(requested).toEqual([MAIN_URL, LAYER_URL, PIN, FLAG]);
    expect(kml).not.toMatch(/<href>http/);
    expect(embeddedCount(kml)).toBe(4);
  });

  it("fetches icons from the addresses the KML left in its budget", async () => {
    serve((url) => {
      if (url === MAIN_URL) return { body: kmlWithLinks(10) };
      const link = Number(url.match(/link-(\d+)/)?.[1]);
      if (link === 1)
        return {
          body: kmlWith(
            ...[1, 2, 3, 4, 5, 6].map((i) => iconStyle(iconUrl(i))),
          ),
        };
      if (link) return { body: kmlWithIcon(iconUrl(link + 5)) };
      return png;
    });

    const kml = await loadKmlFromUrl(MAIN_URL);

    expect(requested).toHaveLength(20);
    expect(embeddedCount(kml)).toBe(9);
    expect(kml).toContain(`<href>${iconUrl(15)}</href>`);
  });

  it("gives every load a fresh budget of 20 addresses", async () => {
    serve25Links();

    await loadKmlFromUrl(MAIN_URL);
    await loadKmlFromUrl(MAIN_URL);

    expect(requested).toHaveLength(40);
  });
});

describe("resolveKmlFile", () => {
  it("embeds the icons of the file", async () => {
    serve(() => png);

    expect(await resolveKmlFile(kmlWithIcon(PIN))).toBe(
      kmlWithIcon(PNG_DATA_URI),
    );
  });

  it("checks the size before embedding icons, so a file of exactly 20 MB gets them", async () => {
    serve(() => png);
    const kml = kmlWithIcon(PIN);
    const padded = kml.replace(
      "<Document>",
      `<Document>${" ".repeat(MAX_KML_BYTES - kml.length)}`,
    );

    expect(embeddedCount(await resolveKmlFile(padded))).toBe(1);
  });

  it("keeps the address of an icon that no longer fits into the 20 MB its NetworkLinks left", async () => {
    const icon = iconUrl(1);
    serve((url) =>
      url === icon
        ? { contentType: "image/png", body: new Uint8Array(200 * 1024) }
        : {
            body: generatedBody({
              start: kmlWithIcon(icon),
              totalBytes: MAX_KML_BYTES - 100 * 1024,
            }).stream,
          },
    );

    const kml = await resolveKmlFile(kmlWithLinks(1));

    expect(requested).toEqual([linkUrl(1), icon]);
    expect(embeddedCount(kml)).toBe(0);
  });

  it("gives every load a fresh budget of 20 addresses", async () => {
    serve25Links();

    await resolveKmlFile(kmlWithLinks(25));
    await resolveKmlFile(kmlWithLinks(25));

    expect(requested).toHaveLength(40);
  });
});

describe("addKmlFile", () => {
  it("refuses an Einsatz that no longer exists before fetching its links", async () => {
    const db = await freshDb();
    serve25Links();

    await expect(
      addKmlFile(db, {
        operationId: randomUUID(),
        name: "Karte",
        content: kmlWithLinks(1),
      }),
    ).rejects.toThrow("Der Einsatz existiert nicht mehr.");

    expect(requested).toEqual([]);
  });

  it("stores the file with its icons embedded as a KML-Ebene of the Einsatz", async () => {
    const db = await freshDb();
    const operation = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    serve(() => png);

    await addKmlFile(db, {
      operationId: operation.id,
      name: " Karte ",
      content: kmlWithIcon(PIN),
    });

    expect(await listKmlOverlays(db, operation.id)).toMatchObject([
      {
        name: "Karte",
        sourceType: "file",
        sourceUrl: null,
        content: kmlWithIcon(PNG_DATA_URI),
      },
    ]);
  });

  it.each([
    ["JSON", "{}"],
    ["HTML", "<html/>"],
  ])(
    "refuses %s as no KML or KMZ file and adds nothing",
    async (_, content) => {
      const db = await freshDb();
      const operation = await insertOperation(db, {
        name: "Hochwasser",
        description: null,
      });

      await expect(
        addKmlFile(db, { operationId: operation.id, name: "Karte", content }),
      ).rejects.toThrow("Die Datei ist keine KML- oder KMZ-Datei.");

      expect(await listKmlOverlays(db, operation.id)).toEqual([]);
    },
  );

  it("refuses a file name of 201 characters and adds nothing", async () => {
    const db = await freshDb();
    const operation = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });

    await expect(
      addKmlFile(db, {
        operationId: operation.id,
        name: "x".repeat(201),
        content: kmlWith(),
      }),
    ).rejects.toThrow("Der Dateiname darf höchstens 200 Zeichen lang sein.");

    expect(await listKmlOverlays(db, operation.id)).toEqual([]);
  });
});
