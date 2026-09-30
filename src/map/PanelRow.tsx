import { ActionIcon, Group, Text, UnstyledButton } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * Eine Zeile im Kartenzeichen- bzw. Bereichs-Panel: ein Tap auf die Zeile
 * springt auf der Karte hin, der Stift öffnet die Bearbeitung.
 */
export function PanelRow({
  icon,
  name,
  meta,
  onJump,
  onEdit,
}: {
  icon: ReactNode;
  name: string;
  meta: ReactNode;
  onJump: () => void;
  onEdit: () => void;
}) {
  return (
    <Group gap="xs" wrap="nowrap" className="panel-row">
      <UnstyledButton
        p={6}
        onClick={onJump}
        style={{
          flex: 1,
          minWidth: 0,
          borderRadius: "var(--mantine-radius-sm)",
        }}
      >
        <Group gap="xs" wrap="nowrap">
          {icon}
          <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
            {name}
          </Text>
          {meta}
        </Group>
      </UnstyledButton>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={`${name} bearbeiten`}
        onClick={onEdit}
      >
        <IconPencil size={18} />
      </ActionIcon>
    </Group>
  );
}
