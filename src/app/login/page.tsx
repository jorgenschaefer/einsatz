import { Anchor, Container, Group } from "@mantine/core";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { loginAction } from "./actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/operations");
  return (
    <Container size="xs">
      <LoginForm action={loginAction} />
      <Group justify="center" gap="md" mt="md">
        <Anchor href="/impressum" size="xs" c="dimmed">
          Impressum
        </Anchor>
        <Anchor href="/datenschutz" size="xs" c="dimmed">
          Datenschutzerklärung
        </Anchor>
      </Group>
    </Container>
  );
}
