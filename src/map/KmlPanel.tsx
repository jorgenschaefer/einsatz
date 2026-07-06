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
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import { extractKml } from "@/server/kml/kmz";
import { ValidationError } from "@/server/validation";

export type { KmlSourceType };

export interface KmlOverlayView {
  id: string;
  name: string;
  sourceType: KmlSourceType;
  visible: boolean;
}

export interface KmlActionResult {
  error?: string;
}

export interface KmlPanelProps {
  overlays: KmlOverlayView[];
  onAddFile: (name: string, content: string) => Promise<KmlActionResult>;
  onAddUrl: (name: string, url: string) => Promise<KmlActionResult>;
  onToggleVisibility: (
    id: string,
    visible: boolean,
  ) => Promise<KmlActionResult>;
  onReload: (id: string) => Promise<KmlActionResult>;
  onRemove: (id: string) => Promise<KmlActionResult>;
}

export function KmlPanel({
  overlays,
  onAddFile,
  onAddUrl,
  onToggleVisibility,
  onReload,
  onRemove,
}: KmlPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const run = async (
    action: Promise<KmlActionResult>,
  ): Promise<KmlActionResult> => {
    setBusy(true);
    try {
      const result = await action;
      setError(result.error ?? null);
      return result;
    } finally {
      setBusy(false);
    }
  };

  const addUrl = async () => {
    const result = await run(onAddUrl(name.trim(), url.trim()));
    if (!result.error) {
      setName("");
      setUrl("");
    }
  };

  const addFile = async (file: File | null) => {
    if (!file) return;
    let content: string;
    try {
      // KMZ ist ein ZIP-Archiv – als Bytes lesen und (falls nötig) entpacken.
      content = extractKml(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      setError(
        err instanceof ValidationError
          ? err.message
          : "Die Datei konnte nicht gelesen werden.",
      );
      return;
    }
    await run(onAddFile(file.name, content));
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <input
        type="file"
        accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/xml,text/xml"
        aria-label="KML-/KMZ-Datei einbinden"
        onChange={(e) => {
          const input = e.currentTarget;
          void addFile(input.files?.[0] ?? null).finally(() => {
            input.value = ""; // gleiche Datei erneut auswählbar machen
          });
        }}
      />

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

      {overlays.length === 0 ? (
        <Text c="dimmed">
          Keine KML-Overlays. Binde eine Datei oder URL ein.
        </Text>
      ) : (
        <Stack gap="xs">
          {overlays.map((overlay) => (
            <Paper
              key={overlay.id}
              data-testid={`kml-${overlay.id}`}
              withBorder
              p="sm"
            >
              <Group justify="space-between" wrap="nowrap">
                <Switch
                  label={overlay.name}
                  checked={overlay.visible}
                  onChange={(e) =>
                    run(onToggleVisibility(overlay.id, e.currentTarget.checked))
                  }
                />
                <Group gap="xs" wrap="nowrap">
                  {overlay.sourceType === "url" && (
                    <Button
                      size="xs"
                      variant="light"
                      loading={busy}
                      onClick={() => run(onReload(overlay.id))}
                    >
                      Neu laden
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => run(onRemove(overlay.id))}
                  >
                    Entfernen
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
