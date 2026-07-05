"use client";

import { Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import QRCode from "react-qr-code";

export interface ViewLinkItem {
  id: string;
  label: string;
  token: string;
}

export interface ViewLinkPanelProps {
  links: ViewLinkItem[];
  onCreate: (label: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

const viewUrl = (token: string): string => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/view/${token}`;
};

export function ViewLinkPanel({
  links,
  onCreate,
  onDelete,
}: ViewLinkPanelProps) {
  const [label, setLabel] = useState("");

  const create = async () => {
    await onCreate(label.trim());
    setLabel("");
  };

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput
          label="Bezeichnung"
          placeholder="z. B. Leitstelle"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button onClick={create}>Ansichtslink erzeugen</Button>
      </Group>

      {links.length === 0 ? (
        <Text size="sm" c="dimmed">
          Noch kein Ansichtslink. Bezeichnung eingeben und erzeugen, dann die
          URL oder den QR-Code an die Mitleser geben.
        </Text>
      ) : (
        <Stack gap="xs">
          {links.map((link) => (
            <ViewLinkRow key={link.id} link={link} onDelete={onDelete} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ViewLinkRow({
  link,
  onDelete,
}: {
  link: ViewLinkItem;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const name = link.label.trim() || "Ansichtslink";
  const url = viewUrl(link.token);

  return (
    <Box
      p="xs"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }} truncate>
          {name}
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="compact-xs"
            variant="subtle"
            aria-label={`${name} kopieren`}
            onClick={() => navigator.clipboard?.writeText(url)}
          >
            kopieren
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            aria-label={`${name} QR`}
            onClick={() => setQrOpen((v) => !v)}
          >
            QR
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            aria-label={`${name} löschen`}
            onClick={() => setConfirming(true)}
          >
            löschen
          </Button>
        </Group>
      </Group>

      {qrOpen && (
        <Group justify="center" mt="xs">
          <QRCode value={url} size={160} />
        </Group>
      )}

      {confirming && (
        <Group justify="flex-end" gap="xs" mt="xs">
          <Text size="sm" c="dimmed" style={{ flex: 1, minWidth: 0 }}>
            Zugang für diesen Link sofort beenden?
          </Text>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => setConfirming(false)}
          >
            Abbrechen
          </Button>
          <Button
            size="compact-xs"
            color="red"
            onClick={() => onDelete(link.id)}
          >
            Endgültig löschen
          </Button>
        </Group>
      )}
    </Box>
  );
}
