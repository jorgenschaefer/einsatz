"use client";

import { Button, Group, Paper, Text } from "@mantine/core";

/**
 * Shows the running map mode and ends it with one button, optionally preceded
 * by a button that confirms the work done in the mode. While `busy`, both are
 * disabled.
 */
export function ModeBand({
  label,
  confirm,
  actionLabel,
  onAction,
  busy = false,
}: {
  label: string;
  confirm?: { label: string; onClick: () => void };
  actionLabel: string;
  onAction: () => void;
  busy?: boolean;
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
        <Group gap="xs" wrap="nowrap">
          {confirm && (
            <Button
              size="compact-sm"
              variant="white"
              onClick={confirm.onClick}
              disabled={busy}
            >
              {confirm.label}
            </Button>
          )}
          <Button
            size="compact-sm"
            variant="white"
            onClick={onAction}
            disabled={busy}
          >
            {actionLabel}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
