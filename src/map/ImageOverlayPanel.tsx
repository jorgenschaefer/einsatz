"use client";

import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import type { ReactNode } from "react";
import { useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";

export interface ImageOverlayItem {
  id: string;
  name: string;
  visible: boolean;
}

export interface ImageOverlayPanelProps {
  overlays: ImageOverlayItem[];
  /** Overlay, das gerade bearbeitet wird (Inline-Steuerung aufgeklappt). */
  editingId?: string | null;
  onAdd: (file: File) => Promise<ActionResult>;
  onToggleVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onEdit: (id: string) => void;
  /** Rendert die Inline-Steuerung unter dem gerade bearbeiteten Overlay. */
  renderEditor?: (overlay: ImageOverlayItem) => ReactNode;
}

export function ImageOverlayPanel({
  overlays,
  editingId = null,
  onAdd,
  onToggleVisibility,
  onEdit,
  renderEditor,
}: ImageOverlayPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: Promise<ActionResult>): Promise<ActionResult> => {
    setBusy(true);
    try {
      const result = await action;
      setError(result.error ?? null);
      return result;
    } finally {
      setBusy(false);
    }
  };

  const add = (file: File | null) => {
    if (!file) return;
    void run(onAdd(file));
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <input
        type="file"
        accept=".pdf,.png,application/pdf,image/png"
        aria-label="Bild-Overlay einbinden"
        onChange={(e) => {
          const input = e.currentTarget;
          add(input.files?.[0] ?? null);
          input.value = ""; // gleiche Datei erneut auswählbar machen
        }}
      />

      {overlays.length === 0 ? (
        <Text c="dimmed">
          Keine Bild-Overlays. Lade einen Lageplan als PDF oder PNG hoch.
        </Text>
      ) : (
        <Stack gap="xs">
          {overlays.map((overlay) => {
            const editing = overlay.id === editingId;
            return (
              <Paper
                key={overlay.id}
                data-testid={`image-${overlay.id}`}
                withBorder
                p="sm"
              >
                <Group justify="space-between" wrap="nowrap">
                  <Switch
                    label={overlay.name}
                    checked={overlay.visible}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        onToggleVisibility(overlay.id, e.currentTarget.checked),
                      )
                    }
                  />
                  {!editing && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => onEdit(overlay.id)}
                    >
                      Bearbeiten
                    </Button>
                  )}
                </Group>
                {editing && renderEditor?.(overlay)}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
