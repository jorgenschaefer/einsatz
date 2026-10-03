import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("root layout metadata", () => {
  it("keeps every page out of search engines", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
