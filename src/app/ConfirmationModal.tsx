"use client";

import { Alert, Button, Group, Modal, Stack } from "@mantine/core";
import { unstable_rethrow } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { ActionResult } from "@/app/action-result";

const FAILURE = "Das hat nicht geklappt. Bitte erneut versuchen.";

// Übliche Mindesthöhe für Touch; die Lageführung wird auch am Handy bedient.
const TAP_TARGET = { height: 44 };

/**
 * Bestätigt eine Action, bevor sie läuft; ihr Fehler erscheint im offenen
 * Dialog statt oben im Bereich, der oft weit weggescrollt ist. Bei Erfolg
 * schließt er sich. Der Bestätigungsknopf ist rot, weil fast jede Rückfrage
 * etwas Unwiderrufliches bestätigt; die übrigen setzen ausdrücklich Blau statt
 * der Primärfarbe DRK-Rot, damit Rot den zerstörerischen Aktionen vorbehalten
 * bleibt.
 */
export function ConfirmationModal({
  opened,
  onClose,
  title,
  confirmLabel,
  confirmColor = "red",
  onConfirm,
  stackId,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => Promise<ActionResult>;
  stackId?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    // Beim Ausblenden bleibt der Knopf noch klickbar.
    if (!opened) return;
    setPending(true);
    try {
      const result = await onConfirm();
      setError(result.error ?? null);
      if (!result.error) onClose();
    } catch (error) {
      // Die Navigation ist schon unterwegs; bis sie die Seite ersetzt, bleibt
      // der Knopf im Ladezustand, damit kein zweiter Tap die Action auslöst.
      if (isNextNavigation(error)) return;
      setError(FAILURE);
    }
    setPending(false);
  };

  return (
    <Modal stackId={stackId} opened={opened} onClose={close} title={title}>
      <Stack>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {children}
        <Group justify="flex-end">
          <Button
            variant="default"
            style={TAP_TARGET}
            disabled={pending}
            onClick={close}
          >
            Abbrechen
          </Button>
          <Button
            color={confirmColor}
            style={TAP_TARGET}
            loading={pending}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * Eine Server-Action, die `redirect` ruft, lehnt auf dem Client mit einem
 * Redirect-Fehler ab, nachdem der Router die Navigation angestoßen hat.
 * `unstable_rethrow` ist die öffentliche API, die ihn erkennt. Sie erkennt
 * auch `notFound`, `forbidden` und `unauthorized`; die navigieren aus einer
 * Server-Action aber nicht, der Dialog bliebe gesperrt. Bestätigte Actions
 * dürfen sie deshalb nicht rufen.
 */
function isNextNavigation(error: unknown): boolean {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}
