import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/viewlinks/view-links", () => ({
  resolveViewAccess: vi.fn(),
}));

import { resolveViewAccess } from "@/server/viewlinks/view-links";
import ViewPage from "./page";

describe("view page", () => {
  it("shows the neutral closure page when the token has no access", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue(null);
    const ui = await ViewPage({ params: Promise.resolve({ token: "tok" }) });
    render(ui);
    expect(screen.getByText(/nicht mehr aktiv/i)).toBeInTheDocument();
  });
});
