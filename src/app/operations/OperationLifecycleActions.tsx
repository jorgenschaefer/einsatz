"use client";

import { ActionIcon, Menu, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

export interface OperationLifecycleActionsProps {
  name: string;
  status: "active" | "closed";
  isAdmin: boolean;
  onClose: () => Promise<ActionResult>;
  onReopen: () => Promise<ActionResult>;
  onDelete: () => Promise<ActionResult>;
}

export function OperationLifecycleActions({
  name,
  status,
  isAdmin,
  onClose,
  onReopen,
  onDelete,
}: OperationLifecycleActionsProps) {
  const [closeConfirmOpen, closeConfirm] = useDisclosure(false);
  const [deleteConfirmOpen, deleteConfirm] = useDisclosure(false);

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Einsatz-Aktionen"
          >
            ⋯
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {status === "active" ? (
            <Menu.Item onClick={closeConfirm.open}>Abschließen</Menu.Item>
          ) : (
            <Menu.Item onClick={() => onReopen()}>Wieder öffnen</Menu.Item>
          )}
          {isAdmin && status === "closed" && (
            <>
              <Menu.Divider />
              <Menu.Item color="red" onClick={deleteConfirm.open}>
                Einsatz löschen
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <ConfirmationModal
        opened={closeConfirmOpen}
        onClose={closeConfirm.close}
        title={`Einsatz „${name}“ abschließen`}
        confirmLabel="Abschließen"
        onConfirm={onClose}
      >
        <Text>
          Dabei werden alle Gerätelinks und Ansichtslinks dieses Einsatzes
          gelöscht. Sie funktionieren auch nach „Wieder öffnen“ nicht mehr.
        </Text>
      </ConfirmationModal>

      <ConfirmationModal
        opened={deleteConfirmOpen}
        onClose={deleteConfirm.close}
        title={`Einsatz „${name}“ löschen`}
        confirmLabel="Endgültig löschen"
        onConfirm={onDelete}
      >
        <Text>
          Dieser Einsatz wird mit seinem gesamten{" "}
          <strong>Einsatztagebuch</strong> und allen Kartenobjekten
          unwiderruflich gelöscht.
        </Text>
      </ConfirmationModal>
    </>
  );
}
