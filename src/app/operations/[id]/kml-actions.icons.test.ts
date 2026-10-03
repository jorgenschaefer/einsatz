// @vitest-environment jsdom
import type L from "leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import { parseKml } from "@/map/kml-layer";
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

import { addKmlFile } from "@/server/kml/kml-import";
import { addKmlUrlAction, reloadKmlAction } from "./kml-actions";

const MAIN_URL = "http://93.184.216.34/karte.kml";

// Direkt über die Domänenfunktion: Unter jsdom kann die Upload-Route ihr
// Formular nicht lesen (undici erwartet seine eigene `File`-Klasse).
const addFile = (content: string) =>
  addKmlFile({} as never, { operationId: "op-1", name: "Karte", content });
const PIN = "http://93.184.216.34/pin.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PNG_DATA_URI = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;

const styledPoint = (id: string, href: string) =>
  `<Style id="${id}"><IconStyle><Icon><href>${href}</href></Icon></IconStyle></Style>` +
  `<Placemark><styleUrl>#${id}</styleUrl><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>`;
const kmlWithPoints = (...points: string[]) =>
  `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${points.join("")}</Document></kml>`;
const kmlWithIcon = (href: string) => kmlWithPoints(styledPoint("s", href));
const networkLinkTo = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

const requested: string[] = [];
const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockImplementation(
    scriptedFetch((url) => {
      requested.push(url);
      return handler(url);
    }),
  );
const servePng = (main: string) =>
  serve((url) =>
    url === MAIN_URL ? { body: main } : { contentType: "image/png", body: PNG },
  );

const savedContent = (call = 0): string =>
  createKmlOverlay.mock.calls[call][1].content;
const markers = (content: string): L.Marker[] => {
  const layer = parseKml(content);
  if (!layer) throw new Error("parseKml returned null");
  return layer.getLayers() as L.Marker[];
};
const markerIconUrls = (content: string) =>
  markers(content).map((marker) => marker.options.icon?.options.iconUrl);
const circleCount = (content: string) =>
  markers(content).filter((marker) =>
    marker.options.icon?.options.className?.includes("kml-point"),
  ).length;

beforeEach(() => {
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
  pinnedFetch.mockReset();
  requested.length = 0;
});

describe("an IconStyle icon from an http(s) address", () => {
  it("is embedded when a URL is added", async () => {
    servePng(kmlWithIcon(PIN));

    expect(await addKmlUrlAction("op-1", "Karte", MAIN_URL)).toEqual({});

    expect(savedContent()).toContain(PNG_DATA_URI);
    expect(savedContent()).not.toContain(PIN);
    expect(markerIconUrls(savedContent())).toEqual([PNG_DATA_URI]);
  });

  it("is embedded when its address has an escaped query", async () => {
    servePng(kmlWithIcon("http://93.184.216.34/icon?id=7&amp;size=2"));

    expect(await addKmlUrlAction("op-1", "Karte", MAIN_URL)).toEqual({});

    expect(requested).toContain("http://93.184.216.34/icon?id=7&size=2");
    expect(markerIconUrls(savedContent())).toEqual([PNG_DATA_URI]);
  });

  it("is embedded when a file is added", async () => {
    servePng("");

    await expect(addFile(kmlWithIcon(PIN))).resolves.toBeUndefined();

    expect(savedContent()).not.toContain(PIN);
    expect(markerIconUrls(savedContent())).toEqual([PNG_DATA_URI]);
  });

  it("is embedded when a layer is reloaded", async () => {
    servePng(kmlWithIcon(PIN));

    expect(await reloadKmlAction("op-1", "k1")).toEqual({});

    expect(savedContent()).not.toContain(PIN);
    expect(markerIconUrls(savedContent())).toEqual([PNG_DATA_URI]);
  });

  it("is embedded with the image type its server names, without parameters", async () => {
    serve(() => ({ contentType: "Image/GIF; charset=binary", body: PNG }));

    await addFile(kmlWithIcon(PIN));

    expect(markerIconUrls(savedContent())).toEqual([
      PNG_DATA_URI.replace("image/png", "image/gif"),
    ]);
  });

  it("is embedded at exactly 256 KB", async () => {
    const icon = new Uint8Array(256 * 1024);
    serve(() => ({ contentType: "image/png", body: icon }));

    await addFile(kmlWithIcon(PIN));

    expect(markerIconUrls(savedContent())).toEqual([
      `data:image/png;base64,${Buffer.from(icon).toString("base64")}`,
    ]);
  });

  it("is embedded in a file of just under 20 MB", async () => {
    servePng("");
    const kml = kmlWithIcon(PIN);
    const padded = kml.replace(
      "<Document>",
      `<Document>${" ".repeat(MAX_KML_BYTES - kml.length)}`,
    );

    await expect(addFile(padded)).resolves.toBeUndefined();

    expect(savedContent()).toContain(PNG_DATA_URI);
  });
});

