import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { serverActionModules } from "./server-action-modules";

let dir: string;

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function tree(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), "einsatz-modules-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const found = (root: string) =>
  serverActionModules(root).map((file) => file.slice(root.length + 1));

describe("serverActionModules", () => {
  it("finds modules whose first statement is the directive, in any directory", () => {
    const root = tree({
      "a/actions.ts": '"use server";\nexport async function a() {}',
      "b/c/actions.ts": "'use server';\nexport async function c() {}",
    });

    expect(found(root).toSorted()).toEqual(["a/actions.ts", "b/c/actions.ts"]);
  });

  it("finds a module with comments above the directive", () => {
    const root = tree({
      "line.ts": '// Aktionen\n"use server";',
      "block.ts": '/**\n * Aktionen\n */\n\n"use server";',
    });

    expect(found(root).toSorted()).toEqual(["block.ts", "line.ts"]);
  });

  it("skips tests, other modules and a directive further down", () => {
    const root = tree({
      "actions.test.ts": '"use server";',
      "client.tsx": '"use client";',
      "late.ts": 'import x from "y";\n"use server";',
      "notes.md": '"use server";',
    });

    expect(found(root)).toEqual([]);
  });
});
