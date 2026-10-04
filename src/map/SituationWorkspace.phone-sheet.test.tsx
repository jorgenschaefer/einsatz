import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { screen } from "@/test/render";
import { AREA, anImageOverlay, SYMBOL } from "./map-objects.fixtures";
import {
  anyMapPanel,
  mapPanel,
  openPanel,
  renderWorkspace,
  startEditingImage,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  describe("closing the sheet on a phone", () => {
    beforeEach(() => {
      stubMatchMedia(false);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("closes it when a Kartenzeichen is jumped to from the list", async () => {
      renderWorkspace({ symbols: [SYMBOL] });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText("Pumpe 1"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Bereich is jumped to from the list", async () => {
      renderWorkspace({ areas: [AREA] });
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Deich"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when editing an image overlay starts", async () => {
      renderWorkspace({ imageOverlays: [anImageOverlay] });
      await startEditingImage();
      expect(anyMapPanel()).toBeNull();
    });

    it("keeps the sidebar panel open on the desktop", async () => {
      stubMatchMedia(true);
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });
  });
});
