"use client";

import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import QRCode from "react-qr-code";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import { useClipboardCopy } from "./useClipboardCopy";

export interface DeviceLinkPanelProps {
  token: string | null;
  positionSource: PositionSource;
  reportedAt: Date | null;
  onGenerate: () => void;
  busy?: boolean;
}

const deviceUrl = (token: string): string => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/device/${token}`;
};

export function DeviceLinkPanel({
  token,
  positionSource,
  reportedAt,
  onGenerate,
  busy = false,
}: DeviceLinkPanelProps) {
  const { status: copyStatus, copy } = useClipboardCopy();
  const url = token ? deviceUrl(token) : "";

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        {positionSource === "device"
          ? "Positionsquelle: Live (Gerät)"
          : "Positionsquelle: manuell gesetzt"}
        {reportedAt &&
          ` – zuletzt gemeldet: ${reportedAt.toLocaleString("de-DE")}`}
      </Text>

      {token ? (
        <>
          <TextInput
            label="Gerätelink"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            rightSectionWidth={72}
            rightSection={
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => copy(url)}
              >
                {copyStatus === "copied" ? "kopiert" : "kopieren"}
              </Button>
            }
          />
          {copyStatus === "failed" && (
            <Text size="xs" c="red" role="alert">
              Kopieren nicht möglich – Link oben manuell auswählen.
            </Text>
          )}
          <Group justify="center">
            <QRCode value={url} size={160} />
          </Group>
          <Button
            variant="light"
            color="red"
            onClick={() => onGenerate()}
            loading={busy}
          >
            Gerätelink neu generieren
          </Button>
        </>
      ) : (
        <Button variant="light" onClick={() => onGenerate()} loading={busy}>
          Gerätelink erzeugen
        </Button>
      )}
    </Stack>
  );
}
