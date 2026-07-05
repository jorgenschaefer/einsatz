"use client";

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export interface OperationLifecycleActionsProps {
  status: "active" | "closed";
  onClose: () => void | Promise<void>;
  onReopen: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function OperationLifecycleActions({
  status,
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
          <Menu.Divider />
          <Menu.Item color="red" onClick={confirm.open}>
            Einsatz löschen
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={confirmOpen}
        onClose={confirm.close}
        title="Einsatz löschen"
      >
        <Stack>
          <Text>
            Dieser Einsatz wird mit seinem gesamten{" "}
            <strong>Einsatztagebuch</strong> und allen Kartenobjekten
            unwiderruflich gelöscht.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>
              Abbrechen
            </Button>
            <Button color="red" onClick={() => onDelete()}>
              Endgültig löschen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
