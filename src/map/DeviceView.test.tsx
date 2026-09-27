import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, routerRefresh, screen, waitFor } from "@/test/render";
import type {
  CreateMapOptions,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import { DeviceView, type DeviceViewProps } from "./DeviceView";

function fakeFactory() {
  const captured: { options?: CreateMapOptions } = {};
  const adapter = {
    getView: () => ({ lat: 0, lng: 0, zoom: 1 }),
    setView: vi.fn(),
    setMarker: vi.fn(),
    removeMarker: vi.fn(),
    setArea: vi.fn(),
    removeArea: vi.fn(),
    setKmlOverlay: vi.fn(),
    removeKmlOverlay: vi.fn(),
    setImageOverlay: vi.fn(),
    removeImageOverlay: vi.fn(),
    startImageOverlayEdit: vi.fn(),
    stopImageOverlayEdit: vi.fn(),
    startDrawing: vi.fn(),
    cancelDrawing: vi.fn(),
    destroy: vi.fn(),
  };
  const factory: MapAdapterFactory = {
    create(_c, options) {
      captured.options = options;
      return adapter;
    },
  };
  return { factory, captured, adapter };
}

function renderDevice(over: Partial<DeviceViewProps> = {}) {
  const fake = fakeFactory();
  const props: DeviceViewProps = {
    token: "tok",
    operationId: "op-x",
    operationDefaultView: { lat: 5, lng: 6, zoom: 12 },
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    areas: [],
    kmlOverlays: [],
    imageOverlays: [],
    geocoderAttribution: "Adresssuche © OpenStreetMap",
    onGeocode: vi.fn(async () => []),
    factory: fake.factory,
    ...over,
  };
  render(<DeviceView {...props} />);
  return fake;
}

describe("DeviceView", () => {
  it("renders the operation symbols read-only, without editing controls", async () => {
    const { adapter } = renderDevice({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ lat: 53.5, lng: 9.9 }),
      ),
    );
    expect(screen.queryByRole("button", { name: /bearbeiten/ })).toBeNull();
  });

  it("shows the location status indicator", () => {
    renderDevice();
    // ohne Geolocation (jsdom) startet der Status pausiert
    expect(screen.getByText(/Standort/i)).toBeInTheDocument();
  });

  it("hands off navigation to the device map app when a symbol is tapped", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { adapter } = renderDevice({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith("s1", expect.anything()),
    );
    const spec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "s1")
      .at(-1)![1] as { onClick?: () => void };
    spec.onClick!();
    expect(open).toHaveBeenCalledWith("geo:53.5,9.9?q=53.5,9.9", "_blank");
    open.mockRestore();
  });

  it("shows the neutral closure page when access is lost", () => {
    // injizierter Hook meldet sofort „kein Zugang"
    const lostHook = (_t: string, onAccessLost: () => void) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: Test-Hook meldet absichtlich genau einmal „kein Zugang".
      useEffect(() => onAccessLost(), []);
      return { status: "paused" as const, position: null };
    };
    renderDevice({ locationHook: lostHook });
    expect(screen.getByText(/nicht mehr aktiv/i)).toBeInTheDocument();
  });

  it("grays a device symbol that goes stale while the device view stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const justNow = new Date(Date.now() - 10 * 1000); // frisch gemeldet
      const { adapter } = renderDevice({
        eventsHook: () => ({ connected: true }),
        symbols: [
          {
            id: "s1",
            lat: 53.5,
            lng: 9.9,
            composition: {
              grundzeichen: "ortsfeste-stelle",
              organisation: "hilfsorganisation",
            },
            positionSource: "device",
            reportedAt: justNow,
          },
        ],
      });
      await vi.waitFor(() =>
        expect(adapter.setMarker).toHaveBeenCalledWith("s1", expect.anything()),
      );
      const fresh = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "s1")
        .at(-1)![1] as MarkerSpec;
      expect(fresh.opacity ?? 1).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000); // > 3 min ohne Meldung
      });
      const stale = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "s1")
        .at(-1)![1] as MarkerSpec;
      expect(stale.opacity).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("searches placed objects and jumps to a chosen Kartenzeichen", async () => {
    const { adapter } = renderDevice({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
            text: "Rotkreuz 83/1",
          },
        },
      ],
    });
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "rotkreuz" },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /Rotkreuz 83\/1/ }),
    );
    expect(adapter.setView).toHaveBeenCalledWith({
      lat: 53.5,
      lng: 9.9,
      zoom: 16,
    });
  });

  it("searches addresses through the injected geocoder and jumps to a hit", async () => {
    const onGeocode = vi.fn(async () => [
      { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
    ]);
    const { adapter } = renderDevice({ onGeocode });
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "hamburg" },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /Rathaus, Hamburg/ }),
    );
    expect(onGeocode).toHaveBeenCalledWith("hamburg");
    expect(adapter.setView).toHaveBeenCalledWith({
      lat: 53.55,
      lng: 9.99,
      zoom: 16,
    });
  });

  it("shows a connection-lost hint when the live stream is disconnected", () => {
    renderDevice({ eventsHook: () => ({ connected: false }) });
    expect(screen.getByText(/Verbindung getrennt/i)).toBeInTheDocument();
  });

  it("reloads the full state when a live event arrives", () => {
    routerRefresh.mockClear();
    let fire: () => void = () => {};
    renderDevice({
      eventsHook: (_url, onChanged) => {
        fire = onChanged;
        return { connected: true };
      },
    });
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("centers the map on the device's own position when the locate button is tapped", async () => {
    const { adapter } = renderDevice({
      locationHook: () => ({
        status: "active",
        position: { lat: 52.1, lng: 8.7 },
      }),
    });
    await userEvent.click(
      screen.getByRole("button", { name: /meinen Standort/i }),
    );
    expect(adapter.setView).toHaveBeenCalledWith({
      lat: 52.1,
      lng: 8.7,
      zoom: 16,
    });
  });

  it("disables the locate button while no own position is known", () => {
    renderDevice({
      locationHook: () => ({ status: "paused", position: null }),
    });
    expect(
      screen.getByRole("button", { name: /meinen Standort/i }),
    ).toBeDisabled();
  });

  it("keeps the location watch running while the wipe lock is active", async () => {
    const locationHook = vi.fn(() => ({
      status: "active" as const,
      position: null,
    }));
    renderDevice({ locationHook });
    expect(locationHook).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Sperren/ }));
    expect(screen.getByTestId("wipe-lock-overlay")).toBeInTheDocument();

    // Die Ortung läuft unter der Sperre unverändert weiter: der Standort-Hook
    // bleibt montiert und die „Standort wird gesendet"-Anzeige besteht fort
    // (nur vom Overlay verdeckt), nicht abgeschaltet.
    expect(locationHook).toHaveBeenCalled();
    expect(screen.getByText(/Standort wird gesendet/)).toBeInTheDocument();
  });

  it("activates and releases the wipe lock", async () => {
    renderDevice();
    expect(screen.queryByTestId("wipe-lock-overlay")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Sperren/ }));
    expect(screen.getByTestId("wipe-lock-overlay")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/entsperren/i), {
      target: { value: "100" },
    });
    expect(screen.queryByTestId("wipe-lock-overlay")).toBeNull();
  });

  it("returns the map to the operation's default view", async () => {
    const { adapter } = renderDevice({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    );
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );
  });

  it("disables the return-to-default button when no default view is set", () => {
    renderDevice({ operationDefaultView: null });
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });
});
