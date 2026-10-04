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
import type { MarkerSpec } from "./adapter";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import {
  ReadOnlySituationMap,
  type ReadOnlySituationMapData,
  type ReadOnlySituationMapSeams,
} from "./ReadOnlySituationMap";
import { aStatefulSymbol } from "./symbol.fixtures";
import { useMapFocus } from "./useMapFocus";

type HarnessProps = ReadOnlySituationMapData &
  ReadOnlySituationMapSeams & { children?: React.ReactNode };

function Harness(props: HarnessProps) {
  const focus = useMapFocus(props.operationDefaultView);
  return (
    <ReadOnlySituationMap
      {...props}
      basePath="/view"
      focus={focus}
      onSelect={vi.fn()}
      homeButtonBottom={104}
    />
  );
}

function renderMap(over: Partial<HarnessProps> = {}) {
  const fake = fakeMapAdapterFactory();
  const props: HarnessProps = {
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
  render(<Harness {...props} />);
  return fake;
}

function lastMarker(adapter: ReturnType<typeof renderMap>["adapter"]) {
  return adapter.setMarker.mock.calls
    .filter((c) => c[0] === "s1")
    .at(-1)![1] as MarkerSpec;
}

const aSymbol = aStatefulSymbol({
  composition: {
    grundzeichen: "ortsfeste-stelle",
    organisation: "hilfsorganisation",
    text: "Rotkreuz 83/1",
  },
});

describe("ReadOnlySituationMap", () => {
  it("renders the operation symbols read-only", async () => {
    const { adapter } = renderMap({ symbols: [aSymbol] });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ lat: 53.5, lng: 9.9, draggable: false }),
      ),
    );
  });

  it("grays a device symbol that goes stale while the map stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const justNow = new Date(Date.now() - 10 * 1000); // frisch gemeldet
      const { adapter } = renderMap({
        eventsHook: () => ({ connected: true }),
        symbols: [
          { ...aSymbol, positionSource: "device", reportedAt: justNow },
        ],
      });
      await vi.waitFor(() =>
        expect(adapter.setMarker).toHaveBeenCalledWith("s1", expect.anything()),
      );
      expect(lastMarker(adapter).opacity ?? 1).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000); // > 3 min ohne Meldung
      });
      expect(lastMarker(adapter).opacity).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("searches placed objects and jumps to a chosen Kartenzeichen", async () => {
    const { adapter } = renderMap({ symbols: [aSymbol] });
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
    const { adapter } = renderMap({ onGeocode });
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

  it("marks a chosen address on the map", async () => {
    const { drawn } = renderMap({
      onGeocode: vi.fn(async () => [
        { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
      ]),
    });
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "hamburg" },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: /Rathaus, Hamburg/ }),
    );
    expect(drawn.searchHit).toEqual({ lat: 53.55, lng: 9.99 });
  });

  it("shows a connection-lost hint when the live stream is disconnected", () => {
    renderMap({ eventsHook: () => ({ connected: false }) });
    expect(screen.getByText(/Verbindung getrennt/i)).toBeInTheDocument();
  });

  it("reloads the full state when a live event arrives", () => {
    routerRefresh.mockClear();
    let fire: () => void = () => {};
    renderMap({
      eventsHook: (_url, onChanged) => {
        fire = onChanged;
        return { connected: true };
      },
    });
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("disables the return-to-default button when no default view is set", () => {
    renderMap({ operationDefaultView: null });
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });

  it("renders the controls its view adds", () => {
    renderMap({ children: <button type="button">Sperren</button> });
    expect(screen.getByRole("button", { name: "Sperren" })).toBeInTheDocument();
  });
});
