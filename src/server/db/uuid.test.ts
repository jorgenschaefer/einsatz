import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it.each([
    ["a random UUID", randomUUID()],
    ["a UUID in upper case", randomUUID().toUpperCase()],
  ])("accepts %s", (_, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a file name", "marker-icon.png"],
    ["a UUID without hyphens", randomUUID().replaceAll("-", "")],
    ["a UUID with a leading space", ` ${randomUUID()}`],
    ["a UUID with a trailing space", `${randomUUID()} `],
    ["a UUID with a non-hex digit", `g${randomUUID().slice(1)}`],
  ])("rejects %s", (_, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
