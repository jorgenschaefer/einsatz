import { Button, Container, Divider, Group, Stack, Title } from "@mantine/core";
import { BackLink } from "@/app/BackLink";
import { requireUser } from "@/server/auth/current-user";
import {
  changePasswordAction,
  logoutAction,
  logoutOtherSessionsAction,
} from "./actions";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { LogoutOtherSessions } from "./LogoutOtherSessions";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Container size="sm" py="lg">
      <Stack>
        <Group justify="space-between">
          <BackLink href="/operations" label="Einsätze" />
          <form action={logoutAction}>
            <Button type="submit" variant="subtle" size="sm">
              Abmelden
            </Button>
          </form>
        </Group>
        <Title order={2}>Konto: {user.username}</Title>
        <ChangePasswordForm action={changePasswordAction} />
        <Divider />
        <LogoutOtherSessions action={logoutOtherSessionsAction} />
      </Stack>
    </Container>
  );
}
