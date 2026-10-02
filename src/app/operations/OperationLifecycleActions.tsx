"use client";

import { ActionIcon, Menu, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

export interface OperationLifecycleActionsProps {
  name: string;
  status: "active" | "closed";
  isAdmin: boolean;
  onClose: () => void | Promise<void>;
  onReopen: () => void | Promise<void>;
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
  const [confirmOpen, confirm] = useDisclosure(false);

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
            <Menu.Item onClick={() => onClose()}>Abschließen</Menu.Item>
          ) : (
            <Menu.Item onClick={() => onReopen()}>Wieder öffnen</Menu.Item>
          )}
          {isAdmin && status === "closed" && (
            <>
              <Menu.Divider />
              <Menu.Item color="red" onClick={confirm.open}>
                Einsatz löschen
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <ConfirmationModal
        opened={confirmOpen}
        onClose={confirm.close}
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
