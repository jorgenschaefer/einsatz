import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { screen } from "@/test/render";
import {
  mapPanel,
  openPanel,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the sidebar panel open on the desktop", async () => {
    stubMatchMedia(true);
    renderWorkspace();
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    expect(mapPanel("Kartenzeichen")).toBeVisible();
  });
});
