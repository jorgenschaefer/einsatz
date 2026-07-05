import { describe, expect, it } from "vitest";
import { adminAccess } from "./authorization";
import type { User } from "./users";

const user = (role: "admin" | "user"): User => ({
  id: "x",
  username: "u",
  passwordHash: "h",
  role,
});

describe("adminAccess", () => {
  it("sends an unauthenticated visitor to login", () => {
    expect(adminAccess(null)).toBe("login");
  });

  it("sends a non-admin to the operations overview", () => {
    expect(adminAccess(user("user"))).toBe("operations");
  });

  it("grants an admin access", () => {
    expect(adminAccess(user("admin"))).toBe("ok");
  });
});
