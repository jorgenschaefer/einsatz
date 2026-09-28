import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  routerRefresh,
  screen,
  waitFor,
} from "@/test/render";
import type {
  CreateMapOptions,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import { ViewLinkView, type ViewLinkViewProps } from "./ViewLinkView";

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
    startCirclePreview: vi.fn(),
    stopCirclePreview: vi.fn(),
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

function renderView(over: Partial<ViewLinkViewProps> = {}) {
  const fake = fakeFactory();
  const props: ViewLinkViewProps = {
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
  render(<ViewLinkView {...props} />);
  return fake;
}

const aSymbol = {
  id: "s1",
  lat: 53.5,
  lng: 9.9,
  composition: {
    grundzeichen: "ortsfeste-stelle" as const,
    organisation: "hilfsorganisation" as const,
    text: "Rotkreuz 83/1",
  },
};

describe("ViewLinkView", () => {
  it("renders the operation symbols read-only", async () => {
    const { adapter } = renderView({ symbols: [aSymbol] });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ lat: 53.5, lng: 9.9 }),
      ),
    );
  });

  it("omits location, wipe-lock and locate controls (no device)", () => {
    renderView();
    expect(screen.queryByText(/Standort/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Sperren/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /meinen Standort/i }),
    ).toBeNull();
  });

  it("centers on a tapped symbol instead of opening a map app", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { adapter } = renderView({ symbols: [aSymbol] });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith("s1", expect.anything()),
    );
    const spec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "s1")
      .at(-1)![1] as { onClick?: () => void };
    await act(async () => spec.onClick!());
    expect(open).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
    open.mockRestore();
  });

  it("searches placed objects and jumps to a chosen Kartenzeichen", async () => {
    const { adapter } = renderView({ symbols: [aSymbol] });
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

  it("grays a device symbol that goes stale while the view stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const justNow = new Date(Date.now() - 10 * 1000); // frisch gemeldet
      const { adapter } = renderView({
        eventsHook: () => ({ connected: true }),
        symbols: [
          {
            ...aSymbol,
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

  it("shows a connection-lost hint when the live stream is disconnected", () => {
    renderView({ eventsHook: () => ({ connected: false }) });
    expect(screen.getByText(/Verbindung getrennt/i)).toBeInTheDocument();
  });

  it("reloads the full state when a live event arrives", () => {
    routerRefresh.mockClear();
    let fire: () => void = () => {};
    renderView({
      eventsHook: (_url, onChanged) => {
        fire = onChanged;
        return { connected: true };
      },
    });
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("listens to the live stream of its token route", () => {
    const eventsHook = vi.fn(() => ({ connected: true }));
    renderView({ eventsHook });
    expect(eventsHook).toHaveBeenCalledWith(
      "/view/tok/events",
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
      renderView({ onGeocode: undefined });
      fireEvent.change(screen.getByLabelText("Suche"), {
        target: { value: "hamburg" },
      });
      expect(
        await screen.findByRole("button", { name: /Rathaus, Hamburg/ }),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/view/tok/geocode?q=hamburg");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns the map to the operation's default view", async () => {
    const { adapter } = renderView({
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
    renderView({ operationDefaultView: null });
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });
});
