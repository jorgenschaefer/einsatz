import { describe, expect, it } from "vitest";
import { isServerActionModule } from "./server-action-modules";

describe("isServerActionModule", () => {
  it.each([
    ["double quotes", '"use server";\nexport async function a() {}'],
    ["single quotes", "'use server';\nexport async function c() {}"],
    ["a line comment above", '// Aktionen\n"use server";'],
    ["a block comment above", '/**\n * Aktionen\n */\n\n"use server";'],
  ])("finds the directive as first statement, with %s", (_, source) => {
    expect(isServerActionModule(source)).toBe(true);
  });

  it.each([
    ["a client module", '"use client";'],
    ["a directive further down", 'import x from "y";\n"use server";'],
    ["an empty file", ""],
  ])("skips %s", (_, source) => {
    expect(isServerActionModule(source)).toBe(false);
  });
});
