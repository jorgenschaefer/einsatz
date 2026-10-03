"use client";

import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import type { ActionResult } from "@/app/action-result";
import { NewOperationForm, type OperationFormAction } from "./NewOperationForm";
import { OperationLifecycleActions } from "./OperationLifecycleActions";

export interface OperationSummary {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "closed";
}

const noop = async () => {};
const succeed = async (): Promise<ActionResult> => ({});

export function OperationsOverview({
  operations,
  createAction,
  onCloseOperation = succeed,
  onReopenOperation = succeed,
  onDeleteOperation = succeed,
  onLogout = noop,
  isAdmin = false,
}: {
  operations: OperationSummary[];
  createAction: OperationFormAction;
  onCloseOperation?: (operationId: string) => Promise<ActionResult>;
  onReopenOperation?: (operationId: string) => Promise<ActionResult>;
  onDeleteOperation?: (operationId: string) => Promise<ActionResult>;
  onLogout?: () => void | Promise<void>;
  isAdmin?: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Einsätze</Title>
        <Group gap="sm">
          {isAdmin && (
            <Anchor component={Link} href="/admin/users" size="sm">
              Nutzerverwaltung
            </Anchor>
          )}
          <Anchor component={Link} href="/account" size="sm">
            Konto
          </Anchor>
          <Button variant="subtle" size="sm" onClick={() => onLogout()}>
            Abmelden
          </Button>
          <Button onClick={open}>Neuer Einsatz</Button>
        </Group>
      </Group>

      {operations.length === 0 ? (
        <Text c="dimmed">Noch kein Einsatz. Eröffne den ersten.</Text>
      ) : (
        <Stack>
          {operations.map((operation) => (
            <Card key={operation.id} withBorder padding="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Anchor
                  component={Link}
                  href={`/operations/${operation.id}`}
                  underline="never"
                  c="inherit"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                    {operation.name}
                  </Text>
                  {operation.description && (
                    <Text
                      c="dimmed"
                      size="sm"
                      mt={2}
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {operation.description}
                    </Text>
                  )}
                </Anchor>
                <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                  <Badge
                    color={operation.status === "active" ? "green" : "gray"}
                  >
                    {operation.status === "active" ? "aktiv" : "abgeschlossen"}
                  </Badge>
                  <OperationLifecycleActions
                    name={operation.name}
                    status={operation.status}
                    isAdmin={isAdmin}
                    onClose={() => onCloseOperation(operation.id)}
                    onReopen={() => onReopenOperation(operation.id)}
                    onDelete={() => onDeleteOperation(operation.id)}
                  />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={opened} onClose={close} title="Neuen Einsatz eröffnen">
        <NewOperationForm action={createAction} />
      </Modal>
    </Stack>
  );
}
