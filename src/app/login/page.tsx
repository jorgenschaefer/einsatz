import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { loginAction } from "./actions";
import { LoginForm } from "./LoginForm";

// Impressum/Datenschutz liefert der globale AppFooter (Login ist keine
// Vollbild-Kartenseite); daher hier keine eigene Fußzeile mehr.
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/operations");
  return (
    <Container size="xs">
      <LoginForm action={loginAction} />
    </Container>
  );
}
