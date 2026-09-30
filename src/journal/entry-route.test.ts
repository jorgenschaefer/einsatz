import { describe, expect, it } from "vitest";
import { formatEntryRoute } from "./entry-route";

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
