import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, screen } from "@/test/render";
import {
  modeBand,
  openPanel,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  it("keeps an armed symbol when the active main view is tapped again", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await selectMainView("Lagekarte");
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("keeps an armed symbol when the width crosses 768 px", async () => {
    const { fireChange } = stubMatchMedia(true);
    try {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      act(() => {
        fireChange(false);
      });
      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
