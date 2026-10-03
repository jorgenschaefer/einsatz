import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("navigates within the app instead of loading a new page", () => {
    // Vitest loads the Pages Router variant of `next/link`, which leaves a
    // click to the browser unless it finds a Pages Router.
    const router = {
      push: vi.fn(async () => true),
      prefetch: vi.fn(async () => {}),
      isLocaleDomain: false,
    } as unknown as NextRouter;
    render(
      <RouterContext.Provider value={router}>
        <BackLink href="/operations" label="Einsätze" />
      </RouterContext.Provider>,
    );
    const link = screen.getByRole("link", { name: "Einsätze" });

    expect(link).toHaveAttribute("href", "/operations");
    expect(fireEvent.click(link)).toBe(false);
  });
});
