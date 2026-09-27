"use client";

import { ActionIcon, Alert, Button, Group, Modal, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconHomeEdit,
  IconMapPin,
  IconPolygon,
  IconStack2,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";

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
  onTogglePanel,
  onSetDefault,
  onReturnToDefault,
  canReturnToDefault,
}: {
  openPanel: MapPanel | null;
  onTogglePanel: (panel: MapPanel) => void;
  onSetDefault: () => Promise<ActionResult>;
  onReturnToDefault: () => void;
  canReturnToDefault: boolean;
}) {
  const [confirmOpened, confirm] = useDisclosure(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const askToSaveDefault = () => {
    setSaveError(null);
    confirm.open();
  };
  const saveDefault = async () => {
    setSaving(true);
    try {
      const { error } = await onSetDefault();
      if (error) {
        setSaveError(error);
        return;
      }
      confirm.close();
    } catch {
      setSaveError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  };

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
          onClick={() => onTogglePanel(panel)}
        >
          <Icon size={18} />
        </ActionIcon>
      ))}
      <Stack gap={8} mt={8} className="map-controls__view">
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Standard-Ausschnitt festlegen"
          onClick={askToSaveDefault}
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
      <Modal
        opened={confirmOpened}
        onClose={confirm.close}
        title="Aktuellen Ausschnitt als Standard festlegen?"
      >
        {saveError && (
          <Alert color="red" role="alert" mb="md">
            {saveError}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={confirm.close}>
            Abbrechen
          </Button>
          <Button loading={saving} onClick={saveDefault}>
            Festlegen
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
