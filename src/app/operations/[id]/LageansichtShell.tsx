"use client";

import { Anchor, AppShell, Badge, Box, Group, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { ViewLinkItem } from "@/map/ViewLinkPanel";
import { ViewLinkShareButton } from "./ViewLinkShareButton";

const HEADER_HEIGHT = 56;

const noop = async () => {};

export function LageansichtShell({
  operationName,
  status,
  viewLinks = [],
  onCreateViewLink = noop,
  onDeleteViewLink = noop,
  children,
}: {
  operationName: string;
  status: "active" | "closed";
  viewLinks?: ViewLinkItem[];
  onCreateViewLink?: (label: string) => void | Promise<void>;
  onDeleteViewLink?: (id: string) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <AppShell header={{ height: HEADER_HEIGHT }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Anchor
              href="/operations"
              size="sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <IconArrowLeft size={16} />
              Einsätze
            </Anchor>
            <Title order={4}>{operationName}</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <ViewLinkShareButton
              links={viewLinks}
              onCreate={onCreateViewLink}
              onDelete={onDeleteViewLink}
            />
            <Badge color={status === "active" ? "green" : "gray"}>
              {status === "active" ? "aktiv" : "abgeschlossen"}
            </Badge>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Box h={`calc(100dvh - ${HEADER_HEIGHT}px)`}>{children}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
