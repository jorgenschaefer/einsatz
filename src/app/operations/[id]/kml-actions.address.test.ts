import { beforeEach, describe, expect, it, vi } from "vitest";

// HTTP is not mocked here: a refused name never gets a connection, and the DNS
// answers below exist only in this mock, so no request can leave the machine.
const DNS: Record<string, string[]> = {
  "cgnat.example.test": ["100.64.0.1"],
  "loopback.example.test": ["127.0.0.1"],
  "mixed.example.test": ["93.184.216.34", "10.0.0.1"],
  "mapped.example.test": ["::ffff:169.254.169.254"],
};

vi.mock("node:dns/promises", () => ({
  lookup: async (hostname: string) => {
    const addresses = DNS[hostname];
    if (!addresses) throw new Error(`ENOTFOUND ${hostname}`);
    return addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));
  },
}));

const createKmlOverlay = vi.fn();
let reloadUrl = "";

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
  reloadKmlOverlay: (
    _db: unknown,
    _operationId: string,
    _id: string,
    fetcher: (url: string) => Promise<string>,
  ) => fetcher(reloadUrl),
}));

import { addKmlUrlAction, reloadKmlAction } from "./kml-actions";

const NOT_ALLOWED = { error: "Diese Adresse ist nicht erlaubt." };

const URLS_RESOLVING_ELSEWHERE = [
  "http://cgnat.example.test/x.kml",
  "https://loopback.example.test/x.kml",
  "http://mixed.example.test/x.kml",
  "http://mapped.example.test/x.kml",
];

beforeEach(() => {
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
});

describe("a host name that resolves outside the public unicast address space", () => {
  it.each(URLS_RESOLVING_ELSEWHERE)(
    "is not allowed when added as URL %s",
    async (url) => {
      expect(await addKmlUrlAction("op-1", "Pegel", url)).toEqual(NOT_ALLOWED);
      expect(createKmlOverlay).not.toHaveBeenCalled();
    },
  );

  it.each(URLS_RESOLVING_ELSEWHERE)(
    "is not allowed when %s is reloaded",
    async (url) => {
      reloadUrl = url;

      expect(await reloadKmlAction("op-1", "k1")).toEqual(NOT_ALLOWED);
    },
  );
});

describe("a host name that does not resolve", () => {
  it("says the address could not be resolved", async () => {
    expect(
      await addKmlUrlAction("op-1", "Pegel", "http://unknown.example.test/x"),
    ).toEqual({ error: "Die Adresse konnte nicht aufgelöst werden." });
  });
});
