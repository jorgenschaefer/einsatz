import { existsSync, readdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { uploadsDirPerTest } from "./uploads-dir";

const originalUploadsDir = process.env.UPLOADS_DIR;
let used: string | undefined;

describe("uploadsDirPerTest", () => {
  const uploadsDir = uploadsDirPerTest();

  it("points UPLOADS_DIR at an empty directory alone in a parent of its own", () => {
    used = uploadsDir();
    expect(process.env.UPLOADS_DIR).toBe(used);
    expect(readdirSync(used)).toEqual([]);
    expect(readdirSync(dirname(used))).toEqual([basename(used)]);
  });
});

it("removes the directory with its parent and restores UPLOADS_DIR afterwards", () => {
  expect(used).toBeDefined();
  expect(existsSync(dirname(used as string))).toBe(false);
  expect(process.env.UPLOADS_DIR).toBe(originalUploadsDir);
});
