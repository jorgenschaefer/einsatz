import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import { ValidationError } from "@/server/validation";
import {
  expectAtMostTwiceOrdinary,
  PATHOLOGICAL_PIECES,
  UNCLOSED_DOCUMENTS,
} from "@/test/kml-timing";
import {
  type FetchStub,
  generatedBody,
  scriptedFetch,
} from "@/test/scripted-fetch";
import { createFetchBudget } from "./fetch-budget";

const pinnedFetch = vi.fn();
vi.mock("./pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));

import {
  assertFetchableKmlUrl,
  assertKmlDocument,
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  MAX_NETWORK_LINK_DEPTH,
  normalizeKmlSourceUrl,
  resolveKmlNetworkLinks,
} from "./kml-fetch";

const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockReset().mockImplementation(scriptedFetch(handler));

const requested: string[] = [];
const serveCounted = (handler: (url: string) => FetchStub) =>
  serve((url) => {
    requested.push(url);
    return handler(url);
  });

beforeEach(() => {
  requested.length = 0;
});

const NOT_KML_URL = "Die Adresse liefert keine KML-Datei.";
const NOT_ALLOWED = "Diese Adresse ist nicht erlaubt.";
const HTML =
  "<!doctype html><html><head><title>Anmelden</title></head><body></body></html>";

const doc = (marker: string) =>
  `<kml><Document><Placemark>${marker}</Placemark></Document></kml>`;
const networkLink = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

const MB = 1024 * 1024;
const CHUNK = 64 * 1024;
const MAIN_URL = "http://93.184.216.34/karte.kml";
const linkUrl = (i: number) => `http://93.184.216.34/link-${i}.kml`;
const kmlWithLinks = (count: number, url: (i: number) => string = linkUrl) =>
  `<kml><Document>${Array.from({ length: count }, (_, i) =>
    networkLink(url(i + 1)),
  ).join("")}</Document></kml>`;
const linkNumber = (url: string) => url.match(/link-(\d+)/)?.[1];
const placemarks = (content: string): string[] =>
  [...content.matchAll(/<Placemark>(.*?)<\/Placemark>/g)].map((m) => m[1]);
const markers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `L${from + i}`);
const linkedDoc = (url: string): FetchStub => ({
  body: doc(`L${linkNumber(url)}`),
});

describe("assertKmlDocument", () => {
  const NOT_KML = "Kein KML.";

  it.each([
    ["a bare root", "<kml/>"],
    ["a namespaced root", '<kml xmlns="http://www.opengis.net/kml/2.2">'],
    ["a prefixed root", '<kml:kml xmlns:kml="http://www.opengis.net/kml/2.2">'],
    ["a declaration", '<?xml version="1.0" encoding="UTF-8"?><kml>'],
    [
      "a declaration, comments and whitespace",
      '\n<?xml version="1.0"?>\r\n<!-- a -->\t<!--b--> <kml>',
    ],
    ["a root followed by a newline", "<kml\n  xmlns='x'>"],
  ])("accepts %s", (_case, text) => {
    expect(() => assertKmlDocument(text, NOT_KML)).not.toThrow();
  });

  it.each([
    ["empty text", ""],
    ["only whitespace", "  \n"],
    ["HTML", "<!doctype html><html><body>kml</body></html>"],
    ["JSON", '{"kml": true}'],
    ["a DOCTYPE before the root", '<!DOCTYPE kml SYSTEM "x"><kml>'],
    ["<kml after another element", "<html><kml></kml></html>"],
    ["a root merely starting with kml", "<kmlx>"],
    ["a prefixed root that is not kml", "<x:Document>"],
    ["an unclosed comment", "<!-- <kml>"],
    ["text before the root", "hello <kml>"],
    [
      "a stylesheet instruction before the root",
      '<?xml-stylesheet href="a"?><kml>',
    ],
  ])("rejects %s with the given message", (_case, text) => {
    expect(() => assertKmlDocument(text, NOT_KML)).toThrow(
      new ValidationError(NOT_KML),
    );
  });

  it.each([
    ["many comments", `${"<!--a-->".repeat(28)}<html>`],
    ["much whitespace", `${" ".repeat(50_000)}x`],
  ])("rejects %s without stalling", { timeout: 1_000 }, (_case, text) => {
    expect(() => assertKmlDocument(text, NOT_KML)).toThrow(ValidationError);
  });
});

