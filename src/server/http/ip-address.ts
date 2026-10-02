import { isIPv6 } from "node:net";

/** Eine Adresse als Folge von 16-Bit-Gruppen: IPv4 zwei, IPv6 acht. */
export type Groups = number[];

/** Gruppen eines IPv6-Literals (auch mit `::`, IPv4-Schwanz oder Zone), sonst `null`. */
export function parseIpv6(ip: string): Groups | null {
  const unzoned = ip.split("%")[0];
  return isIPv6(unzoned) ? ipv6Groups(unzoned) : null;
}

/** Gruppen eines gültigen IPv4-Literals. */
export function ipv4Groups(ip: string): Groups {
  const [a, b, c, d] = ip.split(".").map(Number);
  return [a * 256 + b, c * 256 + d];
}

/** Gruppen eines gültigen IPv6-Literals ohne Zone. */
export function ipv6Groups(ip: string): Groups {
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const groups = (part: string | undefined): Groups =>
    part ? part.split(":").flatMap(group) : [];
  const left = groups(head);
  const right = groups(tail);
  const zeros = new Array(8 - left.length - right.length).fill(0);
  return [...left, ...zeros, ...right];
}

function group(text: string): Groups {
  return text.includes(".") ? ipv4Groups(text) : [Number.parseInt(text, 16)];
}
