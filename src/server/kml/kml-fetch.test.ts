import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  assertFetchableKmlUrl,
  enforceContentLength,
  enforceKmlSizeLimit,
  isBlockedIp,
  MAX_KML_BYTES,
} from "./kml-fetch";

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
