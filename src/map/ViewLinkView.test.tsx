import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { aStatefulSymbol } from "./symbol.fixtures";
import { ViewLinkView, type ViewLinkViewProps } from "./ViewLinkView";

function renderView(over: Partial<ViewLinkViewProps> = {}) {
  const fake = fakeMapAdapterFactory();
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

const aSymbol = aStatefulSymbol({
  composition: {
    grundzeichen: "ortsfeste-stelle",
    organisation: "hilfsorganisation",
    text: "Rotkreuz 83/1",
  },
});

describe("ViewLinkView", () => {
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
});
