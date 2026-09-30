"use client";

import { ActionIcon, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconHomeEdit,
  IconMapPin,
  IconPolygon,
  IconStack2,
} from "@tabler/icons-react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

export type MapPanel = "symbols" | "areas" | "layers";

const PANELS: { panel: MapPanel; icon: typeof IconMapPin }[] = [
  { panel: "symbols", icon: IconMapPin },
  { panel: "areas", icon: IconPolygon },
  { panel: "layers", icon: IconStack2 },
];

export const MAP_PANEL_LABEL: Record<MapPanel, string> = {
  symbols: "Kartenzeichen",
  areas: "Bereiche",
  layers: "Ebenen",
};

/**
 * Die Spalte der Kartenknöpfe unten rechts: oben die drei Panel-Knöpfe, darunter
 * Standard-Ausschnitt festlegen (erst nach Rückfrage) und zurück dorthin.
 */
export function MapControls({
  openPanel,
  onSelectPanel,
  onSetDefault,
  onReturnToDefault,
  canReturnToDefault,
}: {
  openPanel: MapPanel | null;
  onSelectPanel: (panel: MapPanel) => void;
  onSetDefault: () => Promise<ActionResult>;
  onReturnToDefault: () => void;
  canReturnToDefault: boolean;
}) {
  const [confirmOpened, confirm] = useDisclosure(false);

  return (
    <Stack
      role="group"
      aria-label="Kartenknöpfe"
      gap={8}
      className="map-controls"
    >
      {PANELS.map(({ panel, icon: Icon }) => (
        <ActionIcon
          key={panel}
          variant={openPanel === panel ? "filled" : "default"}
          size="lg"
          aria-label={MAP_PANEL_LABEL[panel]}
          aria-pressed={openPanel === panel}
          onClick={() => onSelectPanel(panel)}
        >
          <Icon size={18} />
        </ActionIcon>
      ))}
      <Stack gap={8} mt={8} className="map-controls__view">
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Standard-Ausschnitt festlegen"
          onClick={confirm.open}
        >
          <IconHomeEdit size={18} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Zum Standard-Ausschnitt zurück"
          disabled={!canReturnToDefault}
          onClick={onReturnToDefault}
        >
          <IconHome size={18} />
        </ActionIcon>
      </Stack>
      <ConfirmationModal
        opened={confirmOpened}
        onClose={confirm.close}
        title="Standard-Ausschnitt festlegen"
        confirmLabel="Festlegen"
        onConfirm={onSetDefault}
      >
        <Text>
          Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses
          Einsatzes.
        </Text>
      </ConfirmationModal>
    </Stack>
  );
}
