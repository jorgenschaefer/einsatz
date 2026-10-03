import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

/**
 * Registers hooks that point `UPLOADS_DIR` at a fresh directory for each test
 * and remove it afterwards; returns the current directory.
 */
export function useUploadsDir(): () => string {
  let uploadsDir: string;
  let originalUploadsDir: string | undefined;

  beforeEach(() => {
    uploadsDir = mkdtempSync(join(tmpdir(), "einsatz-uploads-"));
    originalUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    rmSync(uploadsDir, { recursive: true, force: true });
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
  });

  return () => uploadsDir;
}
