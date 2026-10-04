import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, screen, waitFor, within } from "@/test/render";
import type { AreaGeometry } from "./area";
import { aMapRef, renderMapHook } from "./map-hooks.fixtures";
import { AREA } from "./map-objects.fixtures";
import type { RenderedArea } from "./SituationMap";
import { useAreaFlows } from "./useAreaFlows";
import type { MapView } from "./view";

const POLYGON: AreaGeometry = {
  shape: "polygon",
  points: [
    { lat: 1, lng: 1 },
    { lat: 1, lng: 2 },
    { lat: 2, lng: 2 },
  ],
};
const LINE: AreaGeometry = {
  shape: "line",
  points: [
    { lat: 1, lng: 1 },
    { lat: 1, lng: 2 },
  ],
};
const CIRCLE: AreaGeometry = {
  shape: "circle",
  center: { lat: 53.5, lng: 9.9 },
  radius: 250,
};
const ZONE: RenderedArea = {
  ...AREA,
  id: "p1",
  label: "Zone",
  geometry: POLYGON,
};
const FAILURE = "Das hat nicht geklappt. Bitte erneut versuchen.";

type Saving = () => Promise<ActionResult & { id?: string }>;

function renderAreaFlows({
  areas = [] as RenderedArea[],
  view = { lat: 54, lng: 10, zoom: 15 } as MapView | null,
  onCreateArea = vi.fn<Saving>(async () => ({})),
  onUpdateAreaGeometry = vi.fn<Saving>(async () => ({})),
} = {}) {
  const mapRef = aMapRef(view);
  const rendered = renderMapHook(
    (
      { mode, runMapAction, closeSheetOnPhone },
      props: { areas: RenderedArea[] },
    ) =>
      useAreaFlows({
        areas: props.areas,
        mapRef,
        mode,
        runMapAction,
        closeSheetOnPhone,
        onCreateArea,
        onUpdateAreaGeometry,
      }),
    { areas },
  );
  return {
    flows: () => rendered.result.current.result,
    mode: () => rendered.result.current.mode,
    arrive: (next: RenderedArea[]) => rendered.rerender({ areas: next }),
    closeSheetOnPhone: rendered.closeSheetOnPhone,
    onCreateArea,
    onUpdateAreaGeometry,
  };
}

type AreaFlows = ReturnType<typeof renderAreaFlows>;

const completeDrawing = (hook: AreaFlows, geometry: AreaGeometry) =>
  act(() => hook.flows().handleDrawComplete(geometry));

const startMoving = (hook: AreaFlows) =>
  act(() => hook.flows().startMoveCircle(AREA));

const setCircleHere = (hook: AreaFlows) =>
  act(() => hook.flows().setCircleHere());

const karteNotification = async (text: string) => {
  const notification = await screen.findByRole("alert");
  expect(within(notification).getByText("Karte")).toBeInTheDocument();
  expect(notification).toHaveTextContent(text);
};

const pending = () => {
  let finish: (result: ActionResult & { id?: string }) => void = () => {};
  const save = vi.fn<Saving>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  return { save, finish: (result = {}) => act(async () => finish(result)) };
};

