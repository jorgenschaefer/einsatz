import { describe, expect, it } from "vitest";
import { formatEntryRoute, orderCorrespondents } from "./entry-route";

describe("formatEntryRoute", () => {
  it.each([
    [
      "UHSt 2",
      "EAL",
      "Funk",
      { parties: "Von UHSt 2 an EAL", channel: "Funk" },
    ],
    ["UHSt 2", "EAL", null, { parties: "Von UHSt 2 an EAL", channel: null }],
    ["UHSt 2", null, "Funk", { parties: "Von UHSt 2", channel: "Funk" }],
    ["UHSt 2", null, null, { parties: "Von UHSt 2", channel: null }],
    [null, "EAL", "Telefon", { parties: "An EAL", channel: "Telefon" }],
    [null, "EAL", null, { parties: "An EAL", channel: null }],
    [null, null, "Funk", { parties: null, channel: "Funk" }],
  ])("formats Von %s, An %s, Weg %s", (sender, recipient, channel, header) => {
    expect(formatEntryRoute({ sender, recipient, channel })).toEqual(header);
  });

  it("gives no header without Von, An and Weg", () => {
    expect(
      formatEntryRoute({ sender: null, recipient: null, channel: null }),
    ).toBeNull();
  });
});

describe("orderCorrespondents", () => {
  const values = ["UHSt 2", "EAL", "Leitstelle", "Deichwache"];

  it.each([
    [
      "alphabetically without any use",
      {},
      ["Deichwache", "EAL", "Leitstelle", "UHSt 2"],
    ],
    [
      "the one used last first",
      { "uhst 2": 1 },
      ["UHSt 2", "Deichwache", "EAL", "Leitstelle"],
    ],
    [
      "all used ones by last use, then the others",
      { eal: 1, "uhst 2": 3, leitstelle: 2 },
      ["UHSt 2", "Leitstelle", "EAL", "Deichwache"],
    ],
    [
      "ignoring uses of values not offered",
      { "uhst 4": 5 },
      ["Deichwache", "EAL", "Leitstelle", "UHSt 2"],
    ],
  ])("orders %s", (_, lastUsed, ordered) => {
    expect(orderCorrespondents(values, lastUsed)).toEqual(ordered);
  });

  it("finds a use in any case of the value", () => {
    expect(orderCorrespondents(["EAL", "UHST 2"], { "uhst 2": 1 })).toEqual([
      "UHST 2",
      "EAL",
    ]);
  });

  it("counts no use for a value named like an object property", () => {
    expect(
      orderCorrespondents(["constructor", "Zentrale"], { zentrale: 1 }),
    ).toEqual(["Zentrale", "constructor"]);
  });

  it("sorts the others alphabetically regardless of case", () => {
    expect(orderCorrespondents(["b", "C", "a"], {})).toEqual(["a", "b", "C"]);
  });
});
