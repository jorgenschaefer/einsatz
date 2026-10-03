import type { LookupAddress } from "node:dns";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// HTTP is not mocked here: icons go through the real pinnedFetch. The local
// server below answers every request with a PNG, so an icon fetch that got
// past the address check would show up in `received`.
const dnsLookup = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookup(...args),
}));

const createKmlOverlay = vi.fn();
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
}));

import { addKmlFileAction } from "./kml-actions";

const answers = (...addresses: string[]): LookupAddress[] =>
  addresses.map((address) => ({ address, family: 4 }));

let server: Server;
let port: number;
const received: IncomingMessage[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    received.push(req);
    res.writeHead(200, { "content-type": "image/png" }).end("png");
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  received.length = 0;
  dnsLookup.mockReset();
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
});

const kmlWithIcon = (href: string) =>
  `<kml><Document><Style id="s"><IconStyle><Icon><href>${href}</href></Icon></IconStyle></Style></Document></kml>`;

async function expectNotEmbedded(href: string) {
  const result = await addKmlFileAction("op-1", "Karte", kmlWithIcon(href));

  expect(result).toEqual({});
  expect(createKmlOverlay.mock.calls[0][1].content).toBe(kmlWithIcon(href));
  expect(received).toEqual([]);
}

describe("an icon outside the public unicast address space", () => {
  it("is not fetched when its host name resolves to a loopback address", async () => {
    dnsLookup.mockResolvedValue(answers("127.0.0.1"));

    await expectNotEmbedded(`http://intern.example.test:${port}/pin.png`);
  });

  it("is not fetched when its host name rebinds after the first answer", async () => {
    dnsLookup
      .mockResolvedValueOnce(answers("127.0.0.1"))
      .mockResolvedValue(answers("93.184.216.34"));

    await expectNotEmbedded(`http://rebind.example.test:${port}/pin.png`);
    expect(dnsLookup.mock.calls.map(([host]) => host)).toEqual([
      "rebind.example.test",
    ]);
  });

  it.each([
    () => `http://127.0.0.1:${port}/pin.png`,
    () => "http://100.64.0.1/pin.png",
  ])("is not fetched from a literal address (%#)", async (href) => {
    await expectNotEmbedded(href());
    expect(dnsLookup).not.toHaveBeenCalled();
  });
});
