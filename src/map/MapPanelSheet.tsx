"use client";

import { Box, CloseButton, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { MAP_PANEL_LABEL, type MapPanel } from "./MapControls";

/**
 * Der Rahmen des Kartenpanels: Titel und Inhalt; am Handy ein Blatt über der
 * Karte mit Schließen-Knopf, am Desktop in der Seitenleiste ohne.
 */
export function MapPanelSheet({
  panel,
  onClose,
  children,
}: {
  panel: MapPanel;
  /** Fehlt am Desktop: dort bleibt das Panel stehen. */
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby="map-panel-title"
      className="map-panel"
    >
      <Group justify="space-between" wrap="nowrap" px="sm" py={6}>
        <Text id="map-panel-title" fw={600}>
          {MAP_PANEL_LABEL[panel]}
        </Text>
        {onClose && <CloseButton aria-label="Schließen" onClick={onClose} />}
      </Group>
      <Box className="map-panel__content" p="sm">
        {children}
      </Box>
    </Box>
  );
}
