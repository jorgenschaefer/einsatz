import { Container, Stack, Title } from "@mantine/core";
import { BackLink } from "@/app/BackLink";
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
        <BackLink href="/operations" label="Einsätze" />
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
