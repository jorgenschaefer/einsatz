import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, screen, waitFor, within } from "@/test/render";
import {
  AREA,
  anImageOverlay,
  anyMapPanel,
  mapPanel,
  openPanel,
  renderWorkspace,
  SYMBOL,
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

    it("closes it when a Schnellauswahl symbol is armed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Kartenzeichen is copied", async () => {
      renderWorkspace({ symbols: [SYMBOL] });
      await openPanel("Kartenzeichen");
      await userEvent.click(
        screen.getByRole("button", { name: "Pumpe 1 kopieren" }),
      );
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when an Erweitert composition is armed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText("Erweitert …"));
      expect(mapPanel("Kartenzeichen")).toBeInTheDocument();
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText("Platzieren"),
      );
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when drawing a Bereich starts", async () => {
      renderWorkspace();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Bereich is redrawn", async () => {
      renderWorkspace({ areas: [AREA] });
      await openPanel("Bereiche");
      await userEvent.click(
        screen.getByLabelText("Deich bearbeiten", { selector: "button" }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText(
          "Form neu zeichnen",
        ),
      );
      expect(anyMapPanel()).toBeNull();
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

    it("keeps it open when a map action fails", async () => {
      const { captured } = renderWorkspace({
        onPlace: vi.fn(async () => ({
          error: "Ungültige Zeichen-Komposition.",
        })),
      });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await openPanel("Kartenzeichen");
      await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
      await act(async () => {
        captured.options!.onMapClick!({ lat: 50, lng: 8 });
      });
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });

    it("keeps it open when a Schnellauswahl symbol is disarmed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });

    it("keeps it open when drawing is toggled off", async () => {
      renderWorkspace();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      expect(mapPanel("Bereiche")).toBeVisible();
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
