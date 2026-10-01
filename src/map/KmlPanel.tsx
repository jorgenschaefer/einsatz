"use client";

import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { useActionRunner } from "@/app/useActionRunner";
import { extractKml } from "@/kml/kmz";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import { ValidationError } from "@/server/validation";
import { WRAPPING_SWITCH_LABEL } from "./wrapping-switch-label";

export interface KmlOverlayView {
  id: string;
  name: string;
  sourceType: KmlSourceType;
  visible: boolean;
}

export interface KmlPanelProps {
  overlays: KmlOverlayView[];
  onAddFile: (name: string, content: string) => Promise<ActionResult>;
  onAddUrl: (name: string, url: string) => Promise<ActionResult>;
  onToggleVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onReload: (id: string) => Promise<ActionResult>;
  onRemove: (id: string) => Promise<ActionResult>;
}

export function KmlPanel({
  overlays,
  onAddFile,
  onAddUrl,
  onToggleVisibility,
  onReload,
  onRemove,
}: KmlPanelProps) {
  const { busy, error, setError, run } = useActionRunner();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  // Bleibt nach dem Schließen gesetzt, damit der Titel beim Ausblenden
  // stehen bleibt.
  const [removeTarget, setRemoveTarget] = useState<KmlOverlayView | null>(null);
  const [removeAsked, setRemoveAsked] = useState(false);

  const addUrl = async () => {
    const result = await run(() => onAddUrl(name.trim(), url.trim()));
    if (result && !result.error) {
      setName("");
      setUrl("");
    }
  };

  const addFile = async (file: File | null) => {
    if (!file) return;
    await run(async () => {
      const read = await readKml(file);
      return "error" in read ? read : onAddFile(file.name, read.content);
    });
  };

  const remove = async (): Promise<ActionResult> => {
    if (!removeTarget) return {};
    const result = await onRemove(removeTarget.id);
    if (!result.error) setError(null);
    return result;
  };

  const overlayRow = (overlay: KmlOverlayView) => (
    <Paper key={overlay.id} data-testid={`kml-${overlay.id}`} withBorder p="sm">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Switch
          styles={WRAPPING_SWITCH_LABEL}
          style={{ flex: "1 1 auto", maxWidth: "100%" }}
          label={overlay.name}
          checked={overlay.visible}
          disabled={busy}
          onChange={(e) =>
            run(() => onToggleVisibility(overlay.id, e.currentTarget.checked))
          }
        />
        <Group gap="xs" wrap="nowrap" style={{ marginLeft: "auto" }}>
          {overlay.sourceType === "url" && (
            <Button
              size="xs"
              variant="light"
              loading={busy}
              onClick={() => run(() => onReload(overlay.id))}
            >
              Neu laden
            </Button>
          )}
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => {
              setError(null);
              setRemoveTarget(overlay);
              setRemoveAsked(true);
            }}
          >
            Entfernen
          </Button>
        </Group>
      </Group>
    </Paper>
  );

  const fileOverlays = overlays.filter((o) => o.sourceType === "file");
  const urlOverlays = overlays.filter((o) => o.sourceType === "url");

  return (
    <Stack>
      {error && (
        <Alert
          color="red"
          role="alert"
          withCloseButton
          closeButtonLabel="Meldung schließen"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Stack component="section" aria-labelledby="kml-file-heading" gap="xs">
        <Text id="kml-file-heading" fw={600} size="sm">
          KML-Datei
        </Text>
        <input
          type="file"
          accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/xml,text/xml"
          aria-label="KML-/KMZ-Datei einbinden"
          disabled={busy}
          onChange={(e) => {
            const input = e.currentTarget;
            void addFile(input.files?.[0] ?? null).finally(() => {
              input.value = ""; // gleiche Datei erneut auswählbar machen
            });
          }}
        />
        {fileOverlays.length === 0 ? (
          <Text c="dimmed" size="sm">
            Noch keine KML-Datei eingebunden.
          </Text>
        ) : (
          fileOverlays.map(overlayRow)
        )}
      </Stack>

      <Stack component="section" aria-labelledby="kml-url-heading" gap="xs">
        <Text id="kml-url-heading" fw={600} size="sm">
          KML-URL
        </Text>
        <Group align="flex-end" gap="xs">
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="KML-/KMZ-URL"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={addUrl} loading={busy} disabled={!url.trim()}>
            Per URL einbinden
          </Button>
        </Group>
        {urlOverlays.length === 0 ? (
          <Text c="dimmed" size="sm">
            Noch keine KML-URL eingebunden.
          </Text>
        ) : (
          urlOverlays.map(overlayRow)
        )}
      </Stack>

      <ConfirmationModal
        opened={removeAsked}
        onClose={() => setRemoveAsked(false)}
        title={`KML-Overlay „${removeTarget?.name}“ entfernen`}
        confirmLabel="Entfernen"
        onConfirm={remove}
      >
        Um es wieder anzuzeigen, muss die Datei oder URL neu eingebunden werden.
      </ConfirmationModal>
    </Stack>
  );
}

async function readKml(
  file: File,
): Promise<{ content: string } | { error: string }> {
  try {
    // KMZ ist ein ZIP-Archiv – als Bytes lesen und (falls nötig) entpacken.
    return { content: extractKml(new Uint8Array(await file.arrayBuffer())) };
  } catch (err) {
    return {
      error:
        err instanceof ValidationError
          ? err.message
          : "Die Datei konnte nicht gelesen werden.",
    };
  }
}
