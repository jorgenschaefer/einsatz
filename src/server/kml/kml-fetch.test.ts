import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  assertFetchableKmlUrl,
  enforceContentLength,
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  isBlockedIp,
  MAX_KML_BYTES,
  MAX_NETWORK_LINK_DEPTH,
  normalizeKmlSourceUrl,
  resolveKmlNetworkLinks,
} from "./kml-fetch";

// Skript-Fetch: liefert je angefragter URL eine Antwort-Attrappe. Hosts sind
// IP-Literale, damit dns.lookup ohne Netz auflöst.
type Stub = { status?: number; location?: string; body?: string };
const scriptedFetch = (handler: (url: string) => Stub): typeof fetch =>
  (async (input: URL | RequestInfo) => {
    const s = handler(String(input));
    const status = s.status ?? 200;
    return {
      status,
      ok: status < 400,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "location" ? (s.location ?? null) : null,
      },
      arrayBuffer: async () => new TextEncoder().encode(s.body ?? "").buffer,
    };
  }) as unknown as typeof fetch;

const doc = (marker: string) =>
  `<kml><Document><Placemark>${marker}</Placemark></Document></kml>`;
const networkLink = (href: string) =>
  `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;

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

describe("isBlockedIp", () => {
  it("blocks loopback, unspecified, private and link-local IPv4", () => {
    for (const ip of [
      "0.0.0.0",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("blocks loopback, link-local and unique-local IPv6, and IPv4-mapped forms", () => {
    for (const ip of [
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe", // hex-Form von 169.254.169.254
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4/IPv6 addresses and non-IP hostnames", () => {
    for (const host of [
      "8.8.8.8",
      "172.15.0.1",
      "172.32.0.1",
      "2001:db8::1",
      "fda.gov",
      "fc-bayern.de",
      "example.com",
    ]) {
      expect(isBlockedIp(host), host).toBe(false);
    }
  });
});

describe("fetchKmlFromUrl (redirect handling)", () => {
  it("re-checks each hop and blocks a redirect to an internal address", async () => {
    const doFetch = scriptedFetch(() => ({
      status: 302,
      location: "http://169.254.169.254/internal.kml",
    }));
    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", 0, doFetch),
    ).rejects.toThrow("Diese Adresse ist nicht erlaubt.");
  });

  it("gives up after too many redirects", async () => {
    const doFetch = scriptedFetch(() => ({
      status: 302,
      location: "http://93.184.216.34/next.kml",
    }));
    await expect(
      fetchKmlFromUrl("http://93.184.216.34/start.kml", 0, doFetch),
    ).rejects.toThrow("Zu viele Weiterleitungen");
  });
});

describe("resolveKmlNetworkLinks", () => {
  const twoLinks = `<kml><Document>${networkLink(
    "http://93.184.216.34/a.kml",
  )}${networkLink("http://93.184.216.34/b.kml")}</Document></kml>`;

  it("resolves NetworkLinks and merges the fetched documents", async () => {
    const doFetch = scriptedFetch((url) => ({
      body: url.includes("/a.kml") ? doc("A") : doc("B"),
    }));
    const merged = await resolveKmlNetworkLinks(twoLinks, 0, doFetch);
    expect(merged).toContain("<Placemark>A</Placemark>");
    expect(merged).toContain("<Placemark>B</Placemark>");
  });

  it("skips a NetworkLink that fails to load and keeps the rest", async () => {
    const doFetch = scriptedFetch((url) =>
      url.includes("/a.kml") ? { status: 500 } : { body: doc("B") },
    );
    const out = await resolveKmlNetworkLinks(twoLinks, 0, doFetch);
    expect(out).toContain("<Placemark>B</Placemark>");
    expect(out).not.toContain("<Placemark>A</Placemark>");
  });

  it("keeps the original KML when every NetworkLink is dead", async () => {
    const doFetch = scriptedFetch(() => ({ status: 500 }));
    expect(await resolveKmlNetworkLinks(twoLinks, 0, doFetch)).toBe(twoLinks);
  });

  it("stops at the depth limit without fetching", async () => {
    let calls = 0;
    const doFetch = scriptedFetch(() => {
      calls++;
      return { body: doc("X") };
    });
    const out = await resolveKmlNetworkLinks(
      twoLinks,
      MAX_NETWORK_LINK_DEPTH,
      doFetch,
    );
    expect(out).toBe(twoLinks);
    expect(calls).toBe(0);
  });
});
