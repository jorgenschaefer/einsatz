import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { act, screen, waitFor } from "@/test/render";
import type { SymbolComposition } from "./composition";
import { karteNotification, renderMapHook } from "./map-hooks.fixtures";
import { QUICK_SELECT } from "./quick-select";
import { useSymbolPlacement } from "./useSymbolPlacement";

type Placing = (
  composition: SymbolComposition,
  lat: number,
  lng: number,
) => Promise<ActionResult>;

const KTW = QUICK_SELECT.find((i) => i.label === "KTW")!;
const BUS: SymbolComposition = {
  grundzeichen: "kraftfahrzeug-landgebunden",
  organisation: "hilfsorganisation",
  fachaufgabe: "unterbringung",
  einheit: "gruppe",
  verwaltungsstufe: "kreis",
  funktion: "fuehrungskraft",
  symbol: "transport",
  text: "Bus 1",
};
const INVALID = "Ungültige Zeichen-Komposition.";

function renderSymbolPlacement(onPlace = vi.fn<Placing>(async () => ({}))) {
  const rendered = renderMapHook(
    ({ mode, runMapAction, closeSheetOnPhone }) =>
      useSymbolPlacement({ mode, runMapAction, closeSheetOnPhone, onPlace }),
    {},
  );
  return {
    placement: () => rendered.result.current.result,
    mode: () => rendered.result.current.mode,
    closeSheetOnPhone: rendered.closeSheetOnPhone,
    onPlace,
  };
}

type SymbolPlacement = ReturnType<typeof renderSymbolPlacement>;

/** Places the armed composition, as a tap on the map does. */
const placeArmed = (hook: SymbolPlacement, lat = 50, lng = 8) =>
  act(async () => {
    const composition = hook.placement().armedComposition;
    if (composition)
      await hook.placement().placeSymbolAt(composition, lat, lng);
  });

describe("useSymbolPlacement", () => {
  describe("from the Schnellauswahl", () => {
    it.each(
      QUICK_SELECT.filter((i) => ["KTW", "Notunterkunft"].includes(i.label)),
    )("places the armed $label where the map is tapped", async (item) => {
      const hook = renderSymbolPlacement();
      act(() => hook.placement().armQuickSymbol(item.id));
      expect(hook.placement().armedComposition).toEqual(item.composition);

      await placeArmed(hook);

      expect(hook.onPlace).toHaveBeenCalledWith(item.composition, 50, 8);
    });

    it("closes the sheet on a phone when a symbol is armed, not when it is disarmed", () => {
      const hook = renderSymbolPlacement();

      act(() => hook.placement().armQuickSymbol(KTW.id));
      expect(hook.closeSheetOnPhone).toHaveBeenCalledTimes(1);

      act(() => hook.placement().armQuickSymbol(null));
      expect(hook.placement().armedComposition).toBeNull();
      expect(hook.closeSheetOnPhone).toHaveBeenCalledTimes(1);
    });
  });

  describe("placing", () => {
    it("ends the placing mode after one Kartenzeichen, even while onPlace is still in flight", async () => {
      let finish: (result: ActionResult) => void = () => {};
      const hook = renderSymbolPlacement(
        vi.fn<Placing>(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        ),
      );
      act(() => hook.placement().armQuickSymbol(KTW.id));

      act(() => {
        void hook.placement().placeSymbolAt(KTW.composition, 50, 8);
      });

      expect(hook.placement().armedComposition).toBeNull();
      expect(hook.mode().armedQuickId).toBeNull();
      await act(async () => finish({}));
    });

    it.each([
      ["returns an error", async () => ({ error: INVALID }), INVALID],
      [
        "throws",
        async (): Promise<ActionResult> => {
          throw new Error("db down");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows the failure as the Karte notification when placing %s",
      async (_, onPlace, message) => {
        const hook = renderSymbolPlacement(vi.fn<Placing>(onPlace));
        act(() => hook.placement().armQuickSymbol(KTW.id));

        await placeArmed(hook);

        await karteNotification(message);
      },
    );

    it("clears a placement error on the next successful placement", async () => {
      const hook = renderSymbolPlacement(
        vi
          .fn<Placing>(async () => ({}))
          .mockResolvedValueOnce({ error: INVALID }),
      );
      act(() => hook.placement().armQuickSymbol(KTW.id));
      await placeArmed(hook);
      await screen.findByRole("alert");

      act(() => hook.placement().armQuickSymbol(KTW.id));
      await placeArmed(hook, 51, 9);

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("does not close the sheet on a phone when placing fails", async () => {
      const hook = renderSymbolPlacement(
        vi.fn<Placing>(async () => ({ error: INVALID })),
      );
      act(() => hook.placement().armQuickSymbol(KTW.id));
      hook.closeSheetOnPhone.mockClear();

      await placeArmed(hook);

      await screen.findByRole("alert");
      expect(hook.closeSheetOnPhone).not.toHaveBeenCalled();
    });
  });

  describe("from the Erweitert form", () => {
    it("opens the form without closing the sheet, and arms its composition, closing both", async () => {
      const hook = renderSymbolPlacement();

      act(() => hook.placement().openAdvanced());
      expect(hook.placement().advancedOpened).toBe(true);
      expect(hook.closeSheetOnPhone).not.toHaveBeenCalled();

      act(() => hook.placement().armAdvanced(BUS));
      expect(hook.placement().advancedOpened).toBe(false);
      expect(hook.closeSheetOnPhone).toHaveBeenCalled();

      await placeArmed(hook, 51, 7);
      expect(hook.onPlace).toHaveBeenCalledWith(BUS, 51, 7);
    });
  });

  describe("copying a Kartenzeichen", () => {
    const { text: _text, ...COPIED_COMPOSITION } = BUS;

    it("places the composition without its Bezeichnung once, and closes the sheet on a phone", async () => {
      const hook = renderSymbolPlacement();

      act(() => hook.placement().copySymbol(BUS));
      expect(hook.closeSheetOnPhone).toHaveBeenCalled();
      expect(hook.mode().armedQuickId).toBeNull();
      await placeArmed(hook);
      await placeArmed(hook, 51, 9);

      expect(hook.onPlace).toHaveBeenCalledTimes(1);
      expect(hook.onPlace).toHaveBeenCalledWith(COPIED_COMPOSITION, 50, 8);
      expect(hook.placement().armedComposition).toBeNull();
    });

    it("places nothing once the mode is reset", async () => {
      const hook = renderSymbolPlacement();
      act(() => hook.placement().copySymbol(BUS));

      act(() => hook.mode().reset());
      await placeArmed(hook);

      expect(hook.onPlace).not.toHaveBeenCalled();
    });
  });

  it("arms nothing while another map mode is on", () => {
    const hook = renderSymbolPlacement();

    act(() => hook.mode().armImageEdit("i1"));

    expect(hook.placement().armedComposition).toBeNull();
  });
});
