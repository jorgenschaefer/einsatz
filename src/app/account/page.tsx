import { Anchor, Button, Container, Group, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { requireUser } from "@/server/auth/current-user";
import { changePasswordAction, logoutAction } from "./actions";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Container size="sm" py="lg">
      <Stack>
        <Group justify="space-between">
          <Anchor
            href="/operations"
            size="sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <IconArrowLeft size={16} />
            Einsätze
          </Anchor>
          <form action={logoutAction}>
            <Button type="submit" variant="subtle" size="sm">
              Abmelden
            </Button>
          </form>
        </Group>
        <Title order={2}>Konto: {user.username}</Title>
        <ChangePasswordForm action={changePasswordAction} />
      </Stack>
    </Container>
  );
}
