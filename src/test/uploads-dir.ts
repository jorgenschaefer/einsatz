import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach } from "vitest";

/**
 * Registers hooks that point `UPLOADS_DIR` at a fresh, empty directory for
 * each test and remove it afterwards; returns the current directory. It sits
 * alone in a parent of its own, so a test can check that nothing was written
 * beside it.
 */
export function uploadsDirPerTest(): () => string {
  let uploadsDir: string;
  let originalUploadsDir: string | undefined;

  beforeEach(() => {
    uploadsDir = join(
      mkdtempSync(join(tmpdir(), "einsatz-uploads-")),
      "uploads",
    );
    mkdirSync(uploadsDir);
    originalUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    rmSync(dirname(uploadsDir), { recursive: true, force: true });
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
  });

  return () => uploadsDir;
}
