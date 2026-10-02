import { describe, expect, it } from "vitest";
import { isPublicUnicast } from "./public-address";

// Each excluded range: its first and last address, which are not public, and
// the addresses just outside it, which are (unless another range starts there).
const IPV4_RANGES: [range: string, first: string, last: string][] = [
  ["0.0.0.0/8 this network", "0.0.0.0", "0.255.255.255"],
  ["10.0.0.0/8 private", "10.0.0.0", "10.255.255.255"],
  ["100.64.0.0/10 shared (CGNAT)", "100.64.0.0", "100.127.255.255"],
  ["127.0.0.0/8 loopback", "127.0.0.0", "127.255.255.255"],
  ["169.254.0.0/16 link-local", "169.254.0.0", "169.254.255.255"],
  ["172.16.0.0/12 private", "172.16.0.0", "172.31.255.255"],
  ["192.0.0.0/24 IETF protocol assignments", "192.0.0.0", "192.0.0.255"],
  ["192.0.2.0/24 documentation", "192.0.2.0", "192.0.2.255"],
  ["192.88.99.0/24 6to4 relay anycast", "192.88.99.0", "192.88.99.255"],
  ["192.168.0.0/16 private", "192.168.0.0", "192.168.255.255"],
  ["198.18.0.0/15 benchmarking", "198.18.0.0", "198.19.255.255"],
  ["198.51.100.0/24 documentation", "198.51.100.0", "198.51.100.255"],
  ["203.0.113.0/24 documentation", "203.0.113.0", "203.0.113.255"],
  ["224.0.0.0/4 multicast", "224.0.0.0", "239.255.255.255"],
  ["240.0.0.0/4 reserved and broadcast", "240.0.0.0", "255.255.255.255"],
];

const IPV4_PUBLIC_NEIGHBOURS = [
  "1.0.0.0",
  "9.255.255.255",
  "11.0.0.0",
  "100.63.255.255",
  "100.128.0.0",
  "126.255.255.255",
  "128.0.0.0",
  "169.253.255.255",
  "169.255.0.0",
  "172.15.255.255",
  "172.32.0.0",
  "191.255.255.255",
  "192.0.1.0",
  "192.0.3.0",
  "192.88.98.255",
  "192.88.100.0",
  "192.167.255.255",
  "192.169.0.0",
  "198.17.255.255",
  "198.20.0.0",
  "198.51.99.255",
  "198.51.101.0",
  "203.0.112.255",
  "203.0.114.0",
  "223.255.255.255",
  "8.8.8.8",
  "93.184.216.34",
];

const IPV6_NOT_PUBLIC: [range: string, ip: string][] = [
  ["unspecified", "::"],
  ["loopback", "::1"],
  ["below 2000::/3", "1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["above 2000::/3", "4000::"],
  ["NAT64 64:ff9b::/96", "64:ff9b::7f00:1"],
  ["link-local fe80::/10", "fe80::1"],
  ["link-local with zone", "fe80::1%eth0"],
  ["unique-local fc00::/7", "fc00::1"],
  ["unique-local fd00::/8", "fd12:3456::1"],
  ["multicast ff00::/8", "ff02::1"],
  ["2001::/23 first (Teredo)", "2001::"],
  ["2001::/32 Teredo", "2001:0:4136:e378:8000:63bf:3fff:fdd2"],
  ["2001::/23 last", "2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["2001:db8::/32 documentation first", "2001:db8::"],
  [
    "2001:db8::/32 documentation last",
    "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff",
  ],
  ["2002::/16 6to4 first", "2002::"],
  ["2002::/16 6to4 last", "2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["3fff::/20 documentation first", "3fff::"],
  ["3fff::/20 documentation last", "3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["IPv4-mapped loopback, dotted", "::ffff:127.0.0.1"],
  ["IPv4-mapped metadata, dotted", "::ffff:169.254.169.254"],
  ["IPv4-mapped metadata, hex", "::ffff:a9fe:a9fe"],
  ["IPv4-mapped CGNAT, hex", "::ffff:6440:1"],
];

const IPV6_PUBLIC: [range: string, ip: string][] = [
  ["first of 2000::/3", "2000::"],
  ["just above 2001::/23", "2001:200::"],
  ["just below 2001:db8::/32", "2001:db7:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["just above 2001:db8::/32", "2001:db9::"],
  ["just below 2002::/16", "2001:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["just above 2002::/16", "2003::"],
  ["Google DNS", "2001:4860:4860::8888"],
  ["just below 3fff::/20", "3ffe:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
  ["just above 3fff::/20", "3fff:1000::"],
  ["IPv4-mapped public, dotted", "::ffff:8.8.8.8"],
  ["IPv4-mapped public, hex", "::ffff:808:808"],
  ["uppercase", "2A00:1450:4001:82B::200E"],
];

describe("isPublicUnicast", () => {
  it.each(IPV4_RANGES)("rejects %s at both ends", (_range, first, last) => {
    expect(isPublicUnicast(first), first).toBe(false);
    expect(isPublicUnicast(last), last).toBe(false);
  });

  it.each(IPV4_PUBLIC_NEIGHBOURS)("accepts the public IPv4 %s", (ip) => {
    expect(isPublicUnicast(ip)).toBe(true);
  });

  it.each(IPV6_NOT_PUBLIC)("rejects IPv6 %s (%s)", (_range, ip) => {
    expect(isPublicUnicast(ip)).toBe(false);
  });

  it.each(IPV6_PUBLIC)("accepts IPv6 %s (%s)", (_range, ip) => {
    expect(isPublicUnicast(ip)).toBe(true);
  });

  it.each([
    ["a host name", "example.com"],
    ["empty text", ""],
    ["a bracketed literal", "[2001:4860:4860::8888]"],
    ["an integer-encoded IPv4", "2130706433"],
    ["a short IPv4", "8.8.8"],
  ])("rejects %s, which is not an IP address", (_case, input) => {
    expect(isPublicUnicast(input)).toBe(false);
  });
});
