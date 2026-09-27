import { describe, expect, it } from "vitest";
import { countUnseenEntries } from "./unseen-entries";

const entry = (number: number, author: string | null) => ({ number, author });

describe("countUnseenEntries", () => {
  it("counts a newer entry from another author", () => {
    expect(
      countUnseenEntries([entry(1, "anna"), entry(2, "ben")], 1, "anna"),
    ).toBe(1);
  });

  it("counts nothing when no entry is newer", () => {
    expect(
      countUnseenEntries([entry(1, "ben"), entry(2, "ben")], 2, "anna"),
    ).toBe(0);
  });

  it("counts nothing for no entries", () => {
    expect(countUnseenEntries([], 0, "anna")).toBe(0);
  });

  it("does not count a newer entry of the current user", () => {
    expect(countUnseenEntries([entry(2, "anna")], 1, "anna")).toBe(0);
  });

  it("counts a newer automatic entry", () => {
    expect(countUnseenEntries([entry(2, null)], 1, "anna")).toBe(1);
  });

  it("does not count the entry exactly at the seen mark", () => {
    expect(
      countUnseenEntries([entry(2, "ben"), entry(3, "ben")], 2, "anna"),
    ).toBe(1);
  });
});
