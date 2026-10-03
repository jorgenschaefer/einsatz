import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, screen, waitFor, within } from "@/test/render";
import type { fakeMapAdapterFactory } from "./adapter.fixtures";
import { anImageOverlay } from "./map-objects.fixtures";
import {
  buttonWithText,
  modeBand,
  openPanel,
  renderWorkspace,
  selectMainView,
  startEditingImage,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  it("shows the Kartenzeichen band while a Schnellauswahl symbol is armed and cancels it", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    const ktw = buttonWithText(/KTW/);
    await userEvent.click(ktw);
    await userEvent.click(
      within(modeBand("Kartenzeichen platzieren")).getByText("Abbrechen"),
    );
    expect(ktw).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("shows the Kartenzeichen band while an Erweitert composition is armed", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText("Erweitert …"));
    await userEvent.click(await screen.findByText("Platzieren"));
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("shows the Bereich band while drawing and cancels the drawing", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    const polygon = buttonWithText("Polygon");
    await userEvent.click(polygon);
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await userEvent.click(
      within(modeBand("Bereich zeichnen")).getByText("Abbrechen"),
    );
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    expect(polygon).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("cancels an armed symbol when switching to the ETB on a phone", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    const ktw = buttonWithText(/KTW/);
    await userEvent.click(ktw);
    await selectMainView("ETB");
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(ktw).toHaveAttribute("aria-pressed", "false");
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("cancels drawing when switching to the ETB on a phone", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await selectMainView("ETB");
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

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

  describe("a map mode beside the sidebar on the desktop", () => {
    let fireChange: (matches: boolean) => void;
    beforeEach(() => {
      ({ fireChange } = stubMatchMedia(true));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const clickMap = async (
      captured: ReturnType<typeof fakeMapAdapterFactory>["captured"],
    ) => {
      await act(async () => {
        captured.options!.onMapClick!({ lat: 50, lng: 8 });
      });
    };

    it("keeps an armed symbol across the ETB and places it with the next map click", async () => {
      const onPlace = vi.fn(async () => ({}));
      const { captured, adapter } = renderWorkspace({ onPlace });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      adapter.setView.mockClear();

      await selectMainView("ETB");

      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
      await clickMap(captured);
      expect(onPlace).toHaveBeenCalledWith(expect.anything(), 50, 8);
      expect(adapter.setView).not.toHaveBeenCalled();
    });

    it("keeps an armed symbol across the Stärke and back to another map panel", async () => {
      const onPlace = vi.fn(async () => ({}));
      const { captured, adapter } = renderWorkspace({ onPlace });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      adapter.setView.mockClear();

      await selectMainView("Stärke");
      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
      await openPanel("Bereiche");

      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
      await clickMap(captured);
      expect(onPlace).toHaveBeenCalledWith(expect.anything(), 50, 8);
      expect(adapter.setView).not.toHaveBeenCalled();
    });

    it("keeps drawing across the ETB", async () => {
      const { adapter } = renderWorkspace();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());

      await selectMainView("ETB");

      expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
      expect(adapter.cancelDrawing).not.toHaveBeenCalled();
    });

    it("keeps image editing across the ETB", async () => {
      const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
      await startEditingImage();

      await selectMainView("ETB");

      expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
      expect(adapter.stopImageOverlayEdit).not.toHaveBeenCalled();
    });

    it("ends an armed symbol when the window narrows to a phone while the ETB is shown", async () => {
      const onPlace = vi.fn(async () => ({}));
      const { captured } = renderWorkspace({ onPlace });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await selectMainView("ETB");

      act(() => fireChange(false));

      await selectMainView("Lagekarte");
      expect(screen.queryByRole("toolbar")).toBeNull();
      await clickMap(captured);
      expect(onPlace).not.toHaveBeenCalled();
    });
  });

  it("shows no mode band while nothing is armed", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("ends image editing when switching the main view on a phone", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await selectMainView("ETB");
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
  });

  it("does not place a Kartenzeichen when the map is clicked while editing an overlay", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onPlace,
    });
    await openPanel("Ebenen");
    await userEvent.click(await screen.findByText("Bearbeiten"));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("leaves image editing when a redraw is started (modes are exclusive)", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
    });
    await openPanel("Ebenen");
    await userEvent.click(await screen.findByText("Bearbeiten"));
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    // Einen Bereich auswählen und dessen Form neu zeichnen …
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    // … beendet den Bild-Bearbeiten-Modus.
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });
});
