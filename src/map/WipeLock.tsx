"use client";

import { Box, Stack, Text } from "@mantine/core";
import { useState } from "react";

/**
 * Wisch-Sperre: ein Vollflächen-Overlay, das alle Berührungen abfängt, damit das
 * Handy in der Tasche keine Fehleingaben erzeugt. Ein Wisch-Schalter (bis zum
 * Ende ziehen) hebt die Sperre auf; die Ortung läuft darunter weiter.
 */
export function WipeLock({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState(0);

  return (
    <Box
      data-testid="wipe-lock-overlay"
      pos="fixed"
      inset={0}
      style={{
        zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        touchAction: "none",
      }}
      onTouchMove={(e) => e.preventDefault()}
    >
      <Stack h="100%" justify="flex-end" align="center" gap="sm" p="xl">
        <Text c="white" ta="center">
          Gesperrt – die Ortung läuft weiter.
        </Text>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          aria-label="Zum Entsperren wischen"
          style={{ width: "80%" }}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            setValue(next);
            if (next >= 100) onUnlock();
          }}
        />
        <Text c="white" size="sm">
          Zum Entsperren wischen →
        </Text>
      </Stack>
    </Box>
  );
}
