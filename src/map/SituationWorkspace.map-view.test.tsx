import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { screen, waitFor, within } from "@/test/render";
import {
  AREA,
  mapPanel,
  openPanel,
  renderWorkspace,
  SYMBOL,
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
      const onSetDefault = vi.fn(async () => ({}));
      const { adapter, captured } = renderWorkspace({ onSetDefault });
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

      expect(onSetDefault).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 14,
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("saves nothing on Abbrechen", async () => {
      const onSetDefault = vi.fn(async () => ({}));
      renderWorkspace({ onSetDefault });
      await selectMainView("Lagekarte");

      const dialog = await askToSetDefaultView();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onSetDefault).not.toHaveBeenCalled();
    });

    it("shows a failing save only in the open confirmation", async () => {
      renderWorkspace({
        onSetDefault: vi.fn(async () => ({ error: "Ungültiger Ausschnitt." })),
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
        const onSetDefault = vi.fn(async () => ({}));
        renderWorkspace({ onSetDefault, factory: undefined });
        await selectMainView("Lagekarte");
        const dialog = await askToSetDefaultView();
        await userEvent.click(within(dialog).getByText("Festlegen"));

        expect(within(dialog).getByRole("alert")).toHaveTextContent(
          "Die Karte lädt noch. Bitte erneut versuchen.",
        );
        expect(onSetDefault).not.toHaveBeenCalled();
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
      const onSetDefault = vi.fn(async () => ({}));
      const { adapter, captured } = renderWorkspace({ onSetDefault });
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

  it("keeps only Zum Standard-Ausschnitt zurück among the Kartenknöpfe", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    expect(
      within(screen.getByRole("group", { name: "Kartenknöpfe" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Zum Standard-Ausschnitt zurück"]);
    expect(
      screen.queryByRole("button", { name: "Standard-Ausschnitt festlegen" }),
    ).toBeNull();
  });

  // Das CSS blendet `.map-controls` unter `[data-panel-open]` aus.
  it("puts Zum Standard-Ausschnitt zurück where an open sheet hides it on a phone", async () => {
    renderWorkspace();
    await openPanel("Ebenen");
    expect(document.querySelector('[data-view="map"]')).toHaveAttribute(
      "data-panel-open",
    );
    expect(
      screen
        .getByRole("button", { name: "Zum Standard-Ausschnitt zurück" })
        .closest(".map-controls__view"),
    ).not.toBeNull();
  });

  describe.each([
    { current: 10, expected: 16 },
    { current: 18, expected: 18 },
  ])("jumping from a panel at zoom $current", ({ current, expected }) => {
    it(`centers on a Kartenzeichen at zoom ${expected}`, async () => {
      const { adapter } = renderWorkspace({ symbols: [SYMBOL] });
      adapter.getView = () => ({ lat: 0, lng: 0, zoom: current });
      await openPanel("Kartenzeichen");
      await userEvent.click(
        within(mapPanel("Kartenzeichen")).getByText("Pumpe 1"),
      );
      await waitFor(() =>
        expect(adapter.setView).toHaveBeenCalledWith({
          lat: SYMBOL.lat,
          lng: SYMBOL.lng,
          zoom: expected,
        }),
      );
    });

    it(`centers on a Bereich at zoom ${expected}`, async () => {
      const { adapter } = renderWorkspace({ areas: [AREA] });
      adapter.getView = () => ({ lat: 0, lng: 0, zoom: current });
      await openPanel("Bereiche");
      await userEvent.click(within(mapPanel("Bereiche")).getByText("Deich"));
      await waitFor(() =>
        expect(adapter.setView).toHaveBeenCalledWith({
          ...AREA.geometry.center,
          zoom: expected,
        }),
      );
    });
  });

  it("zooms out to the operation's default view from closer in", async () => {
    const { adapter } = renderWorkspace({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
    adapter.getView = () => ({ lat: 0, lng: 0, zoom: 18 });
    await selectMainView("Lagekarte");
    await userEvent.click(
      screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
        selector: "button",
      }),
    );
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );
  });

  it("disables the return-to-default button when no default view is set", async () => {
    renderWorkspace({ operationDefaultView: null });
    await selectMainView("Lagekarte");
    expect(
      screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
        selector: "button",
      }),
    ).toBeDisabled();
  });

  it("returns the map to the operation's default view when the button is clicked", async () => {
    const { adapter } = renderWorkspace({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
    await selectMainView("Lagekarte");
    const button = screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
      selector: "button",
    });
    await userEvent.click(button);
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );

    // Nach dem Wegpannen muss ein erneuter Klick wieder zum Standard springen.
    adapter.setView.mockClear();
    await userEvent.click(button);
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );
  });
});
