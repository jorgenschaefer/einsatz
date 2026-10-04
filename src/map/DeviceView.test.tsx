import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { DeviceView, type DeviceViewProps } from "./DeviceView";
import { aStatefulSymbol } from "./symbol.fixtures";

function renderDevice(over: Partial<DeviceViewProps> = {}) {
  const fake = fakeMapAdapterFactory();
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
  it("shows the location status indicator", () => {
    renderDevice();
    // ohne Geolocation (jsdom) startet der Status pausiert
    expect(screen.getByText(/Standort/i)).toBeInTheDocument();
  });

  it("hands off navigation to the device map app when a symbol is tapped", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { adapter } = renderDevice({
      symbols: [aStatefulSymbol()],
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

  it("closes the live stream when access is lost", () => {
    const closed = vi.fn();
    const eventsHook = () => {
      useEffect(() => closed, []);
      return { connected: true };
    };
    const lostHook = (_t: string, onAccessLost: () => void) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: Test-Hook meldet absichtlich genau einmal „kein Zugang".
      useEffect(() => onAccessLost(), []);
      return { status: "paused" as const, position: null };
    };
    renderDevice({ locationHook: lostHook, eventsHook });
    expect(closed).toHaveBeenCalled();
  });

  it("listens to the live stream of its token route", () => {
    const eventsHook = vi.fn(() => ({ connected: true }));
    renderDevice({ eventsHook });
    expect(eventsHook).toHaveBeenCalledWith(
      "/device/tok/events",
      expect.any(Function),
    );
  });

  it("searches addresses through its token route", async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify([
            { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
          ]),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      renderDevice({ onGeocode: undefined });
      fireEvent.change(screen.getByLabelText("Suche"), {
        target: { value: "hamburg" },
      });
      expect(
        await screen.findByRole("button", { name: /Rathaus, Hamburg/ }),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/device/tok/geocode?q=hamburg");
    } finally {
      vi.unstubAllGlobals();
    }
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
});
