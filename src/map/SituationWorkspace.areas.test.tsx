import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, fireEvent, screen, waitFor, within } from "@/test/render";
import { AREA } from "./map-objects.fixtures";
import {
  buttonWithText,
  mapPanel,
  modeBand,
  openPanel,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  it("draws a Bereich: arming a shape then completing creates the area", async () => {
    const onCreateArea = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({ onCreateArea });
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    const geometry = {
      shape: "polygon",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    };
    await act(async () => {
      onComplete(geometry);
    });
    expect(onCreateArea).toHaveBeenCalledWith(geometry);
  });

  it("lists Bereiche and opens the area editor via the row edit button", async () => {
    const onDeleteArea = vi.fn(async () => ({}));
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone Nord",
    };
    renderWorkspace({ areas: [area], onDeleteArea });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Zone Nord bearbeiten/, {
        selector: "button",
      }),
    );
    await userEvent.click(await screen.findByText("Löschen"));
    await userEvent.click(
      await screen.findByRole("button", { name: "Endgültig löschen" }),
    );
    expect(onDeleteArea).toHaveBeenCalledWith("a1");
  });

  it("centers the map on a Bereich when its list row is clicked, without opening the detail", async () => {
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 53.5, lng: 9.9 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone Nord",
    };
    const { adapter } = renderWorkspace({ areas: [area] });
    await openPanel("Bereiche");
    await userEvent.click(await screen.findByText("Zone Nord"));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
    expect(screen.queryByLabelText("Farbe (Hex)")).toBeNull();
  });

  describe("moving a circle", () => {
    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const startMoving = async () => {
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText("Deich bearbeiten", {
          selector: "button",
        }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText("Verschieben"),
      );
    };
    const movingBand = () =>
      screen.queryByRole("toolbar", { name: "Kreis verschieben" });
    const crosshair = () => document.querySelector(".map-crosshair");
    const setHere = () =>
      userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Hier setzen"),
      );

    it("Verschieben keeps the panel open on the desktop", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      expect(movingBand()).toBeInTheDocument();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("a second tap while saving does not write again", async () => {
      let finish: (r: object) => void = () => {};
      const onUpdateAreaGeometry = vi.fn(
        () => new Promise<object>((resolve) => (finish = resolve)),
      );
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();
      const setButton = buttonWithText(
        "Hier setzen",
        modeBand("Kreis verschieben"),
      );
      expect(setButton).toBeDisabled();
      fireEvent.click(setButton);
      expect(onUpdateAreaGeometry).toHaveBeenCalledTimes(1);
      // Cancelling cannot undo a write already sent.
      expect(
        buttonWithText("Abbrechen", modeBand("Kreis verschieben")),
      ).toBeDisabled();

      await act(async () => finish({}));
      await waitFor(() => expect(movingBand()).toBeNull());
    });

    it("Abbrechen ends moving without saving", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { adapter } = renderWorkspace({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      await startMoving();
      expect(crosshair()).toHaveAttribute("aria-hidden", "true");
      await userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Abbrechen"),
      );

      expect(movingBand()).toBeNull();
      expect(crosshair()).toBeNull();
      await waitFor(() => expect(adapter.stopCirclePreview).toHaveBeenCalled());
      expect(onUpdateAreaGeometry).not.toHaveBeenCalled();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("switching to the ETB keeps moving beside the sidebar", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      await selectMainView("ETB");

      expect(movingBand()).not.toBeNull();
    });

    it("switching to the ETB ends moving on a phone", async () => {
      stubMatchMedia(false);
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      await selectMainView("ETB");
      await selectMainView("Lagekarte");

      expect(movingBand()).toBeNull();
    });
  });
});
