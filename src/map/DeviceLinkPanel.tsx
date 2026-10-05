"use client";

import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import QRCode from "react-qr-code";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { ErrorAlert } from "@/app/ErrorAlert";
import { useActionRunner } from "@/app/useActionRunner";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import { useClipboardCopy } from "./useClipboardCopy";

export interface DeviceLinkPanelProps {
  token: string | null;
  positionSource: PositionSource;
  reportedAt: Date | null;
  onGenerate: () => Promise<ActionResult>;
  onRemove: () => Promise<ActionResult>;
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
  onRemove,
}: DeviceLinkPanelProps) {
  const { status: copyStatus, copy } = useClipboardCopy();
  const [askingToRegenerate, regenerateConfirmation] = useDisclosure(false);
  const [askingToRemove, removeConfirmation] = useDisclosure(false);
  const firstLink = useActionRunner();
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
            onClick={regenerateConfirmation.open}
          >
            Gerätelink neu generieren
          </Button>
          <ConfirmationModal
            stackId="geraetelink-neu-generieren"
            opened={askingToRegenerate}
            onClose={regenerateConfirmation.close}
            title="Gerätelink neu generieren"
            confirmLabel="Neu generieren"
            onConfirm={onGenerate}
          >
            Der bisherige Link funktioniert sofort nicht mehr. Das Gerät muss
            den neuen Link öffnen.
          </ConfirmationModal>
          <Button variant="light" color="red" onClick={removeConfirmation.open}>
            Gerätelink entfernen
          </Button>
          <ConfirmationModal
            stackId="geraetelink-entfernen"
            opened={askingToRemove}
            onClose={removeConfirmation.close}
            title="Gerätelink entfernen"
            confirmLabel="Entfernen"
            onConfirm={onRemove}
          >
            Der Link funktioniert sofort nicht mehr. Ein Gerät, das ihn offen
            hat, zeigt „Zugang beendet“.
          </ConfirmationModal>
        </>
      ) : (
        <>
          <Button
            variant="light"
            loading={firstLink.busy}
            onClick={() => firstLink.run(onGenerate)}
          >
            Gerätelink erzeugen
          </Button>
          <ErrorAlert
            error={firstLink.error}
            onClose={() => firstLink.setError(null)}
          />
        </>
      )}
    </Stack>
  );
}
