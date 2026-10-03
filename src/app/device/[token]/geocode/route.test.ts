import { beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import { freshDb } from "@/test/db";
import { expectRouteRequiresToken } from "@/test/route-checks";
import { routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET } from "./route";

beforeEach(async () => {
  state.db = await freshDb();
});

expectRouteRequiresToken(route, {
  GET: {
    send: (token) =>
      GET(new Request("http://localhost/"), routeParams({ token })),
  },
});