describe("enforceKmlSizeLimit", () => {
  it("accepts content within the 20 MB cap", () => {
    expect(() => enforceKmlSizeLimit("<kml/>")).not.toThrow();
  });

  it("rejects content over the cap", () => {
    const tooBig = "x".repeat(MAX_KML_BYTES + 1);
    expect(() => enforceKmlSizeLimit(tooBig)).toThrow(ValidationError);
  });
});

describe("assertFetchableKmlUrl", () => {
  it("accepts a public http(s) URL", () => {
    expect(() =>
      assertFetchableKmlUrl("https://maps.example.com/route.kml"),
    ).not.toThrow();
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertFetchableKmlUrl("file:///etc/passwd")).toThrow(
      ValidationError,
    );
    expect(() => assertFetchableKmlUrl("ftp://example.com/x.kml")).toThrow(
      ValidationError,
    );
  });

  it("rejects a malformed URL", () => {
    expect(() => assertFetchableKmlUrl("not a url")).toThrow(ValidationError);
  });

  it("rejects loopback, private and link-local hosts", () => {
    for (const url of [
      "http://localhost/x.kml",
      "http://127.0.0.1/x.kml",
      "http://10.1.2.3/x.kml",
      "http://100.64.0.1/x.kml",
      "http://172.16.0.1/x.kml",
      "http://192.168.1.1/x.kml",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/x.kml",
      "http://0.0.0.0/x.kml",
      "http://[::ffff:169.254.169.254]/latest/meta-data/",
      "http://2130706433/x.kml", // Integer-Kodierung von 127.0.0.1
    ]) {
      expect(() => assertFetchableKmlUrl(url), url).toThrow(ValidationError);
    }
  });

  it("accepts public hostnames that merely start with fc/fd", () => {
    // Der fc/fd-Filter gilt nur für IPv6-Literale, nicht für Hostnamen.
    expect(() => assertFetchableKmlUrl("https://fda.gov/x.kml")).not.toThrow();
    expect(() =>
      assertFetchableKmlUrl("https://fc-bayern.de/x.kml"),
    ).not.toThrow();
  });
});

describe("normalizeKmlSourceUrl", () => {
  const expectExport = (input: string, mid: string) => {
    const out = new URL(normalizeKmlSourceUrl(input));
    expect(out.pathname).toBe("/maps/d/kml");
    expect(out.searchParams.get("mid")).toBe(mid);
    expect(out.searchParams.get("forcekml")).toBe("1");
  };

  it("rewrites a My-Maps viewer link to the kml export endpoint", () => {
    expectExport(
      "https://www.google.com/maps/d/viewer?mid=1AbCdEf&ll=53.5,10.0&z=12",
      "1AbCdEf",
    );
  });

  it("rewrites a My-Maps edit link", () => {
    expectExport("https://www.google.com/maps/d/edit?mid=1AbCdEf", "1AbCdEf");
  });

  it("rewrites a multi-account (u/N) My-Maps link", () => {
    expectExport(
      "https://www.google.com/maps/d/u/0/viewer?mid=1AbCdEf",
      "1AbCdEf",
    );
  });

  it("adds forcekml to an existing kml export link", () => {
    expectExport("https://www.google.com/maps/d/kml?mid=1AbCdEf", "1AbCdEf");
  });

  it("leaves a plain .kmz download URL untouched", () => {
    const url = "https://example.com/files/WTH26%20all%20courses.kmz";
    expect(normalizeKmlSourceUrl(url)).toBe(url);
  });

  it("leaves a My-Maps link without mid untouched", () => {
    const url = "https://www.google.com/maps/d/viewer";
    expect(normalizeKmlSourceUrl(url)).toBe(url);
  });

  it("returns non-URL input unchanged for the caller to reject", () => {
    expect(normalizeKmlSourceUrl("not a url")).toBe("not a url");
  });
});

