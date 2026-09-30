import { Alert, Button, Modal, Stack } from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";
import type { SymbolComposition } from "./composition";
import { DeviceLinkPanel } from "./DeviceLinkPanel";
import type { WorkspaceSymbol } from "./SituationWorkspace";

interface SymbolDetailProps {
  onClose: () => void;
  onUpdate: (
    id: string,
    composition: SymbolComposition,
  ) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  onGenerateDeviceLink: (id: string) => Promise<ActionResult>;
}

/**
 * Der Dialog „Kartenzeichen": die Zusammensetzung ändern, das Kartenzeichen
 * löschen, den Gerätelink erzeugen. Offen, solange `symbol` gesetzt ist.
 */
export function SymbolDetailModal({
  symbol,
  ...props
}: SymbolDetailProps & { symbol: WorkspaceSymbol | null }) {
  return (
    <Modal.Stack>
      <Modal
        stackId="kartenzeichen"
        opened={symbol !== null}
        onClose={props.onClose}
        title="Kartenzeichen"
      >
        {symbol && <SymbolDetail symbol={symbol} {...props} />}
      </Modal>
    </Modal.Stack>
  );
}

function SymbolDetail({
  symbol,
  onClose,
  onUpdate,
  onDelete,
  onGenerateDeviceLink,
}: SymbolDetailProps & { symbol: WorkspaceSymbol }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteAsked, setDeleteAsked] = useState(false);

  const save = async (composition: SymbolComposition) => {
    setBusy(true);
    try {
      const result = await onUpdate(symbol.id, composition);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSymbol = async () => {
    const result = await onDelete(symbol.id);
    if (!result.error) onClose();
    return result;
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <AdvancedSymbolForm
        initial={symbol.composition}
        submitLabel="Speichern"
        busy={busy}
        onSubmit={save}
      />
      <Button
        color="red"
        variant="light"
        loading={busy}
        onClick={() => setDeleteAsked(true)}
      >
        Löschen
      </Button>
      <ConfirmationModal
        stackId="kartenzeichen-loeschen"
        opened={deleteAsked}
        onClose={() => setDeleteAsked(false)}
        title="Kartenzeichen löschen"
        confirmLabel="Endgültig löschen"
        onConfirm={deleteSymbol}
      >
        Das Kartenzeichen verschwindet von der Lagekarte, ein Gerätelink wird
        ungültig. Das lässt sich nicht rückgängig machen.
      </ConfirmationModal>
      <DeviceLinkPanel
        token={symbol.deviceLinkToken}
        positionSource={symbol.positionSource}
        reportedAt={symbol.reportedAt}
        onGenerate={() => onGenerateDeviceLink(symbol.id)}
      />
    </Stack>
  );
}
