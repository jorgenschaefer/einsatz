import { describe, expectTypeOf, it } from "vitest";
import type { LoginRefusal } from "./route-checks";

describe("expectRouteRequiresLogin", () => {
  it("takes only a refusal as the answer to an anonymous caller", () => {
    expectTypeOf<{ redirectTo: "/login" }>().toExtend<LoginRefusal>();
    expectTypeOf<{ status: 401 }>().toExtend<LoginRefusal>();
    expectTypeOf<{ status: 200 }>().not.toExtend<LoginRefusal>();
    expectTypeOf<{ redirectTo: "/operations" }>().not.toExtend<LoginRefusal>();
  });
});
