"use client";

import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import type { AreaStyle } from "./area";

export interface AreaEditorProps {
  initial: AreaStyle;
  radius?: number;
  /** `radius` only when the user changed it from the value at open. */
  onSave: (
    style: AreaStyle,
    radius: number | undefined,
  ) => void | Promise<void>;
  onRedraw: () => void;
  /** Only for circles: moves the circle under the map's crosshair. */
  onMove?: () => void;
  onDelete: () => Promise<ActionResult>;
  busy?: boolean;
  error?: string | null;
}

export function AreaEditor({
  initial,
  radius: initialRadius,
  onSave,
  onRedraw,
  onMove,
  onDelete,
  busy = false,
  error = null,
}: AreaEditorProps) {
  const [color, setColor] = useState(initial.color);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [label, setLabel] = useState(initial.label);
  // The prop follows live updates; the field is compared against the value at
  // open so that a radius changed elsewhere meanwhile is not overwritten.
  const [radiusAtOpen] = useState(initialRadius);
  const [radius, setRadius] = useState<string | number>(radiusAtOpen ?? "");
  const [radiusError, setRadiusError] = useState<string | null>(null);
  const [deleteAsked, setDeleteAsked] = useState(false);

  const save = () => {
    const style = { color, opacity, label };
    // NumberInput reports partial input such as "250," as the string "250.".
    const value = Number(radius);
    if (radiusAtOpen === undefined || value === radiusAtOpen) {
      setRadiusError(null);
      return onSave(style, undefined);
    }
    if (!Number.isFinite(value) || value <= 0) {
      setRadiusError("Der Radius muss größer als 0 sein.");
      return;
    }
    setRadiusError(null);
    return onSave(style, value);
  };

  const shownError = radiusError ?? error;

  return (
    <Stack>
      {shownError && (
        <Alert color="red" role="alert">
          {shownError}
        </Alert>
      )}
      <TextInput
        label="Farbe (Hex)"
        value={color}
        onChange={(e) => setColor(e.currentTarget.value)}
      />
      <NumberInput
        label="Deckkraft"
        value={opacity}
        onChange={(v) => setOpacity(typeof v === "number" ? v : Number(v) || 0)}
        min={0}
        max={1}
        step={0.1}
        decimalScale={2}
      />
      {initialRadius !== undefined && (
        <NumberInput
          label="Radius"
          value={radius}
          onChange={setRadius}
          decimalSeparator=","
          suffix=" m"
        />
      )}
      <TextInput
        label="Beschriftung"
        value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
      />
      <Group justify="space-between">
        <Button onClick={save} loading={busy} disabled={busy}>
          Speichern
        </Button>
        <Button variant="light" onClick={onRedraw} disabled={busy}>
          Form neu zeichnen
        </Button>
        {onMove && (
          <Button variant="light" onClick={onMove} disabled={busy}>
            Verschieben
          </Button>
        )}
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
        stackId="bereich-loeschen"
        opened={deleteAsked}
        onClose={() => setDeleteAsked(false)}
        title="Bereich löschen"
        confirmLabel="Endgültig löschen"
        confirmColor="red"
        onConfirm={onDelete}
      >
        Der Bereich verschwindet von der Lagekarte. Das lässt sich nicht
        rückgängig machen.
      </ConfirmationModal>
    </Stack>
  );
}
