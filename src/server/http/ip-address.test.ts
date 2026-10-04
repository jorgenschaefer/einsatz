import { describe, expect, it } from "vitest";
import { ipv4Groups, parseIpv6 } from "./ip-address";

describe("parseIpv6", () => {
  it.each([
    [
      "a full literal",
      "2001:db8:1:2:3:4:5:6",
      [0x2001, 0xdb8, 1, 2, 3, 4, 5, 6],
    ],
    [
      "leading zeros",
      "2001:0db8:0001:0002:0003:0004:0005:0006",
      [0x2001, 0xdb8, 1, 2, 3, 4, 5, 6],
    ],
    ["upper case", "2001:DB8::A", [0x2001, 0xdb8, 0, 0, 0, 0, 0, 0xa]],
    ["only ::", "::", [0, 0, 0, 0, 0, 0, 0, 0]],
    [":: in front", "::1", [0, 0, 0, 0, 0, 0, 0, 1]],
    [":: at the end", "fe80::", [0xfe80, 0, 0, 0, 0, 0, 0, 0]],
    [
      "an IPv4 tail",
      "::ffff:203.0.113.7",
      [0, 0, 0, 0, 0, 0xffff, 0xcb00, 0x7107],
    ],
    ["a zone", "fe80::%eth0", [0xfe80, 0, 0, 0, 0, 0, 0, 0]],
  ])("reads %s (%s)", (_case, ip, groups) => {
    expect(parseIpv6(ip)).toEqual(groups);
  });

  it.each([
    ["an IPv4 address", "203.0.113.7"],
    ["a name", "local"],
    ["empty text", ""],
    ["two ::", "2001:db8::1::2"],
    ["nine groups", "2001:db8:1:2:3:4:5:6:7"],
    ["seven groups without ::", "2001:db8:1:2:3:4:5"],
    ["a group of five digits", "2001:db8:12345::1"],
  ])("gives nothing for %s (%s)", (_case, ip) => {
    expect(parseIpv6(ip)).toBeNull();
  });
});

describe("ipv4Groups", () => {
  it("reads an IPv4 address as two groups", () => {
    expect(ipv4Groups("203.0.113.7")).toEqual([0xcb00, 0x7107]);
  });
});
