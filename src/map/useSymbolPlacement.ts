"use client";

import { useDisclosure } from "@mantine/hooks";
import type { ActionResult } from "@/app/action-result";
import type { RunNotifyingAction } from "@/app/useNotifyingActionRunner";
import type { SymbolComposition } from "./composition";
import { QUICK_SELECT } from "./quick-select";
import type { MapModeControls } from "./useMapMode";

/**
 * Das Platzieren eines Kartenzeichens: aus der Schnellauswahl, über
 * „Erweitert …" oder als Kopie eines platzierten scharf schalten, dann mit
 * einem Kartenklick setzen.
 */
export function useSymbolPlacement({
  mode,
  runMapAction,
  closeSheetOnPhone,
  onPlace,
}: {
  mode: Pick<
    MapModeControls,
    "armedQuickId" | "armedCustom" | "armQuick" | "armCustom" | "reset"
  >;
  runMapAction: RunNotifyingAction;
  closeSheetOnPhone: () => void;
  onPlace: (
    composition: SymbolComposition,
    lat: number,
    lng: number,
  ) => Promise<ActionResult>;
}) {
  const [advancedOpened, advanced] = useDisclosure(false);
  const armedComposition =
    mode.armedCustom ??
    QUICK_SELECT.find((i) => i.id === mode.armedQuickId)?.composition ??
    null;

  const armQuickSymbol = (quickId: string | null) => {
    mode.armQuick(quickId);
    if (quickId) closeSheetOnPhone();
  };
  const armAdvanced = (composition: SymbolComposition) => {
    mode.armCustom(composition);
    advanced.close();
    closeSheetOnPhone();
  };
  // Die Kopie bekommt dieselbe Komposition, aber keine Bezeichnung: sie ist ein
  // weiteres Zeichen derselben Art, nicht dasselbe.
  const copySymbol = ({ text: _text, ...composition }: SymbolComposition) => {
    mode.armCustom(composition);
    closeSheetOnPhone();
  };
  // Wie bei Bild: nach einer Platzierung den Modus beenden, sonst platziert
  // jeder weitere Kartenklick unaufhörlich weiter (kein Abbruch möglich). Der
  // Reset läuft vor dem (evtl. langsamen) Server-Roundtrip, damit ein zweiter
  // Tap währenddessen kein zweites Zeichen platziert.
  const placeSymbolAt = async (
    composition: SymbolComposition,
    lat: number,
    lng: number,
  ) => {
    mode.reset();
    await runMapAction(() => onPlace(composition, lat, lng));
  };

  return {
    armedComposition,
    advancedOpened,
    openAdvanced: advanced.open,
    closeAdvanced: advanced.close,
    armQuickSymbol,
    armAdvanced,
    copySymbol,
    placeSymbolAt,
  };
}
