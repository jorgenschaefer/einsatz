import { Container } from "@mantine/core";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { listOperations } from "@/server/operations/operations";
import { logoutAction } from "../account/actions";
import {
  closeOperationAction,
  deleteOperationAction,
  reopenOperationAction,
} from "./[id]/lifecycle-actions";
import { createOperationAction } from "./actions";
import {
  type OperationSummary,
  OperationsOverview,
} from "./OperationsOverview";

export default async function OperationsPage() {
  await requireUser();
  const operations = await listOperations(getDb());
  const summaries: OperationSummary[] = operations.map((operation) => ({
    id: operation.id,
    name: operation.name,
    description: operation.description,
    status: operation.status,
  }));

  return (
    <Container py="lg">
      <OperationsOverview
        operations={summaries}
        createAction={createOperationAction}
        onCloseOperation={closeOperationAction}
        onReopenOperation={reopenOperationAction}
        onDeleteOperation={deleteOperationAction}
        onLogout={logoutAction}
      />
    </Container>
  );
}
