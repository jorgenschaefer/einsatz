import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@/test/render";
import {
  AREA,
  mapPanel,
  openPanel,
  renderWorkspace,
  SYMBOL,
  selectMainView,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  it("saves the current map view as the default after confirming", async () => {
    const onSetDefault = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onSetDefault });
    await selectMainView("Lagekarte");
    await waitFor(() => expect(captured.options).toBeDefined());
    await userEvent.click(
      screen.getByLabelText("Standard-Ausschnitt festlegen", {
        selector: "button",
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByText("Festlegen"),
    );
    expect(onSetDefault).toHaveBeenCalledWith({ lat: 0, lng: 0, zoom: 1 });
  });

  it("does not save a default view before the map has loaded", async () => {
    // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
    // noch keine Karte und damit keinen Ausschnitt.
    vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
    try {
      const onSetDefault = vi.fn(async () => ({}));
      renderWorkspace({ onSetDefault, factory: undefined });
      await selectMainView("Lagekarte");
      await userEvent.click(
        screen.getByLabelText("Standard-Ausschnitt festlegen", {
          selector: "button",
        }),
      );
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByText("Festlegen"));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Die Karte lädt noch. Bitte erneut versuchen.",
      );
      expect(onSetDefault).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./leaflet-adapter");
    }
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
