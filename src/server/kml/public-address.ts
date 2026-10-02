import { isIPv4 } from "node:net";
import {
  type Groups,
  ipv4Groups,
  ipv6Groups,
  parseIpv6,
} from "@/server/http/ip-address";

/**
 * Ob `ip` eine öffentliche Unicast-Adresse ist, die der Server abrufen darf.
 * Alles andere – privat, Loopback, Link-Local, CGNAT, Multicast, Dokumentation,
 * Benchmarking, Übergangsnetze – liegt nach den IANA-Registern für
 * Sonderadressen außerhalb. IPv6 ist nur in 2000::/3 öffentlich; IPv4-mapped
 * Adressen gelten als ihre IPv4. Kein IP-Literal: `false`.
 */
export function isPublicUnicast(ip: string): boolean {
  if (isIPv4(ip)) return isPublicIpv4(ipv4Groups(ip));
  const groups = parseIpv6(ip);
  return groups !== null && isPublicIpv6(groups);
}

type Range = [base: Groups, prefix: number];

const v4 = (base: string, prefix: number): Range => [ipv4Groups(base), prefix];
const v6 = (base: string, prefix: number): Range => [ipv6Groups(base), prefix];

const NOT_PUBLIC_IPV4: Range[] = [
  v4("0.0.0.0", 8),
  v4("10.0.0.0", 8),
  v4("100.64.0.0", 10),
  v4("127.0.0.0", 8),
  v4("169.254.0.0", 16),
  v4("172.16.0.0", 12),
  v4("192.0.0.0", 24),
  v4("192.0.2.0", 24),
  v4("192.88.99.0", 24),
  v4("192.168.0.0", 16),
  v4("198.18.0.0", 15),
  v4("198.51.100.0", 24),
  v4("203.0.113.0", 24),
  v4("224.0.0.0", 4),
  v4("240.0.0.0", 4),
];

const GLOBAL_UNICAST_IPV6 = v6("2000::", 3);
const IPV4_MAPPED_IPV6 = v6("::ffff:0:0", 96);

const NOT_PUBLIC_IPV6: Range[] = [
  v6("2001::", 23),
  v6("2001:db8::", 32),
  v6("2002::", 16),
  v6("3fff::", 20),
];

const isPublicIpv4 = (address: Groups): boolean =>
  !NOT_PUBLIC_IPV4.some((range) => inRange(address, range));

function isPublicIpv6(address: Groups): boolean {
  if (inRange(address, IPV4_MAPPED_IPV6)) return isPublicIpv4(address.slice(6));
  if (!inRange(address, GLOBAL_UNICAST_IPV6)) return false;
  return !NOT_PUBLIC_IPV6.some((range) => inRange(address, range));
}

function inRange(address: Groups, [base, prefix]: Range): boolean {
  for (let i = 0, bits = prefix; bits > 0; i++, bits -= 16) {
    const mask = bits >= 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    if ((address[i] & mask) !== (base[i] & mask)) return false;
  }
  return true;
}
