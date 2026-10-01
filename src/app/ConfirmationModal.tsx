"use client";

import { Alert, Button, Group, Modal, Stack } from "@mantine/core";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ACTION_FAILED, isNextNavigation } from "@/app/action-failure";
import type { ActionResult } from "@/app/action-result";

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
  const returnFocus = useFocusReturnAfterExit(opened);

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
      setError(ACTION_FAILED);
    }
    setPending(false);
  };

  return (
    <Modal
      stackId={stackId}
      opened={opened}
      onClose={close}
      onExitTransitionEnd={returnFocus}
      title={title}
    >
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
            data-autofocus
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
 * Mantine gibt den Fokus im `Modal.Stack` nicht zurück: Wird der Dialog
 * darunter wieder oberster, fokussiert seine Fokusfalle ihr erstes Element.
 * Deshalb merkt sich die Rückfrage beim Öffnen das fokussierte Element und
 * fokussiert es nach dem Ausblenden wieder, also nach der Fokusfalle. Ist es
 * inzwischen weg, bekommt der Dialog, in dem es lag, den Fokus.
 */
function useFocusReturnAfterExit(opened: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const dialogBelow = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (opened && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
      dialogBelow.current = opener.current.closest('[role="dialog"]');
    }
  }, [opened]);

  return () => {
    const target = [opener.current, dialogBelow.current].find(
      (element) => element?.isConnected,
    );
    opener.current = null;
    dialogBelow.current = null;
    target?.focus({ preventScroll: true });
  };
}
