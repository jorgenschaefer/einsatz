"use client";

import { Alert, Button, Group, Slider, Stack, Text } from "@mantine/core";
import { useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

export interface ImageOverlayEditorProps {
  /** Aktuelle Deckkraft (0–1). */
  opacity: number;
  onOpacityChange: (opacity: number) => void | Promise<void>;
  onReplace: (file: File) => void | Promise<void>;
  onDelete: () => Promise<ActionResult>;
  onDone: () => void;
  busy?: boolean;
  error?: string | null;
}

export function ImageOverlayEditor({
  opacity,
  onOpacityChange,
  onReplace,
  onDelete,
  onDone,
  busy = false,
  error = null,
}: ImageOverlayEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteAsked, setDeleteAsked] = useState(false);

  return (
    <Stack gap="xs" mt="xs">
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <Text size="xs" c="dimmed">
        Auf der Karte: Mittelpunkt-Griff zum Verschieben, Ecken zum Skalieren,
        roter Griff zum Drehen. Die Karte bleibt frei verschiebbar.
      </Text>

      <div>
        <Text size="sm" mb={4}>
          Deckkraft
        </Text>
        <Slider
          thumbLabel="Deckkraft"
          min={0}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          label={(v) => `${v}%`}
          onChangeEnd={(v) => onOpacityChange(v / 100)}
          disabled={busy}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,application/pdf,image/png"
        aria-label="Datei ersetzen"
        hidden
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = ""; // gleiche Datei erneut wählbar machen
          if (file) void onReplace(file);
        }}
      />

      <Group justify="space-between">
        <Button
          variant="light"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Datei ersetzen
        </Button>
        <Button onClick={onDone} disabled={busy}>
          Fertig
        </Button>
        <Button
          variant="light"
          color="red"
          onClick={() => setDeleteAsked(true)}
          loading={busy}
        >
          Löschen
        </Button>
      </Group>
      <ConfirmationModal
        opened={deleteAsked}
        onClose={() => setDeleteAsked(false)}
        title="Bild-Overlay löschen"
        confirmLabel="Endgültig löschen"
        onConfirm={onDelete}
      >
        Das Bild wird mit seiner Datei gelöscht. Das lässt sich nicht rückgängig
        machen.
      </ConfirmationModal>
    </Stack>
  );
}
