import { Anchor, Container, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { requireAdmin } from "@/server/auth/current-user";
import { listUsers } from "@/server/auth/users";
import { getDb } from "@/server/db/pg";
import {
  createAccountAction,
  deleteAccountAction,
  resetPasswordAction,
  setRoleAction,
} from "./actions";
import { type AccountSummary, UserAdminPanel } from "./UserAdminPanel";

export default async function UsersAdminPage() {
  await requireAdmin();
  const accounts: AccountSummary[] = (await listUsers(getDb())).map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
  }));

  return (
    <Container size="sm" py="lg">
      <Stack>
        <Anchor
          href="/operations"
          size="sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <IconArrowLeft size={16} />
          Einsätze
        </Anchor>
        <Title order={2}>Nutzerverwaltung</Title>
        <UserAdminPanel
          accounts={accounts}
          onCreate={createAccountAction}
          onSetRole={setRoleAction}
          onResetPassword={resetPasswordAction}
          onDelete={deleteAccountAction}
        />
      </Stack>
    </Container>
  );
}
