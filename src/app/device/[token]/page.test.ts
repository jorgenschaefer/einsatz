import { beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import { freshDb } from "@/test/db";
import { expectPageRequiresToken } from "@/test/page-checks";
import DevicePage from "./page";

beforeEach(async () => {
  state.db = await freshDb();
});

expectPageRequiresToken(DevicePage);
