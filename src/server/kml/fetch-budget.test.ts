import { describe, expect, it } from "vitest";
import { generatedBody } from "@/test/scripted-fetch";
import {
  createFetchBudget,
  type FetchBudget,
  readCapped,
  takeAddress,
} from "./fetch-budget";

const TOO_LARGE = "Die KML-Datei ist größer als 20 MB.";

const responseOf = (totalBytes: number, chunkBytes = 100) => {
  const body = generatedBody({ totalBytes, chunkBytes });
  return { response: new Response(body.stream), body };
};

describe("createFetchBudget", () => {
  it("allows 20 addresses and 20 MB", () => {
    expect(createFetchBudget()).toEqual({
      addressesLeft: 20,
      bytesLeft: 20 * 1024 * 1024,
    });
  });
});

describe("readCapped", () => {
  it("accepts a body of exactly the cap and subtracts it from the budget", async () => {
    const budget: FetchBudget = { addressesLeft: 1, bytesLeft: 5000 };
    const { response } = responseOf(1000);

    const bytes = await readCapped(response, budget, 1000);

    expect(bytes).toHaveLength(1000);
    expect(budget.bytesLeft).toBe(4000);
  });

  it("cancels a body one byte over the cap", async () => {
    const budget: FetchBudget = { addressesLeft: 1, bytesLeft: 5000 };
    const { response, body } = responseOf(10_000, 1001);

    await expect(readCapped(response, budget, 1000)).rejects.toThrow(TOO_LARGE);
    expect(body.pulled()).toBe(1001);
    expect(budget.bytesLeft).toBe(5000 - 1001);
    expect(body.cancelled()).toBe(true);
  });

  it("is capped below the cap by the budget's remaining bytes", async () => {
    const budget: FetchBudget = { addressesLeft: 1, bytesLeft: 500 };
    const { response, body } = responseOf(1000);

    await expect(readCapped(response, budget, 1000)).rejects.toThrow(TOO_LARGE);
    expect(body.pulled()).toBe(600);
    expect(budget.bytesLeft).toBe(0);
  });

  it("reads an empty body", async () => {
    const budget: FetchBudget = { addressesLeft: 1, bytesLeft: 0 };

    const bytes = await readCapped(new Response(null), budget, 1000);

    expect(bytes).toHaveLength(0);
    expect(budget.bytesLeft).toBe(0);
  });
});

describe("takeAddress", () => {
  it("takes addresses until none are left", () => {
    const budget: FetchBudget = { addressesLeft: 2, bytesLeft: 1 };

    expect([
      takeAddress(budget),
      takeAddress(budget),
      takeAddress(budget),
    ]).toEqual([true, true, false]);
    expect(budget.addressesLeft).toBe(0);
  });

  it("takes no address once no bytes are left", () => {
    const budget: FetchBudget = { addressesLeft: 2, bytesLeft: 0 };

    expect(takeAddress(budget)).toBe(false);
  });
});
