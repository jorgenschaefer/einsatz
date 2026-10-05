import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef } from "react";
import { expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import type { MarkerSpec } from "./adapter";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import type { ImagePlacement } from "./image-overlay";
import { AREA, anImageOverlay } from "./map-objects.fixtures";
import type { SituationMapHandle } from "./SituationMap";
import { SituationMapView } from "./SituationMapView";

export type MapViewProps = ComponentProps<typeof SituationMapView>;

/**
 * Renders `SituationMapView` on a phone with the map shown, no panel open and
 * the panel switch shown; every action succeeds. `rerender(over)` changes some
 * props, such as the shown panel or whether the map is shown.
 */
export function renderMapView(over: Partial<MapViewProps> = {}) {
  const fake = fakeMapAdapterFactory();
  let props: MapViewProps = {
    operationId: "op-x",
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    onPlace: vi.fn(succeed),
    onMove: vi.fn(succeed),
    onUpdate: vi.fn(succeed),
    onDelete: vi.fn(succeed),
    onGenerateDeviceLink: vi.fn(succeed),
    onRemoveDeviceLink: vi.fn(succeed),
    onGeocode: vi.fn(async () => []),
    geocoderAttribution: "© OpenStreetMap",
    areas: [],
    onCreateArea: vi.fn(succeed),
    onUpdateAreaStyle: vi.fn(succeed),
    onUpdateAreaGeometry: vi.fn(succeed),
    onDeleteArea: vi.fn(succeed),
    kmlOverlays: [],
    onAddKmlFile: vi.fn(succeed),
    onAddKmlUrl: vi.fn(succeed),
    onSetKmlVisibility: vi.fn(succeed),
    onReloadKml: vi.fn(succeed),
    onRemoveKml: vi.fn(succeed),
    imageOverlays: [],
    onAddImage: vi.fn(succeed),
    onUpdateImagePlacement: vi.fn(succeed),
    onReplaceImage: vi.fn(succeed),
    onSetImageVisibility: vi.fn(succeed),
    onDeleteImage: vi.fn(succeed),
    factory: fake.factory,
    mapRef: createRef<SituationMapHandle>(),
    isDesktop: false,
    mapShown: true,
    shownPanel: null,
    panelSwitchShown: true,
    onSelectPanel: vi.fn(),
    onCloseSheet: vi.fn(),
    closeSheetOnPhone: vi.fn(),
    now: Date.now(),
    ...over,
  };
  const rendered = render(<SituationMapView {...props} />);
  const rerender = (next: Partial<MapViewProps>) => {
    props = { ...props, ...next };
    rendered.rerender(<SituationMapView {...props} />);
  };
  return {
    ...fake,
    get props() {
      return props;
    },
    rerender,
  };
}

export type RenderedMapView = ReturnType<typeof renderMapView>;

/** A server action that succeeds. */
export const succeed = async () => ({});

/** Taps the map at 50° N, 8° E once it has loaded. */
export async function tapMap({ captured }: RenderedMapView) {
  await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
  await act(async () => {
    captured.options?.onMapClick?.({ lat: 50, lng: 8 });
  });
}

/** Ends a gesture on the map that moves the edited Bild-Overlay to `placement`. */
export async function moveImageOnMap(
  { adapter }: RenderedMapView,
  placement: ImagePlacement,
) {
  const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)?.[1];
  await act(async () => (onChange as (p: ImagePlacement) => void)(placement));
}

/** Searches for `query` and chooses the result named `name`. */
export async function chooseSearchResult(query: string, name: RegExp) {
  fireEvent.change(screen.getByLabelText("Suche"), {
    target: { value: query },
  });
  await userEvent.click(await screen.findByRole("button", { name }));
}

/** Clicks the marker of the Kartenzeichen `id` on the map. */
export async function clickMarker({ adapter }: RenderedMapView, id: string) {
  await waitFor(() =>
    expect(adapter.setMarker).toHaveBeenCalledWith(id, expect.anything()),
  );
  const call = adapter.setMarker.mock.calls.findLast(([m]) => m === id);
  const spec = call?.[1] as MarkerSpec;
  act(() => spec.onClick?.());
}

