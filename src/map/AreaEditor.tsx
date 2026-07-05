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
import type { AreaStyle } from "./area";

export interface AreaEditorProps {
  initial: AreaStyle;
  onSave: (style: AreaStyle) => void | Promise<void>;
  onRedraw: () => void;
  onDelete: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
}

export function AreaEditor({
  initial,
  onSave,
  onRedraw,
  onDelete,
  busy = false,
  error = null,
}: AreaEditorProps) {
  const [color, setColor] = useState(initial.color);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [label, setLabel] = useState(initial.label);

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
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
      <TextInput
        label="Beschriftung"
        value={label}
        onChange={(e) => setLabel(e.currentTarget.value)}
      />
      <Group justify="space-between">
        <Button
          onClick={() => onSave({ color, opacity, label })}
          loading={busy}
          disabled={busy}
        >
          Speichern
        </Button>
        <Button variant="light" onClick={onRedraw} disabled={busy}>
          Form neu zeichnen
        </Button>
        <Button
          variant="light"
          color="red"
          onClick={() => onDelete()}
          loading={busy}
        >
          Löschen
        </Button>
      </Group>
    </Stack>
  );
}
