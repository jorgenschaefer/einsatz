"use client";

import { Anchor, AppShell, Badge, Box, Group, Title } from "@mantine/core";
import type { ReactNode } from "react";

const HEADER_HEIGHT = 56;

export function LageansichtShell({
  operationName,
  status,
  children,
}: {
  operationName: string;
  status: "active" | "closed";
  children: ReactNode;
}) {
  return (
    <AppShell header={{ height: HEADER_HEIGHT }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Anchor href="/operations" size="sm">
              ← Einsätze
            </Anchor>
            <Title order={4}>{operationName}</Title>
          </Group>
          <Badge color={status === "active" ? "green" : "gray"}>
            {status === "active" ? "aktiv" : "abgeschlossen"}
          </Badge>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Box h={`calc(100dvh - ${HEADER_HEIGHT}px)`}>{children}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