/** Opens the detail of the Kartenzeichen `id` from its marker. */
export async function openSymbolDetail(view: RenderedMapView, id: string) {
  await clickMarker(view, id);
  await screen.findByRole("dialog", { name: "Kartenzeichen" });
}

/** Waits until the map has been set to `view`. */
export const jumpsTo = (
  { adapter }: RenderedMapView,
  view: { lat: number; lng: number; zoom: number },
) => waitFor(() => expect(adapter.setView).toHaveBeenLastCalledWith(view));

export const modeBand = (label: string) =>
  screen.getByRole("toolbar", { name: label });

export const noModeBand = () =>
  expect(screen.queryByRole("toolbar")).toBeNull();

export const INVALID = "Ungültige Zeichen-Komposition.";

export const button = (name: string | RegExp, container = document.body) =>
  within(container).getByRole("button", { name });
export const click = (name: string | RegExp, container?: HTMLElement) =>
  userEvent.click(button(name, container));
export const clickInBand = (band: string, name: string) =>
  click(name, modeBand(band));
export const confirm = async (name: string) =>
  click(name, await screen.findByRole("dialog", { name: /löschen|entfernen/ }));
/** Clicks `name`, then `confirmation` in the dialog that asks. */
export const clickAndConfirm = async (name: string, confirmation: string) => {
  await click(name);
  await confirm(confirmation);
};

/** An action in the view, and the prop it has to reach with its arguments. */
export type WiringCase = [
  name: string,
  props: Partial<MapViewProps>,
  perform: (view: RenderedMapView) => Promise<unknown>,
  action: keyof MapViewProps,
  args: unknown[],
];

export const armKtw = (view: RenderedMapView) => {
  view.rerender({ shownPanel: "symbols" });
  return click(/KTW/);
};

export const startDrawing = async (view: RenderedMapView) => {
  view.rerender({ shownPanel: "areas" });
  await click("Polygon");
  await waitFor(() => expect(view.adapter.startDrawing).toHaveBeenCalled());
};

export const openAreaEditor = async (view: RenderedMapView) => {
  view.rerender({ shownPanel: "areas" });
  await click("Deich bearbeiten");
  return within(await screen.findByRole("dialog"));
};

export const startMovingCircle = async (view: RenderedMapView) =>
  userEvent.click((await openAreaEditor(view)).getByText("Verschieben"));

export const startRedrawing = async (view: RenderedMapView) =>
  userEvent.click((await openAreaEditor(view)).getByText(/Form neu zeichnen/));

export const startEditingImage = async (view: RenderedMapView) => {
  view.rerender({ shownPanel: "layers" });
  await click("Bearbeiten");
  await waitFor(() =>
    expect(view.adapter.startImageOverlayEdit).toHaveBeenCalled(),
  );
};

export const hideAndShowMap = (view: RenderedMapView) => {
  view.rerender({ mapShown: false });
  view.rerender({ mapShown: true });
};

export const upload = (label: string, name: string) =>
  userEvent.upload(screen.getByLabelText(label), new File(["%PNG"], name));

/** Fails placing a Kartenzeichen once `enter` has started a mode. */
export async function failPlacingDuring(
  enter: (view: RenderedMapView) => Promise<unknown>,
) {
  let fail = () => {};
  const view = renderMapView({
    areas: [AREA],
    imageOverlays: [anImageOverlay],
    onPlace: vi.fn(
      () =>
        new Promise<{ error: string }>(
          (resolve) => (fail = () => resolve({ error: INVALID })),
        ),
    ),
  });
  await armKtw(view);
  await tapMap(view);
  await enter(view);
  await act(async () => fail());
  const notification = screen.getByRole("alert");
  expect(notification).toHaveTextContent(`Karte${INVALID}`);
  expect(notification.closest(".map-view")).toBeNull();
  return view;
}
