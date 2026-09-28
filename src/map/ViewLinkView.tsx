"use client";

import {
  ReadOnlySituationMap,
  type ReadOnlySituationMapData,
  type ReadOnlySituationMapSeams,
} from "./ReadOnlySituationMap";
import { useMapFocus } from "./useMapFocus";

export type ViewLinkViewProps = ReadOnlySituationMapData &
  ReadOnlySituationMapSeams;

/** Die Lagekarte hinter einem Ansichtslink: nur lesen, keine Ortung. */
export function ViewLinkView(props: ViewLinkViewProps) {
  const focus = useMapFocus(props.operationDefaultView);
  return (
    <ReadOnlySituationMap
      {...props}
      basePath="/view"
      focus={focus}
      // Tap auf ein Zeichen zentriert die Karte, keine Navigation.
      onSelect={(target) => focus.jumpTo(target.lat, target.lng)}
      homeButtonBottom={104}
    />
  );
}