describe("useAreaFlows", () => {
  describe("drawing a Bereich", () => {
    it("creates the Bereich from the completed drawing and ends drawing", async () => {
      const hook = renderAreaFlows();
      act(() => hook.flows().toggleAreaDraw("polygon"));
      expect(hook.mode().drawShape).toBe("polygon");

      await completeDrawing(hook, POLYGON);

      expect(hook.onCreateArea).toHaveBeenCalledWith(POLYGON);
      expect(hook.onUpdateAreaGeometry).not.toHaveBeenCalled();
      expect(hook.mode().drawShape).toBeNull();
    });

    it("shows a returned error as the Karte notification and still ends drawing", async () => {
      const hook = renderAreaFlows({
        onCreateArea: vi.fn<Saving>(async () => ({
          error: "Ungültige Geometrie.",
        })),
      });
      act(() => hook.flows().toggleAreaDraw("polygon"));

      await completeDrawing(hook, POLYGON);

      await karteNotification("Ungültige Geometrie.");
      expect(hook.mode().drawShape).toBeNull();
    });

    it("closes the sheet on a phone when a shape is armed, not when it is toggled off", () => {
      const hook = renderAreaFlows();

      act(() => hook.flows().toggleAreaDraw("polygon"));
      expect(hook.closeSheetOnPhone).toHaveBeenCalledTimes(1);

      act(() => hook.flows().toggleAreaDraw("polygon"));
      expect(hook.mode().drawShape).toBeNull();
      expect(hook.closeSheetOnPhone).toHaveBeenCalledTimes(1);
    });
  });

  describe("redrawing a Bereich", () => {
    it("replaces the geometry of the Bereich being redrawn", async () => {
      const hook = renderAreaFlows({ areas: [ZONE] });
      act(() => hook.flows().startRedraw(ZONE));
      expect(hook.mode().redrawAreaId).toBe("p1");

      await completeDrawing(hook, POLYGON);

      expect(hook.onUpdateAreaGeometry).toHaveBeenCalledWith("p1", POLYGON);
      expect(hook.onCreateArea).not.toHaveBeenCalled();
      expect(hook.mode().drawShape).toBeNull();
    });

    it("shows a returned error as the Karte notification", async () => {
      const hook = renderAreaFlows({
        areas: [ZONE],
        onUpdateAreaGeometry: vi.fn<Saving>(async () => ({
          error: "Ungültige Geometrie.",
        })),
      });
      act(() => hook.flows().startRedraw(ZONE));

      await completeDrawing(hook, POLYGON);

      await karteNotification("Ungültige Geometrie.");
    });

    it("closes the editor it was started from and the sheet on a phone", () => {
      const hook = renderAreaFlows({ areas: [ZONE] });
      act(() => hook.flows().selectArea("p1"));
      expect(hook.flows().selectedArea).toBe(ZONE);

      act(() => hook.flows().startRedraw(ZONE));

      expect(hook.flows().selectedArea).toBeNull();
      expect(hook.closeSheetOnPhone).toHaveBeenCalled();
    });
  });

  describe("moving a circle", () => {
    it("Verschieben closes the editor and the sheet on a phone, and starts moving", () => {
      const hook = renderAreaFlows({ areas: [AREA] });
      act(() => hook.flows().selectArea("a1"));

      act(() => hook.flows().startMoveCircle(AREA));

      expect(hook.mode().movingCircleId).toBe("a1");
      expect(hook.flows().selectedArea).toBeNull();
      expect(hook.closeSheetOnPhone).toHaveBeenCalled();
    });

    it("Hier setzen saves the map centre with the latest radius once and ends moving", async () => {
      const hook = renderAreaFlows({ areas: [AREA] });
      startMoving(hook);
      hook.arrive([{ ...AREA, geometry: { ...AREA.geometry, radius: 400 } }]);

      await setCircleHere(hook);

      expect(hook.onUpdateAreaGeometry).toHaveBeenCalledTimes(1);
      expect(hook.onUpdateAreaGeometry).toHaveBeenCalledWith("a1", {
        shape: "circle",
        center: { lat: 54, lng: 10 },
        radius: 400,
      });
      expect(hook.mode().movingCircleId).toBeNull();
    });

    it("is saving until Hier setzen is saved", async () => {
      const { save, finish } = pending();
      const hook = renderAreaFlows({
        areas: [AREA],
        onUpdateAreaGeometry: save,
      });
      startMoving(hook);
      expect(hook.flows().circleMoveSaving).toBe(false);

      act(() => {
        hook.flows().setCircleHere();
      });
      expect(hook.flows().circleMoveSaving).toBe(true);

      await finish();
      expect(hook.flows().circleMoveSaving).toBe(false);
      expect(hook.mode().movingCircleId).toBeNull();
    });

    it("a save finishing after another mode started does not end that mode", async () => {
      const { save, finish } = pending();
      const hook = renderAreaFlows({
        areas: [AREA],
        onUpdateAreaGeometry: save,
      });
      startMoving(hook);
      act(() => {
        hook.flows().setCircleHere();
      });
      act(() => hook.flows().toggleAreaDraw("polygon"));

      await finish();

      expect(hook.mode().drawShape).toBe("polygon");
    });

    it.each([
      [
        "returns an error",
        async () => ({ error: "Ungültige Geometrie." }),
        "Ungültige Geometrie.",
      ],
      [
        "throws",
        async () => {
          throw new Error("db down");
        },
        FAILURE,
      ],
    ])(
      "keeps moving and shows the error when the save %s",
      async (_, save, error) => {
        const hook = renderAreaFlows({
          areas: [AREA],
          onUpdateAreaGeometry: vi.fn<Saving>(save),
        });
        startMoving(hook);

        await setCircleHere(hook);

        await karteNotification(error);
        expect(hook.mode().movingCircleId).toBe("a1");
        expect(hook.flows().circleMoveSaving).toBe(false);
      },
    );

    it("saves nothing while the map has no view yet", async () => {
      const hook = renderAreaFlows({ areas: [AREA], view: null });
      startMoving(hook);

      await setCircleHere(hook);

      expect(hook.onUpdateAreaGeometry).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(hook.mode().movingCircleId).toBe("a1");
    });

    it("ends moving when the circle disappears, keeping the notification of a failed save", async () => {
      const hook = renderAreaFlows({
        areas: [AREA],
        onUpdateAreaGeometry: vi.fn<Saving>(async () => ({
          error: "Einsatz ist geschlossen.",
        })),
      });
      startMoving(hook);
      await setCircleHere(hook);
      await karteNotification("Einsatz ist geschlossen.");

      hook.arrive([]);

      expect(hook.mode().movingCircleId).toBeNull();
      await act(async () => {});
      await karteNotification("Einsatz ist geschlossen.");
    });
  });

  describe("saving a drawing or a moved circle", () => {
    const saves: [
      string,
      (save: Saving) => AreaFlows,
      (hook: AreaFlows) => Promise<void>,
    ][] = [
      [
        "drawing a Bereich",
        (save) => renderAreaFlows({ onCreateArea: vi.fn(save) }),
        (hook) => completeDrawing(hook, POLYGON),
      ],
      [
        "redrawing a Bereich",
        (save) =>
          renderAreaFlows({ areas: [ZONE], onUpdateAreaGeometry: vi.fn(save) }),
        async (hook) => {
          act(() => hook.flows().startRedraw(ZONE));
          await completeDrawing(hook, POLYGON);
        },
      ],
      [
        "moving a circle",
        (save) =>
          renderAreaFlows({ areas: [AREA], onUpdateAreaGeometry: vi.fn(save) }),
        async (hook) => {
          startMoving(hook);
          await setCircleHere(hook);
        },
      ],
    ];

    it.each(saves)(
      "shows the failure as the Karte notification when %s throws",
      async (_, render, perform) => {
        const hook = render(async () => {
          throw new Error("db down");
        });

        await perform(hook);

        await karteNotification(FAILURE);
      },
    );

    it.each(saves)(
      "shows no failure when %s redirects to the login",
      async (_, render, perform) => {
        const save = vi.fn<Saving>(async () => {
          throw redirectError();
        });
        const hook = render(save);

        await perform(hook);

        await waitFor(() => expect(save).toHaveBeenCalled());
        expect(screen.queryByRole("alert")).toBeNull();
      },
    );
  });

  describe("opening the area editor after drawing", () => {
    const NEW_AREA = { ...AREA, id: "a9", label: "" };

    it("opens the editor for a newly drawn circle once it arrives", async () => {
      const hook = renderAreaFlows({
        onCreateArea: vi.fn<Saving>(async () => ({ id: "a9" })),
      });
      await completeDrawing(hook, CIRCLE);
      expect(hook.flows().selectedArea).toBeNull();

      hook.arrive([{ ...NEW_AREA, geometry: CIRCLE }]);

      expect(hook.flows().selectedArea).toMatchObject({
        id: "a9",
        geometry: CIRCLE,
      });
    });

    it.each([
      ["Polygon", POLYGON],
      ["Linie", LINE],
    ])("does not open the editor after drawing a %s", async (_, geometry) => {
      const hook = renderAreaFlows({
        onCreateArea: vi.fn<Saving>(async () => ({ id: "a9" })),
      });
      await completeDrawing(hook, geometry);

      hook.arrive([{ ...NEW_AREA, geometry }]);

      expect(hook.flows().selectedArea).toBeNull();
    });

    it("does not open the editor after redrawing a circle", async () => {
      const hook = renderAreaFlows({ areas: [AREA] });
      act(() => hook.flows().startRedraw(AREA));
      await completeDrawing(hook, CIRCLE);

      hook.arrive([{ ...AREA, geometry: CIRCLE }]);

      expect(hook.flows().selectedArea).toBeNull();
    });

    it("shows the new circle, not the area opened while it was being created", async () => {
      const { save, finish } = pending();
      const hook = renderAreaFlows({ areas: [AREA], onCreateArea: save });
      act(() => {
        hook.flows().handleDrawComplete(CIRCLE);
      });
      act(() => hook.flows().selectArea("a1"));
      expect(hook.flows().selectedArea?.id).toBe("a1");

      hook.arrive([AREA, { ...NEW_AREA, geometry: CIRCLE }]);
      await finish({ id: "a9" });

      expect(hook.flows().selectedArea?.id).toBe("a9");
    });

    it.each([
      ["fails", async () => ({ error: "Der Radius muss größer als 0 sein." })],
      [
        "throws",
        async () => {
          throw new Error("boom");
        },
      ],
    ])("does not open the editor when creating %s", async (_, create) => {
      const hook = renderAreaFlows({ onCreateArea: vi.fn<Saving>(create) });
      await completeDrawing(hook, CIRCLE);

      hook.arrive([{ ...NEW_AREA, geometry: CIRCLE }]);

      await screen.findByRole("alert");
      expect(hook.flows().selectedArea).toBeNull();
    });
  });
});
