"use client";

import { Button, Group, Paper, Text } from "@mantine/core";

/** Zeigt den laufenden Karten-Modus und beendet ihn mit genau einem Knopf. */
export function ModeBand({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Paper
      role="toolbar"
      aria-label={label}
      shadow="md"
      radius="sm"
      px="sm"
      py={6}
      bg="var(--mantine-primary-color-filled)"
      c="white"
    >
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Text size="sm" fw={600} truncate>
          {label}
        </Text>
        <Button size="compact-sm" variant="white" onClick={onAction}>
          {actionLabel}
        </Button>
      </Group>
    </Paper>
  );
}
