"use client";

import { Box, UnstyledButton } from "@mantine/core";

export type MapPanel = "symbols" | "areas" | "layers";

export const MAP_PANEL_LABEL: Record<MapPanel, string> = {
  symbols: "Kartenzeichen",
  areas: "Bereiche",
  layers: "Ebenen",
};

const PANELS: MapPanel[] = ["symbols", "areas", "layers"];

/**
 * Die Reihe Kartenzeichen | Bereiche | Ebenen unter „Lagekarte", direkt über
 * der Hauptansichten-Leiste; markiert ist das gezeigte Panel.
 */
export function MapPanelSwitch({
  shownPanel,
  onSelect,
}: {
  shownPanel: MapPanel | null;
  onSelect: (panel: MapPanel) => void;
}) {
  return (
    <Box role="group" aria-label="Kartenpanels" className="map-panel-switch">
      {PANELS.map((panel) => (
        <UnstyledButton
          key={panel}
          className="map-panel-switch__entry"
          aria-label={MAP_PANEL_LABEL[panel]}
          aria-pressed={shownPanel === panel}
          onClick={() => onSelect(panel)}
        >
          {MAP_PANEL_LABEL[panel]}
        </UnstyledButton>
      ))}
    </Box>
  );
}
