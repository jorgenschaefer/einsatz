import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import {
  type FetchStub,
  generatedBody,
  scriptedFetch,
} from "@/test/scripted-fetch";
import { createFetchBudget, type FetchBudget } from "./fetch-budget";

const pinnedFetch = vi.fn();
vi.mock("./pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));

import { embedKmlIcons } from "./kml-icons";

const PIN = "http://93.184.216.34/pin.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const dataUri = (bytes: Uint8Array, mime = "image/png") =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
const PNG_DATA_URI = dataUri(PNG);

const iconStyle = (id: string, href: string) =>
  `<Style id="${id}"><IconStyle><Icon><href>${href}</href></Icon></IconStyle></Style>`;
const kmlWith = (...styles: string[]) =>
  `<kml><Document>${styles.join("")}</Document></kml>`;
const kmlWithIcon = (href: string) => kmlWith(iconStyle("s", href));

const requested: string[] = [];
const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockImplementation(
    scriptedFetch((url) => {
      requested.push(url);
      return handler(url);
    }),
  );
const servePng = () => serve(() => ({ contentType: "image/png", body: PNG }));

const embed = (kml: string, budget: FetchBudget = createFetchBudget()) =>
  embedKmlIcons(kml, budget);
const embeddedCount = (kml: string) => kml.match(/<href>data:/g)?.length ?? 0;

beforeEach(() => {
  pinnedFetch.mockReset();
  requested.length = 0;
});

describe("embedKmlIcons", () => {
  it("replaces an http(s) IconStyle icon with its image as a data URI", async () => {
    servePng();

    expect(await embed(kmlWithIcon(PIN))).toBe(kmlWithIcon(PNG_DATA_URI));
  });

  it("fetches an icon with an escaped query from its unescaped address", async () => {
    servePng();

    const kml = await embed(
      kmlWithIcon("http://93.184.216.34/icon?id=7&amp;size=2"),
    );

    expect(requested).toEqual(["http://93.184.216.34/icon?id=7&size=2"]);
    expect(kml).toBe(kmlWithIcon(PNG_DATA_URI));
  });

  it("embeds with the image type its server names, lower case and without parameters", async () => {
    serve(() => ({ contentType: "Image/GIF; charset=binary", body: PNG }));

    expect(await embed(kmlWithIcon(PIN))).toBe(
      kmlWithIcon(dataUri(PNG, "image/gif")),
    );
  });

  it("embeds an icon of exactly 256 KB", async () => {
    const icon = new Uint8Array(256 * 1024);
    serve(() => ({ contentType: "image/png", body: icon }));

    expect(await embed(kmlWithIcon(PIN))).toBe(kmlWithIcon(dataUri(icon)));
  });

  it("fetches an icon named by several styles once and embeds it in each", async () => {
    servePng();

    const kml = await embed(kmlWith(iconStyle("a", PIN), iconStyle("b", PIN)));

    expect(requested).toEqual([PIN]);
    expect(kml).toBe(
      kmlWith(iconStyle("a", PNG_DATA_URI), iconStyle("b", PNG_DATA_URI)),
    );
  });

  it("adds at most 20 MB to the KML, however many styles repeat an icon", async () => {
    const icon = new Uint8Array(256 * 1024);
    serve(() => ({ contentType: "image/png", body: icon }));
    const growth = dataUri(icon).length - PIN.length;

    const kml = await embed(
      kmlWith(
        ...Array.from({ length: 100 }, (_, i) => iconStyle(`s${i}`, PIN)),
      ),
    );

    expect(embeddedCount(kml)).toBe(Math.floor(MAX_KML_BYTES / growth));
  });
});

describe("an icon embedKmlIcons cannot embed", () => {
  it.each<[string, string, FetchStub]>([
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
      { contentType: "image/png", body: new Uint8Array(256 * 1024 + 1) },
    ],
    ["is outside the public address space", "http://100.64.0.1/x.png", {}],
  ])(
    "keeps its address, and the other icons are embedded, when it %s",
    async (_name, href, stub) => {
      serve((url) =>
        url === href ? stub : { contentType: "image/png", body: PNG },
      );

      const kml = await embed(
        kmlWith(iconStyle("bad", href), iconStyle("good", PIN)),
      );

      expect(kml).toBe(
        kmlWith(iconStyle("bad", href), iconStyle("good", PNG_DATA_URI)),
      );
    },
  );

  it.each([
    ["answers 404", { status: 404, contentType: "image/png" }],
    ["is not an image", { contentType: "text/html" }],
  ])("is not read further when it %s", async (_name, stub) => {
    const body = generatedBody({ chunkBytes: 1024 });
    serve(() => ({ ...stub, body: body.stream }));

    await embed(kmlWithIcon(PIN));

    expect(body.cancelled()).toBe(true);
  });

  it.each(["http://127.0.0.1:8080/pin.png", "http://100.64.0.1/pin.png"])(
    "is not requested from the literal address %s",
    async (href) => {
      servePng();

      expect(await embed(kmlWithIcon(href))).toBe(kmlWithIcon(href));
      expect(requested).toEqual([]);
    },
  );
});

describe("embedKmlIcons within a fetch budget", () => {
  it("fetches icons only while the budget has addresses left", async () => {
    servePng();
    const hrefs = [1, 2, 3].map((i) => `http://93.184.216.34/icon-${i}.png`);

    const kml = await embed(
      kmlWith(...hrefs.map((href, i) => iconStyle(`s${i}`, href))),
      { addressesLeft: 2, bytesLeft: MAX_KML_BYTES },
    );

    expect(requested).toEqual(hrefs.slice(0, 2));
    expect(embeddedCount(kml)).toBe(2);
    expect(kml).toContain(`<href>${hrefs[2]}</href>`);
  });

  it("keeps the address of an icon larger than the bytes left", async () => {
    serve(() => ({ contentType: "image/png", body: new Uint8Array(2000) }));

    const kml = await embed(kmlWithIcon(PIN), {
      addressesLeft: 20,
      bytesLeft: 1999,
    });

    expect(kml).toBe(kmlWithIcon(PIN));
  });

  it("takes no address for an icon whose address is not allowed", async () => {
    servePng();

    const kml = await embed(
      kmlWith(
        iconStyle("refused", "http://100.64.0.1/x.png"),
        iconStyle("s", PIN),
      ),
      { addressesLeft: 1, bytesLeft: MAX_KML_BYTES },
    );

    expect(kml).toContain(`<href>${PNG_DATA_URI}</href>`);
  });
});
