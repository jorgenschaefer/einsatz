import { describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import { ValidationError } from "@/server/validation";
import { type FetchStub, scriptedFetch } from "@/test/scripted-fetch";
import { createFetchBudget } from "./fetch-budget";

const pinnedFetch = vi.fn();
vi.mock("./pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));

import {
  assertFetchableKmlUrl,
  assertKmlDocument,
  enforceContentLength,
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  MAX_NETWORK_LINK_DEPTH,
  normalizeKmlSourceUrl,
  resolveKmlNetworkLinks,
} from "./kml-fetch";

const serve = (handler: (url: string) => FetchStub) =>
  pinnedFetch.mockReset().mockImplementation(scriptedFetch(handler));

const doc = (marker: string) =>
  `<kml><Document><Placemark>${marker}</Placemark></Document></kml>`;
const networkLink = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

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

describe("enforceContentLength", () => {
  it("accepts a missing or within-cap Content-Length", () => {
    expect(() => enforceContentLength(null)).not.toThrow();
    expect(() => enforceContentLength(String(MAX_KML_BYTES))).not.toThrow();
  });

  it("rejects a declared length over the cap before the body is read", () => {
    expect(() => enforceContentLength(String(MAX_KML_BYTES + 1))).toThrow(
      ValidationError,
    );
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

describe("fetchKmlFromUrl (redirect handling)", () => {
  it("re-checks each hop and blocks a redirect to an internal address", async () => {
    serve(() => ({
      status: 302,
      location: "http://169.254.169.254/internal.kml",
    }));
    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", createFetchBudget()),
    ).rejects.toThrow("Diese Adresse ist nicht erlaubt.");
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
