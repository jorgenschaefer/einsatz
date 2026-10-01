import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import type { MarkerSpec } from "./adapter";
import { QUICK_SELECT } from "./quick-select";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";
import {
  buildProps,
  openPanel,
  renderWorkspace,
  SYMBOL,
  selectMainView,
} from "./SituationWorkspace.fixtures";
import { aSymbol } from "./symbol.fixtures";

describe("SituationWorkspace", () => {
  it("places the armed Schnellauswahl composition where the map is clicked", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });

    const ktw = QUICK_SELECT.find((i) => i.label === "KTW")!;
    expect(onPlace).toHaveBeenCalledWith(ktw.composition, 50, 8);
  });

  it("surfaces a returned {error} from placing a Kartenzeichen", async () => {
    const onPlace = vi.fn(async () => ({
      error: "Ungültige Zeichen-Komposition.",
    }));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();
  });

  it("shows a placement error as an overlay inside the map container, not a banner above the work area", async () => {
    const onPlace = vi.fn(async () => ({
      error: "Ungültige Zeichen-Komposition.",
    }));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    const alert = await screen.findByRole("alert");
    expect(alert.closest('[data-view="map"]')).not.toBeNull();
  });

  it("clears a placement error on the next successful placement", async () => {
    const onPlace = vi
      .fn<SituationWorkspaceProps["onPlace"]>()
      .mockResolvedValueOnce({ error: "Ungültige Zeichen-Komposition." })
      .mockResolvedValueOnce({});
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Erneut scharfstellen und platzieren – der alte Fehler verschwindet.
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 51, lng: 9 });
    });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("ends the placing mode after one Kartenzeichen, even while onPlace is still in flight", async () => {
    // onPlace bleibt hängen (Server-Roundtrip): der Modus muss trotzdem sofort
    // enden, sonst platziert ein zweiter Tap während des Roundtrips ein zweites Zeichen.
    let resolvePlace: () => void = () => {};
    const onPlace = vi.fn(
      () =>
        new Promise<{ error?: string }>((r) => {
          resolvePlace = () => r({});
        }),
    );
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    captured.options!.onMapClick!({ lat: 51, lng: 9 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    resolvePlace();
  });

  it("places a composition built in the Erweitert form where the map is clicked", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/Erweitert/));
    await userEvent.click(await screen.findByText("Platzieren"));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 51, lng: 7 });
    });

    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        organisation: "hilfsorganisation",
        grundzeichen: "taktische-formation",
      }),
      51,
      7,
    );
  });

  it("centers the map on a Kartenzeichen when its list row is clicked, without opening the detail", async () => {
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
    await openPanel("Kartenzeichen");
    await userEvent.click(await screen.findByText("Rotkreuz 83/1"));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
    expect(screen.queryByLabelText("Bezeichnung")).toBeNull();
  });

  it("opens the detail via the row edit button", async () => {
    renderWorkspace({
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
    await openPanel("Kartenzeichen");
    await userEvent.click(
      await screen.findByLabelText(/Rotkreuz 83\/1 bearbeiten/, {
        selector: "button",
      }),
    );
    expect(await screen.findByLabelText("Bezeichnung")).toHaveValue(
      "Rotkreuz 83/1",
    );
  });

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

  it("renders a marker for each provided Kartenzeichen", async () => {
    const { adapter } = renderWorkspace({
      symbols: [aSymbol()],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          lat: 53.5,
          lng: 9.9,
          iconUrl: expect.stringMatching(/^data:image\/svg/),
        }),
      ),
    );
  });

  it("opens the detail panel for a selected Kartenzeichen and saves an edit", async () => {
    const onUpdate = vi.fn();
    const { adapter } = renderWorkspace({
      symbols: [
        aSymbol({
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
            text: "RK 1",
          },
        }),
      ],
      onUpdate,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    expect(await screen.findByLabelText("Bezeichnung")).toHaveValue("RK 1");
    await userEvent.click(screen.getByText("Speichern"));
    expect(onUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        grundzeichen: "ortsfeste-stelle",
        text: "RK 1",
      }),
    );
  });

  it("deletes a Kartenzeichen from its detail once confirmed", async () => {
    const onDelete = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({ symbols: [SYMBOL], onDelete });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    await userEvent.click(await screen.findByText("Löschen"));
    const dialog = await screen.findByRole("dialog", {
      name: "Kartenzeichen löschen",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Endgültig löschen" }),
    );

    expect(onDelete).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("generates a device link from the Kartenzeichen detail", async () => {
    const onGenerateDeviceLink = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      symbols: [SYMBOL],
      onGenerateDeviceLink,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    await userEvent.click(await screen.findByText(/Gerätelink erzeugen/));

    expect(onGenerateDeviceLink).toHaveBeenCalledWith("s1");
  });

  it("does not show an earlier Kartenzeichen's save error after it vanished", async () => {
    const { adapter, props } = buildProps({
      symbols: [aSymbol({ id: "s1" }), aSymbol({ id: "s2" })],
      onUpdate: vi.fn(async () => ({
        error: "Ungültige Zeichen-Komposition.",
      })),
    });
    const clickMarker = (id: string) => {
      const call = adapter.setMarker.mock.calls.findLast(([m]) => m === id);
      act(() => (call![1] as MarkerSpec).onClick!());
    };
    const { rerender } = render(<SituationWorkspace {...props} />);
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalledTimes(2));
    clickMarker("s1");
    await userEvent.click(await screen.findByText("Speichern"));
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();

    rerender(
      <SituationWorkspace {...props} symbols={[aSymbol({ id: "s2" })]} />,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Kartenzeichen" }),
      ).not.toBeInTheDocument(),
    );
    clickMarker("s2");

    expect(
      await screen.findByRole("dialog", { name: "Kartenzeichen" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Ungültige Zeichen-Komposition."),
    ).not.toBeInTheDocument();
  });

  it("grays out a device symbol whose last report is stale, but never a manual one", async () => {
    const stale = new Date(Date.now() - 4 * 60 * 1000); // > 3 min
    const { adapter } = renderWorkspace({
      symbols: [
        aSymbol({ id: "dev", positionSource: "device", reportedAt: stale }),
        aSymbol({ id: "man", positionSource: "manual", reportedAt: stale }),
      ],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith("dev", expect.anything()),
    );
    const devSpec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "dev")
      .at(-1)![1] as MarkerSpec;
    const manSpec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "man")
      .at(-1)![1] as MarkerSpec;
    expect(devSpec.opacity).toBeLessThan(1);
    expect(manSpec.opacity ?? 1).toBe(1);
  });

  it("grays a device symbol that goes stale while the view stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const justNow = new Date(Date.now() - 10 * 1000); // frisch gemeldet
      const { adapter } = renderWorkspace({
        symbols: [
          aSymbol({ id: "dev", positionSource: "device", reportedAt: justNow }),
        ],
      });
      await vi.waitFor(() =>
        expect(adapter.setMarker).toHaveBeenCalledWith(
          "dev",
          expect.anything(),
        ),
      );
      const fresh = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "dev")
        .at(-1)![1] as MarkerSpec;
      expect(fresh.opacity ?? 1).toBe(1); // noch nicht veraltet

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000); // > 3 min ohne neue Meldung
      });
      const stale = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "dev")
        .at(-1)![1] as MarkerSpec;
      expect(stale.opacity).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