describe("fetchKmlFromUrl", () => {
  it("says the address delivers no KML file when it serves HTML", async () => {
    serve(() => ({ body: HTML }));

    await expect(
      fetchKmlFromUrl(MAIN_URL, createFetchBudget()),
    ).rejects.toThrow(new ValidationError(NOT_KML_URL));
  });

  it("returns KML with a declaration, a comment and whitespace before the root unchanged", async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Export -->\n  ${doc("A")}`;
    serve(() => ({ body }));

    expect(await fetchKmlFromUrl(MAIN_URL, createFetchBudget())).toBe(body);
  });

  it("returns the KML inside a KMZ", async () => {
    serve(() => ({ body: zipSync({ "doc.kml": strToU8(doc("A")) }) }));

    expect(await fetchKmlFromUrl(MAIN_URL, createFetchBudget())).toBe(doc("A"));
  });

  it("requests nothing from an address that is not public and says it is not allowed", async () => {
    serveCounted(() => ({ body: doc("A") }));

    await expect(
      fetchKmlFromUrl("http://100.64.0.1/x.kml", createFetchBudget()),
    ).rejects.toThrow(new ValidationError(NOT_ALLOWED));
    expect(requested).toEqual([]);
  });
});

describe("fetchKmlFromUrl (redirect handling)", () => {
  it("re-checks each hop and blocks a redirect to an internal address", async () => {
    serve(() => ({
      status: 302,
      location: "http://169.254.169.254/internal.kml",
    }));
    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", createFetchBudget()),
    ).rejects.toThrow(NOT_ALLOWED);
  });

  it("gives up after too many redirects", async () => {
    serve(() => ({
      status: 302,
      location: "http://93.184.216.34/next.kml",
    }));
    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", createFetchBudget()),
    ).rejects.toThrow("Zu viele Weiterleitungen");
  });

  it("cancels the unread body of a redirect and of a failed response", async () => {
    const redirectBody = generatedBody({ totalBytes: 1000 });
    const failedBody = generatedBody({ totalBytes: 1000 });
    serve((url) =>
      url.endsWith("/start.kml")
        ? {
            status: 302,
            location: "http://93.184.216.34/gone.kml",
            body: redirectBody.stream,
          }
        : { status: 404, body: failedBody.stream },
    );

    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", createFetchBudget()),
    ).rejects.toThrow("(404)");
    expect(redirectBody.cancelled()).toBe(true);
    expect(failedBody.cancelled()).toBe(true);
  });
});

describe("fetchKmlFromUrl (budget)", () => {
  it("says a body without end or Content-Length is larger than 20 MB and stops reading it", async () => {
    const endless = generatedBody({ start: "<kml>", chunkBytes: CHUNK });
    serve(() => ({ body: endless.stream }));

    await expect(
      fetchKmlFromUrl(MAIN_URL, createFetchBudget()),
    ).rejects.toThrow("Die KML-Datei ist größer als 20 MB.");
    expect(endless.pulled()).toBeLessThanOrEqual(MAX_KML_BYTES + CHUNK);
  });

  it("fetches the URL and 19 of its 25 NetworkLinks within 20 addresses", async () => {
    serveCounted((url) =>
      url === MAIN_URL ? { body: kmlWithLinks(25) } : linkedDoc(url),
    );

    const content = await fetchKmlFromUrl(MAIN_URL, createFetchBudget());

    expect(requested).toHaveLength(20);
    expect(placemarks(content)).toEqual(markers(1, 19));
  });
});

describe("resolveKmlNetworkLinks (budget)", () => {
  it("fetches 20 of 25 NetworkLinks", async () => {
    serveCounted(linkedDoc);

    const content = await resolveKmlNetworkLinks(
      kmlWithLinks(25),
      createFetchBudget(),
    );

    expect(requested).toHaveLength(20);
    expect(placemarks(content)).toEqual(markers(1, 20));
  });

  it("shares the 20 addresses with nested NetworkLinks", async () => {
    const nested = kmlWithLinks(25, (i) => linkUrl(100 + i));
    serveCounted((url) =>
      url === linkUrl(1) ? { body: nested } : linkedDoc(url),
    );

    const content = await resolveKmlNetworkLinks(
      kmlWithLinks(1),
      createFetchBudget(),
    );

    expect(requested).toHaveLength(20);
    expect(placemarks(content)).toEqual(markers(101, 119));
  });

  it("counts a NetworkLink reached through 3 redirects as one address", async () => {
    serveCounted((url) => {
      const hop = Number(url.match(/hop-(\d)/)?.[1]);
      if (url === linkUrl(1)) return { status: 302, location: "/hop-1" };
      if (hop === 1 || hop === 2)
        return { status: 302, location: `/hop-${hop + 1}` };
      if (hop === 3) return { body: doc("L1") };
      return linkedDoc(url);
    });

    const content = await resolveKmlNetworkLinks(
      kmlWithLinks(21),
      createFetchBudget(),
    );

    expect(requested).toHaveLength(23);
    expect(placemarks(content)).toEqual(markers(1, 20));
  });

  it("skips the NetworkLink that would exceed 20 MB together", async () => {
    const bodies = [1, 2, 3].map((i) =>
      generatedBody({ start: doc(`L${i}`), totalBytes: 8 * MB }),
    );
    serveCounted((url) => ({
      body: bodies[Number(linkNumber(url)) - 1].stream,
    }));

    const content = await resolveKmlNetworkLinks(
      kmlWithLinks(3),
      createFetchBudget(),
    );

    expect(placemarks(content)).toEqual(["L1", "L2"]);
    const read = bodies.reduce((sum, body) => sum + body.pulled(), 0);
    expect(read).toBeLessThanOrEqual(MAX_KML_BYTES + CHUNK);
  });

  it("requests no further NetworkLink once 20 MB are read", async () => {
    serveCounted((url) => ({
      body: generatedBody({
        start: doc(`L${linkNumber(url)}`),
        totalBytes: MAX_KML_BYTES / 2,
      }).stream,
    }));

    const content = await resolveKmlNetworkLinks(
      kmlWithLinks(3),
      createFetchBudget(),
    );

    expect(requested).toEqual([linkUrl(1), linkUrl(2)]);
    expect(placemarks(content)).toEqual(["L1", "L2"]);
  });
});

describe("resolveKmlNetworkLinks", () => {
  const twoLinks = `<kml><Document>${networkLink(
    "http://93.184.216.34/a.kml",
  )}${networkLink("http://93.184.216.34/b.kml")}</Document></kml>`;

  it("resolves NetworkLinks and merges the fetched documents", async () => {
    serve((url) => ({
      body: url.includes("/a.kml") ? doc("A") : doc("B"),
    }));
    const merged = await resolveKmlNetworkLinks(twoLinks, createFetchBudget());
    expect(merged).toContain("<Placemark>A</Placemark>");
    expect(merged).toContain("<Placemark>B</Placemark>");
  });

  it("skips a NetworkLink that fails to load and keeps the rest", async () => {
    serve((url) =>
      url.includes("/a.kml") ? { status: 500 } : { body: doc("B") },
    );
    const out = await resolveKmlNetworkLinks(twoLinks, createFetchBudget());
    expect(out).toContain("<Placemark>B</Placemark>");
    expect(out).not.toContain("<Placemark>A</Placemark>");
  });

  it("skips a NetworkLink that delivers no KML like a dead link", async () => {
    serve((url) => ({ body: url.includes("/a.kml") ? HTML : doc("B") }));

    expect(await resolveKmlNetworkLinks(twoLinks, createFetchBudget())).toBe(
      doc("B"),
    );
  });

  it("skips a NetworkLink to an address that is not public without requesting it", async () => {
    const kml = `<kml><Document>${networkLink(
      "http://100.64.0.1/a.kml",
    )}${networkLink("http://93.184.216.34/b.kml")}</Document></kml>`;
    serveCounted(() => ({ body: doc("B") }));

    expect(await resolveKmlNetworkLinks(kml, createFetchBudget())).toBe(
      doc("B"),
    );
    expect(requested).toEqual(["http://93.184.216.34/b.kml"]);
  });

  it("keeps the original KML when every NetworkLink is dead", async () => {
    serve(() => ({ status: 500 }));
    expect(await resolveKmlNetworkLinks(twoLinks, createFetchBudget())).toBe(
      twoLinks,
    );
  });

  it("stops at the depth limit without fetching", async () => {
    let calls = 0;
    serve(() => {
      calls++;
      return { body: doc("X") };
    });
    const out = await resolveKmlNetworkLinks(
      twoLinks,
      createFetchBudget(),
      MAX_NETWORK_LINK_DEPTH,
    );
    expect(out).toBe(twoLinks);
    expect(calls).toBe(0);
  });
});

describe("fetchKmlFromUrl (timing)", () => {
  const fetching = (bodyOf: (url: string) => string) => () => {
    serve((url) => ({ body: bodyOf(url) }));
    return fetchKmlFromUrl(MAIN_URL, createFetchBudget());
  };

  it.each(PATHOLOGICAL_PIECES)(
    "fetches KML containing %s at most twice as slowly as ordinary KML",
    async (_name, piece) => {
      await expectAtMostTwiceOrdinary((kml) => fetching(() => kml), piece);
    },
  );

  it("merges NetworkLink targets containing 10,000 unclosed <Document> at most twice as slowly as ordinary ones", async () => {
    const twoLinks = kmlWithLinks(2);
    await expectAtMostTwiceOrdinary(
      (target) => fetching((url) => (url === MAIN_URL ? twoLinks : target)),
      UNCLOSED_DOCUMENTS,
    );
  });
});
