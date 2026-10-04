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

const dnsLookup = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => dnsLookup(...args),
}));

import { ValidationError } from "@/server/validation";
import { checkedLookup, pinnedFetch } from "./pinned-fetch";

const NOT_ALLOWED = "Diese Adresse ist nicht erlaubt.";
const PUBLIC = "93.184.216.34";

const answers = (...addresses: string[]): LookupAddress[] =>
  addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));

// A local server the tests must never reach through a host name.
let server: Server;
let port: number;
const received: IncomingMessage[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    received.push(req);
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/elsewhere" }).end();
      return;
    }
    const status = req.url?.match(/^\/status\/(\d+)$/)?.[1];
    if (status) {
      res.writeHead(Number(status)).end();
      return;
    }
    res
      .writeHead(200, {
        "content-type": "application/vnd.google-earth.kml+xml",
      })
      .end("<kml/>");
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
});

const init = (timeoutMs = 2_000) => ({
  headers: { "User-Agent": "test-agent" },
  signal: AbortSignal.timeout(timeoutMs),
});

describe("pinnedFetch", () => {
  it("refuses a name that resolves to a loopback address without connecting", async () => {
    dnsLookup.mockResolvedValue(answers("127.0.0.1"));

    await expect(
      pinnedFetch(new URL(`http://intern.example.test:${port}/x.kml`), init()),
    ).rejects.toStrictEqual(new ValidationError(NOT_ALLOWED));
    expect(received).toEqual([]);
  });

  it("refuses an https name that resolves to a loopback address", async () => {
    dnsLookup.mockResolvedValue(answers("127.0.0.1"));

    await expect(
      pinnedFetch(new URL(`https://intern.example.test:${port}/x.kml`), init()),
    ).rejects.toStrictEqual(new ValidationError(NOT_ALLOWED));
  });

  it("says a name that does not resolve could not be resolved, without connecting", async () => {
    dnsLookup.mockRejectedValue(new Error("ENOTFOUND unknown.example.test"));

    await expect(
      pinnedFetch(new URL(`http://unknown.example.test:${port}/x.kml`), init()),
    ).rejects.toStrictEqual(
      new ValidationError("Die Adresse konnte nicht aufgelöst werden."),
    );
    expect(received).toEqual([]);
  });

  it("connects to the checked address, not to a later answer for the same name", async () => {
    dnsLookup
      .mockResolvedValueOnce(answers(PUBLIC))
      .mockResolvedValue(answers("127.0.0.1"));

    await expect(
      pinnedFetch(
        new URL(`http://rebind.example.test:${port}/x.kml`),
        init(500),
      ),
    ).rejects.toThrow();
    expect(dnsLookup).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);
  });

  it("returns the response with status, headers and body", async () => {
    const response = await pinnedFetch(
      new URL(`http://127.0.0.1:${port}/x.kml`),
      init(),
    );

    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.google-earth.kml+xml",
    );
    expect(await response.text()).toBe("<kml/>");
    expect(received[0].headers["user-agent"]).toBe("test-agent");
  });

  it("hands a redirect back instead of following it", async () => {
    const response = await pinnedFetch(
      new URL(`http://127.0.0.1:${port}/redirect`),
      init(),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/elsewhere");
    expect(received.map((req) => req.url)).toEqual(["/redirect"]);
  });
});

describe("pinnedFetch with an unusual status", () => {
  it.each([204, 205, 304])(
    "returns status %i with an empty body",
    async (status) => {
      const response = await pinnedFetch(
        new URL(`http://127.0.0.1:${port}/status/${status}`),
        init(10_000),
      );

      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
    },
  );

  it("rejects a status outside 200-599 at once instead of waiting for the timeout", async () => {
    await expect(
      pinnedFetch(new URL(`http://127.0.0.1:${port}/status/699`), init(10_000)),
    ).rejects.toThrow();
  });
});

describe("checkedLookup", () => {
  const lookUp = (all: boolean) =>
    new Promise<{ address: string | LookupAddress[]; family?: number }>(
      (resolve, reject) =>
        checkedLookup("host.example.test", { all }, (err, address, family) =>
          err ? reject(err) : resolve({ address, family }),
        ),
    );

  it("hands over every public address when all are asked for", async () => {
    dnsLookup.mockResolvedValue(answers(PUBLIC, "2001:4860:4860::8888"));

    expect(await lookUp(true)).toEqual({
      address: answers(PUBLIC, "2001:4860:4860::8888"),
      family: undefined,
    });
  });

  it("hands over the first public address when one is asked for", async () => {
    dnsLookup.mockResolvedValue(answers("2001:4860:4860::8888", PUBLIC));

    expect(await lookUp(false)).toEqual({
      address: "2001:4860:4860::8888",
      family: 6,
    });
  });

  it.each([true, false])(
    "refuses when any of several answers is not public (all: %s)",
    async (all) => {
      dnsLookup.mockResolvedValue(answers(PUBLIC, "10.0.0.1"));

      await expect(lookUp(all)).rejects.toThrow(NOT_ALLOWED);
    },
  );

  it("says the address could not be resolved when the lookup fails", async () => {
    dnsLookup.mockRejectedValue(new Error("ENOTFOUND host.example.test"));

    await expect(lookUp(true)).rejects.toThrow(
      "Die Adresse konnte nicht aufgelöst werden.",
    );
  });
});