describe("Google „Meine Karten“ with a NetworkLink and own icons", () => {
  const LAYER_URL = "http://93.184.216.34/layer.kml";
  const FLAG = "http://93.184.216.34/flag.png";
  const highlighted = (id: string, href: string) =>
    `<Style id="${id}-normal"><IconStyle><Icon><href>${href}</href></Icon></IconStyle></Style>` +
    `<Style id="${id}-highlight"><IconStyle><scale>1.2</scale><Icon><href>${href}</href></Icon></IconStyle></Style>` +
    `<StyleMap id="${id}"><Pair><key>normal</key><styleUrl>#${id}-normal</styleUrl></Pair>` +
    `<Pair><key>highlight</key><styleUrl>#${id}-highlight</styleUrl></Pair></StyleMap>` +
    `<Placemark><styleUrl>#${id}</styleUrl><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>`;

  it("embeds both icons of the linked layer, fetching each once", async () => {
    serve((url) => {
      if (url === MAIN_URL)
        return { body: kmlWithPoints(networkLinkTo(LAYER_URL)) };
      if (url === LAYER_URL)
        return {
          body: kmlWithPoints(
            highlighted("pin", PIN),
            highlighted("flag", FLAG),
          ),
        };
      return { contentType: "image/png", body: PNG };
    });

    expect(await addKmlUrlAction("op-1", "Karte", MAIN_URL)).toEqual({});

    expect(requested).toEqual([MAIN_URL, LAYER_URL, PIN, FLAG]);
    expect(savedContent()).not.toMatch(/<href>http/);
    expect(markerIconUrls(savedContent())).toEqual([
      PNG_DATA_URI,
      PNG_DATA_URI,
    ]);
  });
});

describe("an icon that cannot be embedded", () => {
  const failing: [string, string, FetchStub][] = [
    [
      "answers 404",
      "http://93.184.216.34/gone.png",
      { status: 404, contentType: "image/png", body: PNG },
    ],
    [
      "is not an image",
      "http://93.184.216.34/page.png",
      { contentType: "text/html", body: "<html></html>" },
    ],
    [
      "is larger than 256 KB",
      "http://93.184.216.34/huge.png",
      { contentType: "image/png", body: new Uint8Array(300 * 1024) },
    ],
    ["is outside the public address space", "http://100.64.0.1/x.png", {}],
  ];

  it.each(failing)(
    "keeps its address and shows the default marker when it %s",
    async (_name, href, stub) => {
      serve((url) =>
        url === href ? stub : { contentType: "image/png", body: PNG },
      );

      await expect(
        addFile(
          kmlWithPoints(styledPoint("bad", href), styledPoint("good", PIN)),
        ),
      ).resolves.toBeUndefined();
      expect(savedContent()).toContain(`<href>${href}</href>`);
      expect(circleCount(savedContent())).toBe(1);
      expect(markerIconUrls(savedContent())).toContain(PNG_DATA_URI);
    },
  );

  it.each([
    ["answers 404", { status: 404, contentType: "image/png" }],
    ["is not an image", { contentType: "text/html" }],
  ])("is not read further when it %s", async (_name, stub) => {
    const body = generatedBody({ chunkBytes: 1024 });
    serve(() => ({ ...stub, body: body.stream }));

    await addFile(kmlWithIcon(PIN));

    expect(body.cancelled()).toBe(true);
  });

  it("is not requested when its address is outside the public address space", async () => {
    servePng("");

    await addFile(kmlWithIcon("http://100.64.0.1/x.png"));

    expect(requested).toEqual([]);
  });
});
