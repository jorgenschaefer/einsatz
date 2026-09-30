"use client";

import { Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import QRCode from "react-qr-code";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { useClipboardCopy } from "./useClipboardCopy";

export interface ViewLinkItem {
  id: string;
  label: string;
  token: string;
}

export interface ViewLinkPanelProps {
  links: ViewLinkItem[];
  onCreate: (label: string) => void | Promise<void>;
  onDelete: (id: string) => Promise<ActionResult>;
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
  const [creating, setCreating] = useState(false);
  // Bleibt nach dem Schließen gesetzt, damit der Titel beim Ausblenden
  // stehen bleibt.
  const [deleteTarget, setDeleteTarget] = useState<ViewLinkItem | null>(null);
  const [deleteAsked, setDeleteAsked] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      await onCreate(label.trim());
      setLabel("");
    } finally {
      setCreating(false);
    }
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
        <Button onClick={create} loading={creating}>
          Ansichtslink erzeugen
        </Button>
      </Group>

      {links.length === 0 ? (
        <Text size="sm" c="dimmed">
          Noch kein Ansichtslink. Bezeichnung eingeben und erzeugen, dann die
          URL oder den QR-Code an die Mitleser geben.
        </Text>
      ) : (
        <Stack gap="xs">
          {links.map((link) => (
            <ViewLinkRow
              key={link.id}
              link={link}
              onAskDelete={() => {
                setDeleteTarget(link);
                setDeleteAsked(true);
              }}
            />
          ))}
        </Stack>
      )}

      <ConfirmationModal
        stackId="ansichtslink-loeschen"
        opened={deleteAsked}
        onClose={() => setDeleteAsked(false)}
        title={`Ansichtslink „${deleteTarget ? linkName(deleteTarget) : ""}“ löschen`}
        confirmLabel="Endgültig löschen"
        onConfirm={async () => (deleteTarget ? onDelete(deleteTarget.id) : {})}
      >
        Wer diesen Link hat, sieht die Lage sofort nicht mehr.
      </ConfirmationModal>
    </Stack>
  );
}

const linkName = (link: ViewLinkItem): string =>
  link.label.trim() || "Ansichtslink";

function ViewLinkRow({
  link,
  onAskDelete,
}: {
  link: ViewLinkItem;
  onAskDelete: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const { status: copyStatus, copy } = useClipboardCopy();
  const name = linkName(link);
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
            onClick={() => copy(url)}
          >
            {copyStatus === "copied" ? "kopiert" : "kopieren"}
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
            onClick={onAskDelete}
          >
            löschen
          </Button>
        </Group>
      </Group>

      {copyStatus === "failed" && (
        <Text
          size="xs"
          c="red"
          role="alert"
          mt="xs"
          style={{ userSelect: "all" }}
        >
          Kopieren nicht möglich – Link manuell kopieren: {url}
        </Text>
      )}

      {qrOpen && (
        <Group justify="center" mt="xs">
          <QRCode value={url} size={160} />
        </Group>
      )}
    </Box>
  );
}
