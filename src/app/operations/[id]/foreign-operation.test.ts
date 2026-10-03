import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import { insertOperation } from "@/server/operations/operations";
import {
  everythingIn,
  type MapObjects,
  oneOfEachIn,
} from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import { PUT as replaceImageOverlayFile } from "./overlays/[overlayId]/route";

let dir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
  const parent = await mkdtemp(join(tmpdir(), "einsatz-foreign-"));
  dir = join(parent, "uploads");
  await mkdir(dir);
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dirname(dir), { recursive: true, force: true });
});

describe.each<{
  name: string;
  error: string;
  call: (
    otherOperationId: string,
    objects: MapObjects,
  ) => Promise<ActionResult>;
}>([
  {
    name: "replacing a Bild-Overlay's file",
    error: "Bild-Overlay nicht gefunden.",
    call: async (op, o) => {
      const form = new FormData();
      form.append("file", await aPng());
      const response = await replaceImageOverlayFile(
        await multipartRequest("PUT", form),
        routeParams({ id: op, overlayId: o.imageId }),
      );
      return response.json();
    },
  },
])("$name under another Einsatz", ({ error, call }) => {
  it("reports the object as not found and changes nothing", async () => {
    const a = await anOperation("A");
    const b = await anOperation("B");
    const objects = await oneOfEachIn(state.db as Db, a.id);
    const before = await everythingIn(state.db as Db, a.id, dir);

    const result = await call(b.id, objects);

    expect(result).toEqual({ error });
    expect(await everythingIn(state.db as Db, a.id, dir)).toEqual(before);
  });
});

function anOperation(name: string) {
  return insertOperation(state.db as Db, { name, description: null });
}

async function aPng(): Promise<File> {
  const png = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], "neu.png", { type: "image/png" });
}
