import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import type { AreaGeometry } from "./area";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";
import {
  AREA,
  anyMapPanel,
  buildProps,
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

  it("surfaces a returned {error} from completing a draw", async () => {
    const onCreateArea = vi.fn(async () => ({
      error: "Der Radius muss größer als 0 sein.",
    }));
    const { adapter } = renderWorkspace({ onCreateArea });
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    await act(async () => {
      onComplete({ shape: "polygon", points: [{ lat: 1, lng: 2 }] });
    });
    expect(
      await screen.findByText("Der Radius muss größer als 0 sein."),
    ).toBeInTheDocument();
    // Der Zeichenmodus endet trotzdem: erneutes Scharfstellen ist möglich.
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalledTimes(2));
  });

  it("surfaces a returned {error} when redrawing an area geometry", async () => {
    const onUpdateAreaGeometry = vi.fn(async () => ({
      error: "Der Radius muss größer als 0 sein.",
    }));
    const { adapter } = renderWorkspace({
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
      onUpdateAreaGeometry,
    });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await act(async () => {
      (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)({
        shape: "polygon",
        points: [{ lat: 9, lng: 9 }],
      });
    });
    expect(
      await screen.findByText("Der Radius muss größer als 0 sein."),
    ).toBeInTheDocument();
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

  it("does not open the area editor when a Bereich is clicked on the map", async () => {
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone",
    };
    const { adapter } = renderWorkspace({ areas: [area] });
    await waitFor(() =>
      expect(adapter.setArea).toHaveBeenCalledWith("a1", expect.anything()),
    );
    expect(
      (adapter.setArea.mock.calls.at(-1)![1] as { onClick?: () => void })
        .onClick,
    ).toBeUndefined();
  });

  describe("moving a circle", () => {
    const POLYGON = {
      ...AREA,
      id: "p1",
      label: "Feld",
      geometry: {
        shape: "polygon" as const,
        points: [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 2 },
          { lat: 2, lng: 2 },
        ],
      },
    };
    const LINE = {
      ...AREA,
      id: "l1",
      label: "Sperre",
      geometry: {
        shape: "line" as const,
        points: [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 2 },
        ],
      },
    };
    const MAP_CENTRE = { lat: 54, lng: 10, zoom: 15 };

    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const openEditor = async (label = "Deich") => {
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(`${label} bearbeiten`, {
          selector: "button",
        }),
      );
      return screen.findByRole("dialog");
    };
    const startMoving = async () => {
      await userEvent.click(
        within(await openEditor()).getByText("Verschieben"),
      );
    };
    const movingBand = () =>
      screen.queryByRole("toolbar", { name: "Kreis verschieben" });
    const crosshair = () => document.querySelector(".map-crosshair");
    const setHere = () =>
      userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Hier setzen"),
      );
    const cancel = () =>
      userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Abbrechen"),
      );

    it("offers Verschieben only for circles", async () => {
      renderWorkspace({ areas: [AREA, POLYGON, LINE] });
      expect(
        within(await openEditor()).getByText("Verschieben"),
      ).toBeInTheDocument();
      for (const label of ["Feld", "Sperre"]) {
        await userEvent.keyboard("{Escape}");
        await waitFor(() =>
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        await userEvent.click(
          screen.getByLabelText(`${label} bearbeiten`, { selector: "button" }),
        );
        const dialog = await screen.findByRole("dialog");
        expect(
          within(dialog).getByText("Form neu zeichnen"),
        ).toBeInTheDocument();
        expect(
          within(dialog).queryByText("Verschieben"),
        ).not.toBeInTheDocument();
      }
    });

    it("Verschieben closes the editor and, on a phone, the panel, and starts moving", async () => {
      stubMatchMedia(false);
      const { adapter } = renderWorkspace({ areas: [AREA] });
      expect(movingBand()).toBeNull();
      expect(crosshair()).toBeNull();
      await startMoving();

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(anyMapPanel()).toBeNull();
      expect(movingBand()).toBeInTheDocument();
      expect(crosshair()).toHaveAttribute("aria-hidden", "true");
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalledWith({
          radius: 100,
          color: "#e2001a",
          opacity: 0.4,
        }),
      );
      expect(adapter.removeArea).toHaveBeenCalledWith("a1");
    });

    it("Verschieben keeps the panel open on the desktop", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      expect(movingBand()).toBeInTheDocument();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("Hier setzen saves the map centre with the latest radius once and ends moving", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { props, adapter } = buildProps({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await startMoving();
      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, geometry: { ...AREA.geometry, radius: 400 } }]}
        />,
      );
      adapter.getView = () => MAP_CENTRE;
      await setHere();

      expect(onUpdateAreaGeometry).toHaveBeenCalledTimes(1);
      expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", {
        shape: "circle",
        center: { lat: 54, lng: 10 },
        radius: 400,
      });
      await waitFor(() => expect(movingBand()).toBeNull());
      expect(crosshair()).toBeNull();
      expect(adapter.stopCirclePreview).toHaveBeenCalled();
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

    it("a save finishing after another mode started does not end that mode", async () => {
      let finish: (r: object) => void = () => {};
      const onUpdateAreaGeometry = vi.fn(
        () => new Promise<object>((resolve) => (finish = resolve)),
      );
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();
      await userEvent.click(screen.getByText("Polygon"));

      await act(async () => finish({}));
      expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
    });

    it("a failed save keeps moving and shows the error; Abbrechen restores the saved circle", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({
        error: "Ungültige Geometrie.",
      }));
      const { adapter } = renderWorkspace({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      await startMoving();
      await setHere();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Ungültige Geometrie.",
      );
      expect(movingBand()).toBeInTheDocument();
      expect(
        buttonWithText("Hier setzen", modeBand("Kreis verschieben")),
      ).toBeEnabled();

      adapter.setArea.mockClear();
      await cancel();
      expect(movingBand()).toBeNull();
      await waitFor(() =>
        expect(adapter.setArea).toHaveBeenCalledWith(
          "a1",
          expect.objectContaining({ geometry: AREA.geometry }),
        ),
      );
    });

    it("a thrown save keeps moving and shows the fallback error", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => {
        throw new Error("db down");
      });
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
      expect(movingBand()).toBeInTheDocument();
    });

    it("Abbrechen ends moving without saving", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { adapter } = renderWorkspace({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      await startMoving();
      await cancel();

      expect(movingBand()).toBeNull();
      expect(crosshair()).toBeNull();
      await waitFor(() => expect(adapter.stopCirclePreview).toHaveBeenCalled());
      expect(onUpdateAreaGeometry).not.toHaveBeenCalled();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("ends moving when the circle disappears", async () => {
      const { props } = buildProps({ areas: [AREA] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await startMoving();
      rerender(<SituationWorkspace {...props} areas={[]} />);

      await waitFor(() => expect(movingBand()).toBeNull());
      expect(crosshair()).toBeNull();
    });

    it("starting to draw ends moving", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      await userEvent.click(screen.getByText("Polygon"));

      expect(movingBand()).toBeNull();
      expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
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

  describe("opening the area editor after drawing", () => {
    const CIRCLE = {
      shape: "circle" as const,
      center: { lat: 53.5, lng: 9.9 },
      radius: 250,
    };
    const POLYGON = {
      shape: "polygon" as const,
      points: [
        { lat: 1, lng: 1 },
        { lat: 1, lng: 2 },
        { lat: 2, lng: 2 },
      ],
    };
    const LINE = {
      shape: "line" as const,
      points: [
        { lat: 1, lng: 1 },
        { lat: 1, lng: 2 },
      ],
    };

    const draw = async (
      adapter: ReturnType<typeof buildProps>["adapter"],
      shapeLabel: string,
      geometry: AreaGeometry,
    ) => {
      await openPanel("Bereiche");
      // Die Formknöpfe sind Umschalter; eine Bereichszeile nennt ihre Form auch.
      await userEvent.click(
        screen.getByText(shapeLabel, { selector: "[aria-pressed] *" }),
      );
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          geometry,
        );
      });
    };
    const arrive = (
      rerender: (ui: React.ReactElement) => void,
      props: SituationWorkspaceProps,
      geometry: AreaGeometry,
    ) =>
      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, id: "a9", label: "", geometry }]}
        />,
      );
    const editor = () => screen.queryByRole("dialog", { name: "Bereich" });

    it("opens the editor for a newly drawn circle once it arrives", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => ({ id: "a9" })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", CIRCLE);
      expect(editor()).not.toBeInTheDocument();

      arrive(rerender, props, CIRCLE);

      expect(
        await screen.findByRole("dialog", { name: "Bereich" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Radius/)).toHaveValue("250 m");
    });

    it.each([
      ["Polygon", POLYGON],
      ["Linie", LINE],
    ] as const)(
      "does not open the editor after drawing a %s",
      async (label, geometry) => {
        const { adapter, props } = buildProps({
          onCreateArea: vi.fn(async () => ({ id: "a9" })),
        });
        const { rerender } = render(<SituationWorkspace {...props} />);
        await draw(adapter, label, geometry);

        arrive(rerender, props, geometry);

        await act(async () => {});
        expect(editor()).not.toBeInTheDocument();
      },
    );

    it("does not open the editor after redrawing a circle", async () => {
      const { adapter, props } = buildProps({ areas: [AREA] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      await userEvent.click(await screen.findByText(/Form neu zeichnen/));
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          CIRCLE,
        );
      });

      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, geometry: CIRCLE }]}
        />,
      );

      await act(async () => {});
      expect(editor()).not.toBeInTheDocument();
    });

    it("shows the new circle, not the area opened while it was being created", async () => {
      let created: (r: { id: string }) => void = () => {};
      const { adapter, props } = buildProps({
        areas: [AREA],
        onCreateArea: vi.fn(
          () =>
            new Promise<{ id: string }>((resolve) => {
              created = resolve;
            }),
        ),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", { ...CIRCLE, radius: 250 });
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      expect(await screen.findByLabelText(/Beschriftung/)).toHaveValue("Deich");

      rerender(
        <SituationWorkspace
          {...props}
          areas={[AREA, { ...AREA, id: "a9", label: "", geometry: CIRCLE }]}
        />,
      );
      await act(async () => created({ id: "a9" }));

      await waitFor(() =>
        expect(screen.getByLabelText(/Beschriftung/)).toHaveValue(""),
      );
      expect(screen.getByLabelText(/Radius/)).toHaveValue("250 m");
    });

    it("opens the editor for a new circle without an earlier area's save error", async () => {
      const { adapter, props } = buildProps({
        areas: [AREA],
        onUpdateAreaStyle: vi.fn(async () => ({ error: "Stil ungültig." })),
        onCreateArea: vi.fn(async () => ({ id: "a9" })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      await userEvent.click(screen.getByText("Speichern"));
      expect(await screen.findByText("Stil ungültig.")).toBeInTheDocument();
      await userEvent.click(screen.getByText(/Form neu zeichnen/));
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          CIRCLE,
        );
      });

      await draw(adapter, "Kreis", CIRCLE);
      rerender(
        <SituationWorkspace
          {...props}
          areas={[AREA, { ...AREA, id: "a9", label: "", geometry: CIRCLE }]}
        />,
      );

      expect(
        await screen.findByRole("dialog", { name: "Bereich" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Stil ungültig.")).not.toBeInTheDocument();
    });

    it("does not open the editor when creating fails", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => ({
          error: "Der Radius muss größer als 0 sein.",
        })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", { ...CIRCLE, radius: 0 });
      arrive(rerender, props, CIRCLE);

      expect(
        await screen.findByText("Der Radius muss größer als 0 sein."),
      ).toBeInTheDocument();
      expect(editor()).not.toBeInTheDocument();
    });

    it("does not open the editor when creating throws", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => {
          throw new Error("boom");
        }),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", CIRCLE);
      arrive(rerender, props, CIRCLE);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
      expect(editor()).not.toBeInTheDocument();
    });
  });

  it("replaces an area geometry when redrawing", async () => {
    const onUpdateAreaGeometry = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
      onUpdateAreaGeometry,
    });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const geometry = { shape: "polygon", points: [{ lat: 9, lng: 9 }] };
    await act(async () => {
      (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
        geometry,
      );
    });
    expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", geometry);
  });

  it.each([
    ["Linie", "line"],
    ["Kreis", "circle"],
  ])("arms drawing the %s shape", async (label, shape) => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText(label));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        shape,
        expect.any(Function),
      ),
    );
  });

  it("cancels drawing when the armed shape is toggled off", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
  });
});
