import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@/test/render";
import type { MarkerSpec } from "./adapter";
import { SYMBOL } from "./map-objects.fixtures";
import { SituationWorkspace } from "./SituationWorkspace";
import {
  buildProps,
  openPanel,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";
import { aSymbol } from "./symbol.fixtures";

describe("SituationWorkspace", () => {
  describe("copying a Kartenzeichen from its list row", () => {
    const LIVE_BUS = aSymbol({
      positionSource: "device",
      reportedAt: new Date(),
      deviceLinkToken: "token-1",
      composition: {
        grundzeichen: "kraftfahrzeug-landgebunden",
        organisation: "hilfsorganisation",
        fachaufgabe: "unterbringung",
        einheit: "gruppe",
        verwaltungsstufe: "kreis",
        funktion: "fuehrungskraft",
        symbol: "transport",
        text: "Bus 1",
      },
    });
    const { text: _text, ...COPIED_COMPOSITION } = LIVE_BUS.composition;

    it("places the composition without its Bezeichnung where the map is tapped next, once", async () => {
      const onPlace = vi.fn(async () => ({}));
      const onUpdate = vi.fn(async () => ({}));
      const onMove = vi.fn(async () => ({}));
      const onDelete = vi.fn(async () => ({}));
      const { captured } = renderWorkspace({
        symbols: [LIVE_BUS],
        onPlace,
        onUpdate,
        onMove,
        onDelete,
      });
      await openPanel("Kartenzeichen");
      await userEvent.click(
        screen.getByRole("button", { name: "Bus 1 kopieren" }),
      );
      expect(
        await screen.findByText("Kartenzeichen platzieren"),
      ).toBeInTheDocument();
      await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
      await act(async () => {
        captured.options!.onMapClick!({ lat: 50, lng: 8 });
      });
      await act(async () => {
        captured.options?.onMapClick?.({ lat: 51, lng: 9 });
      });

      expect(onPlace).toHaveBeenCalledTimes(1);
      expect(onPlace).toHaveBeenCalledWith(COPIED_COMPOSITION, 50, 8);
      expect(screen.queryByText("Kartenzeichen platzieren")).toBeNull();
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onMove).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });
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

  it("removes a device link from the Kartenzeichen detail", async () => {
    const onRemoveDeviceLink = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      symbols: [{ ...SYMBOL, deviceLinkToken: "secret-token-123" }],
      onRemoveDeviceLink,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    await userEvent.click(
      await screen.findByRole("button", { name: "Gerätelink entfernen" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Gerätelink entfernen",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Entfernen" }),
    );

    expect(onRemoveDeviceLink).toHaveBeenCalledWith("s1");
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
