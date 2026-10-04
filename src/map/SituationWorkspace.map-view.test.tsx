import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { screen, waitFor, within } from "@/test/render";
import {
  mapPanel,
  openPanel,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

/** Wählt im ⋮ Menü der Handy-Kopfzeile „Standard-Ausschnitt festlegen". */
async function askToSetDefaultView() {
  await userEvent.click(
    within(screen.getByTestId("mobile-header")).getByRole("button", {
      name: "Menü",
    }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", {
      name: "Standard-Ausschnitt festlegen",
    }),
  );
  return screen.findByRole("dialog", { name: "Standard-Ausschnitt festlegen" });
}

describe("SituationWorkspace", () => {
  describe("Standard-Ausschnitt festlegen", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("saves the current map view as the default after confirming, without a notification", async () => {
      const onSetDefaultView = vi.fn(async () => ({}));
      const { adapter, captured } = renderWorkspace({ onSetDefaultView });
      await selectMainView("Lagekarte");
      await waitFor(() => expect(captured.options).toBeDefined());
      adapter.getView = () => ({ lat: 53.5, lng: 9.9, zoom: 14 });

      const dialog = await askToSetDefaultView();
      expect(dialog).toHaveTextContent(
        "Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes.",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Festlegen" }),
      );

      expect(onSetDefaultView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 14,
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("saves nothing on Abbrechen", async () => {
      const onSetDefaultView = vi.fn(async () => ({}));
      renderWorkspace({ onSetDefaultView });
      await selectMainView("Lagekarte");

      const dialog = await askToSetDefaultView();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onSetDefaultView).not.toHaveBeenCalled();
    });

    it("shows a failing save only in the open confirmation", async () => {
      renderWorkspace({
        onSetDefaultView: vi.fn(async () => ({
          error: "Ungültiger Ausschnitt.",
        })),
      });
      await selectMainView("Lagekarte");

      const dialog = await askToSetDefaultView();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Festlegen" }),
      );

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Ungültiger Ausschnitt.",
      );
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("does not save a default view before the map has loaded", async () => {
      // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
      // noch keine Karte und damit keinen Ausschnitt.
      vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
      try {
        const onSetDefaultView = vi.fn(async () => ({}));
        renderWorkspace({ onSetDefaultView, factory: undefined });
        await selectMainView("Lagekarte");
        const dialog = await askToSetDefaultView();
        await userEvent.click(within(dialog).getByText("Festlegen"));

        expect(within(dialog).getByRole("alert")).toHaveTextContent(
          "Die Karte lädt noch. Bitte erneut versuchen.",
        );
        expect(onSetDefaultView).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock("./leaflet-adapter");
      }
    });

    it.each([
      ["disabled", "a phone", "ETB", false],
      ["disabled", "a phone", "Stärke", false],
      ["usable", "a phone", "Lagekarte", false],
      ["usable", "the desktop", "ETB", true],
    ] as const)("is %s on %s under %s", async (state, _, view, desktop) => {
      const disabled = state === "disabled";
      stubMatchMedia(desktop);
      renderWorkspace();
      await selectMainView(view);
      const header = desktop ? "desktop-header" : "mobile-header";

      await userEvent.click(
        within(screen.getByTestId(header)).getByRole("button", {
          name: "Menü",
        }),
      );
      const entry = await screen.findByRole("menuitem", {
        name: "Standard-Ausschnitt festlegen",
      });
      if (disabled) expect(entry).toBeDisabled();
      else expect(entry).toBeEnabled();
    });

    it("saves the whole map's view on a phone with a sheet open and leaves the sheet open", async () => {
      stubMatchMedia(false);
      const onSetDefaultView = vi.fn(async () => ({}));
      const { adapter, captured } = renderWorkspace({ onSetDefaultView });
      adapter.getView = () => ({ lat: 53.5, lng: 9.9, zoom: 14 });
      await openPanel("Ebenen");
      await waitFor(() => expect(captured.options).toBeDefined());

      const dialog = await askToSetDefaultView();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Festlegen" }),
      );

      expect(onSetDefaultView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 14,
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mapPanel("Ebenen")).toBeVisible();
    });
  });
});
