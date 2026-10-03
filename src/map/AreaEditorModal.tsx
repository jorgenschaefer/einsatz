import { Modal } from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { AreaEditor } from "./AreaEditor";
import type { AreaGeometry, AreaStyle } from "./area";
import type { RenderedArea } from "./SituationMap";

interface AreaDialogProps {
  onClose: () => void;
  onUpdateAreaStyle: (id: string, style: AreaStyle) => Promise<ActionResult>;
  onUpdateAreaGeometry: (
    id: string,
    geometry: AreaGeometry,
  ) => Promise<ActionResult>;
  onDeleteArea: (id: string) => Promise<ActionResult>;
  onRedraw: (area: RenderedArea) => void;
  onMoveCircle: (area: RenderedArea) => void;
}

/**
 * Der Dialog „Bereich": Stil und Radius ändern, neu zeichnen, einen Kreis
 * verschieben, löschen. Offen, solange `area` gesetzt ist.
 */
export function AreaEditorModal({
  area,
  ...props
}: AreaDialogProps & { area: RenderedArea | null }) {
  return (
    <Modal.Stack>
      <Modal
        stackId="bereich"
        opened={area !== null}
        onClose={props.onClose}
        title="Bereich"
      >
        {area && <AreaDialogBody key={area.id} area={area} {...props} />}
      </Modal>
    </Modal.Stack>
  );
}

function AreaDialogBody({
  area,
  onClose,
  onUpdateAreaStyle,
  onUpdateAreaGeometry,
  onDeleteArea,
  onRedraw,
  onMoveCircle,
}: AreaDialogProps & { area: RenderedArea }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (style: AreaStyle, radius: number | undefined) => {
    setBusy(true);
    try {
      const result = await saveStyleAndRadius(style, radius);
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

  // The style goes first: the server rejects a bad colour or Beschriftung,
  // while the radius is already checked in the editor. The centre comes from
  // the latest `area`, so that a move made elsewhere while the editor was
  // open is not undone.
  const saveStyleAndRadius = async (
    style: AreaStyle,
    radius: number | undefined,
  ): Promise<ActionResult> => {
    const { error } = await onUpdateAreaStyle(area.id, style);
    if (error) return { error };
    if (radius === undefined || area.geometry.shape !== "circle") return {};
    return onUpdateAreaGeometry(area.id, {
      shape: "circle",
      center: area.geometry.center,
      radius,
    });
  };

  const deleteArea = async () => {
    const result = await onDeleteArea(area.id);
    if (!result.error) onClose();
    return result;
  };

  return (
    <AreaEditor
      initial={{ color: area.color, opacity: area.opacity, label: area.label }}
      radius={
        area.geometry.shape === "circle" ? area.geometry.radius : undefined
      }
      busy={busy}
      error={error}
      onSave={save}
      onRedraw={() => onRedraw(area)}
      onMove={
        area.geometry.shape === "circle" ? () => onMoveCircle(area) : undefined
      }
      onDelete={deleteArea}
    />
  );
}
