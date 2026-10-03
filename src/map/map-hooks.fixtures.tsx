import { vi } from "vitest";
import {
  type RunNotifyingAction,
  useNotifyingActionRunner,
} from "@/app/useNotifyingActionRunner";
import { Providers, renderHook } from "@/test/render";
import { SITUATION_MAP } from "./notification-sources";
import type { SituationMapHandle } from "./SituationMap";
import { type MapModeControls, useMapMode } from "./useMapMode";
import type { MapView } from "./view";

/** What `SituationMapView` hands each of its map hooks. */
export interface MapHookContext {
  mode: MapModeControls;
  runMapAction: RunNotifyingAction;
  closeSheetOnPhone: () => void;
}

/**
 * Renders a map hook as `SituationMapView` does: next to the real
 * `useMapMode` and the real runner of the Karte notification, under
 * `Providers`. `result.current` holds the `mode` and the hook's own `result`;
 * `rerender(props)` hands the hook new props, such as the next `areas`.
 */
export function renderMapHook<Props, Result>(
  useHook: (context: MapHookContext, props: Props) => Result,
  initialProps: Props,
) {
  const closeSheetOnPhone = vi.fn();
  const rendered = renderHook(
    (props: Props) => {
      const { run, closeError } = useNotifyingActionRunner(SITUATION_MAP);
      const mode = useMapMode({ onTransition: closeError });
      const result = useHook(
        { mode, runMapAction: run, closeSheetOnPhone },
        props,
      );
      return { mode, result };
    },
    { wrapper: Providers, initialProps },
  );
  return { ...rendered, closeSheetOnPhone };
}

/** A `mapRef` whose map shows `view`, or is not ready yet with `null`. */
export function aMapRef(view: MapView | null) {
  const map: SituationMapHandle = {
    getView: () => view,
    getViewExtent: () => null,
    restoreImagePlacement: vi.fn(),
  };
  return { current: map };
}
