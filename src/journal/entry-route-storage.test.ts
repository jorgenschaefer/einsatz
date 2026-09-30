import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readEntryRouteMemory,
  rememberEntryRoute,
} from "./entry-route-storage";

const NOTHING = { sender: {}, recipient: {} };

describe("entry-route storage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remembers nothing in a new Gesamteinsatz", () => {
    expect(readEntryRouteMemory("op-1")).toEqual(NOTHING);
  });

  it("remembers Von and An in lower case, and the Weg", () => {
    rememberEntryRoute("op-1", {
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Telefon",
    });

    expect(readEntryRouteMemory("op-1")).toEqual({
      sender: { "uhst 2": 1 },
      recipient: { eal: 1 },
      channel: "Telefon",
    });
  });

  it("remembers Von, An and Weg trimmed, as the server stores them", () => {
    rememberEntryRoute("op-1", {
      sender: "Melder 4 ",
      recipient: "  ",
      channel: " Kurier ",
    });
    rememberEntryRoute("op-2", {
      sender: null,
      recipient: null,
      channel: "   ",
    });

    expect(readEntryRouteMemory("op-1")).toEqual({
      sender: { "melder 4": 1 },
      recipient: {},
      channel: "Kurier",
    });
    expect(readEntryRouteMemory("op-2").channel).toBeNull();
  });

  it("counts each later use higher in its field", () => {
    rememberEntryRoute("op-1", {
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Funk",
    });
    rememberEntryRoute("op-1", {
      sender: "EAL",
      recipient: null,
      channel: "Funk",
    });
    rememberEntryRoute("op-1", {
      sender: "uhst 2",
      recipient: "Leitstelle",
      channel: null,
    });

    expect(readEntryRouteMemory("op-1")).toEqual({
      sender: { "uhst 2": 3, eal: 2 },
      recipient: { eal: 1, leitstelle: 2 },
      channel: null,
    });
  });

  it("keeps each Gesamteinsatz apart", () => {
    rememberEntryRoute("op-1", {
      sender: "UHSt 2",
      recipient: null,
      channel: "Telefon",
    });

    expect(readEntryRouteMemory("op-2")).toEqual(NOTHING);
  });

  it.each([
    ["not JSON", "{"],
    ["no object", "3"],
    ["null", "null"],
    ["no uses", '{"channel":"Funk"}'],
    ["uses that are no numbers", '{"sender":{"eal":"1"},"recipient":{}}'],
    ["uses that are a list", '{"sender":[1],"recipient":{}}'],
    ["a Weg that is no text", '{"sender":{},"recipient":{},"channel":3}'],
  ])("remembers nothing from a stored value with %s", (_, stored) => {
    localStorage.setItem("einsatz:entryRoute:op-1", stored);

    expect(readEntryRouteMemory("op-1")).toEqual(NOTHING);
  });

  it("remembers nothing and throws nothing without browser storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    rememberEntryRoute("op-1", {
      sender: "UHSt 2",
      recipient: null,
      channel: "Telefon",
    });
    expect(readEntryRouteMemory("op-1")).toEqual(NOTHING);
  });
});
