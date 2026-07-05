"use client";

import { Button, Group, Image } from "@mantine/core";

export interface QuickSelectButton {
  id: string;
  label: string;
  iconUrl: string;
}

export interface QuickSelectToolbarProps {
  items: QuickSelectButton[];
  armedId: string | null;
  onArm: (id: string | null) => void;
}

export function QuickSelectToolbar({
  items,
  armedId,
  onArm,
}: QuickSelectToolbarProps) {
  return (
    <Group gap="xs" wrap="wrap">
      {items.map((item) => {
        const armed = item.id === armedId;
        return (
          <Button
            key={item.id}
            size="xs"
            variant={armed ? "filled" : "default"}
            aria-pressed={armed}
            leftSection={<Image src={item.iconUrl} alt="" w={18} h={18} />}
            onClick={() => onArm(armed ? null : item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </Group>
  );
}
