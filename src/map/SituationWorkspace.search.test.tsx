import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import { SYMBOL } from "./map-objects.fixtures";
import { SituationWorkspace } from "./SituationWorkspace";
import {
  buildProps,
  openPanel,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";
import { aSymbol } from "./symbol.fixtures";

const RATHAUS = { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 };
const HAFEN = { label: "Hafen, Hamburg", lat: 53.54, lng: 9.97 };

const typeSearch = (value: string) =>
  fireEvent.change(screen.getByLabelText("Suche"), { target: { value } });

/** Sucht `query` und wählt den Adresstreffer mit `label`. */
async function chooseAddress(query: string, label: string) {
  typeSearch(query);
  await userEvent.click(
    await screen.findByRole("button", { name: new RegExp(label) }),
  );
}

describe("SituationWorkspace search", () => {
  it("geocodes the address query (debounced) and shows the result", async () => {
    const onGeocode = vi.fn(async () => [
      { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
    ]);
    renderWorkspace({ onGeocode });
    await selectMainView("Lagekarte");
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "Hamburg" },
    });
    await waitFor(() => expect(onGeocode).toHaveBeenCalledWith("Hamburg"));
    expect(await screen.findByText(/Rathaus, Hamburg/)).toBeInTheDocument();
  });

  it("jumps the map to a searched Kartenzeichen", async () => {
    const { adapter } = renderWorkspace({
      symbols: [
        aSymbol({
          composition: {
            grundzeichen: "taktische-formation",
            organisation: "hilfsorganisation",
            text: "Rotkreuz 83/1",
          },
        }),
      ],
    });
    await selectMainView("Lagekarte");
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "Rotkreuz" },
    });
    // Ein Kartenzeichen mit demselben Namen kann gleichzeitig im offenen
    // Kartenzeichen-Panel stehen; auf das Suchergebnis beschränken.
    const results = within(
      (await screen.findByText("Einsatzobjekte")).parentElement as HTMLElement,
    );
    await userEvent.click(results.getByText(/Rotkreuz 83\/1/));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
  });

  describe.each([
    { current: 10, expected: 16 },
    { current: 18, expected: 18 },
  ])("jumping from the search at zoom $current", ({ current, expected }) => {
    it(`centers on a chosen address at zoom ${expected}`, async () => {
      const onGeocode = vi.fn(async () => [
        { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
      ]);
      const { adapter } = renderWorkspace({ onGeocode });
      adapter.getView = () => ({ lat: 0, lng: 0, zoom: current });
      await selectMainView("Lagekarte");
      fireEvent.change(screen.getByLabelText("Suche"), {
        target: { value: "Hamburg" },
      });
      await userEvent.click(await screen.findByText(/Rathaus, Hamburg/));
      await waitFor(() =>
        expect(adapter.setView).toHaveBeenCalledWith({
          lat: 53.55,
          lng: 9.99,
          zoom: expected,
        }),
      );
    });

    it(`centers on a chosen Kartenzeichen at zoom ${expected}`, async () => {
      const { adapter } = renderWorkspace({ symbols: [SYMBOL] });
      adapter.getView = () => ({ lat: 0, lng: 0, zoom: current });
      await selectMainView("Lagekarte");
      fireEvent.change(screen.getByLabelText("Suche"), {
        target: { value: "Pumpe" },
      });
      const results = within(
        (await screen.findByText("Einsatzobjekte"))
          .parentElement as HTMLElement,
      );
      await userEvent.click(results.getByText(/Pumpe 1/));
      await waitFor(() =>
        expect(adapter.setView).toHaveBeenCalledWith({
          lat: SYMBOL.lat,
          lng: SYMBOL.lng,
          zoom: expected,
        }),
      );
    });
  });

  describe("Suchtreffer", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("marks a chosen address on the map", async () => {
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() =>
        expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng }),
      );
    });

    it("moves the mark to another chosen address", async () => {
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS, HAFEN]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await userEvent.click(screen.getByLabelText("Suche"));
      await userEvent.click(
        screen.getByRole("button", { name: new RegExp(HAFEN.label) }),
      );
      await waitFor(() =>
        expect(drawn.searchHit).toEqual({ lat: HAFEN.lat, lng: HAFEN.lng }),
      );
    });

    it("removes the mark when the search is cleared with ×", async () => {
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      await userEvent.click(
        screen.getByRole("button", { name: "Suche löschen" }),
      );
      await waitFor(() => expect(drawn.searchHit).toBeNull());
    });

    it.each([[""], ["   "]])(
      "removes the mark when the search text is deleted (%j)",
      async (text) => {
        const { drawn } = renderWorkspace({
          onGeocode: vi.fn(async () => [RATHAUS]),
        });
        await selectMainView("Lagekarte");
        await chooseAddress("Hamburg", RATHAUS.label);
        await waitFor(() => expect(drawn.searchHit).not.toBeNull());
        typeSearch(text);
        await waitFor(() => expect(drawn.searchHit).toBeNull());
      },
    );

    it("keeps the mark while the search text changes without being emptied", async () => {
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      typeSearch("Hambur");
      typeSearch("H");
      await act(async () => {});
      expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng });
    });

    it("removes the mark when an Einsatzobjekt is chosen", async () => {
      const { drawn } = renderWorkspace({
        symbols: [SYMBOL],
        onGeocode: vi.fn(async () => [{ ...RATHAUS, label: "Pumpenhaus" }]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Pumpe", "Pumpenhaus");
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      await userEvent.click(screen.getByLabelText("Suche"));
      const results = within(
        screen.getByText("Einsatzobjekte").parentElement as HTMLElement,
      );
      await userEvent.click(results.getByText(/Pumpe 1/));
      await waitFor(() => expect(drawn.searchHit).toBeNull());
    });

    it("keeps the mark while panels open and close and a Kartenzeichen is placed", async () => {
      const onPlace = vi.fn(async () => ({}));
      const { drawn, captured } = renderWorkspace({
        onPlace,
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      await openPanel("Ebenen");
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await act(async () => {
        captured.options?.onMapClick?.({ lat: 50, lng: 8 });
      });
      expect(onPlace).toHaveBeenCalled();
      expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng });
    });

    it("keeps the mark when switching to the ETB and back on the phone", async () => {
      stubMatchMedia(false);
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      await selectMainView("ETB");
      await selectMainView("Lagekarte");
      expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng });
    });

    it("keeps the mark and the query when the result list is closed with Escape", async () => {
      const { drawn } = renderWorkspace({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      await userEvent.click(screen.getByLabelText("Suche"));
      expect(await screen.findByText("Adressen")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByText("Adressen")).toBeNull();
      expect(screen.getByLabelText("Suche")).toHaveValue("Hamburg");
      expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng });
    });

    it("keeps the mark when changes of other users arrive", async () => {
      const { props, drawn, adapter } = buildProps({
        onGeocode: vi.fn(async () => [RATHAUS]),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");
      await chooseAddress("Hamburg", RATHAUS.label);
      await waitFor(() => expect(drawn.searchHit).not.toBeNull());
      rerender(<SituationWorkspace {...props} symbols={[SYMBOL]} />);
      await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
      expect(drawn.searchHit).toEqual({ lat: RATHAUS.lat, lng: RATHAUS.lng });
    });
  });
});
