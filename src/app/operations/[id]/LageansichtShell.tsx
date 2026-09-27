"use client";

import { AppShell, Badge, Box, Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { BackLink } from "@/app/BackLink";
import type { ViewLinkItem } from "@/map/ViewLinkPanel";
import type { OperationStatus } from "@/server/operations/operations";
import { ViewLinkShareButton } from "./ViewLinkShareButton";

const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 56;
const NAVBAR_WIDTH = 72;

const noop = async () => {};

export function LageansichtShell({
  operationName,
  status,
  viewLinks = [],
  onCreateViewLink = noop,
  onDeleteViewLink = noop,
  navigation = null,
  children,
}: {
  operationName: string;
  status: OperationStatus;
  viewLinks?: ViewLinkItem[];
  onCreateViewLink?: (label: string) => void | Promise<void>;
  onDeleteViewLink?: (id: string) => void | Promise<void>;
  /** Die Hauptansichten-Leiste: unten am Handy, links am Desktop. */
  navigation?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      footer={{ height: { base: FOOTER_HEIGHT, sm: 0 } }}
      navbar={{ width: { base: 0, sm: NAVBAR_WIDTH }, breakpoint: "sm" }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <BackLink href="/operations" label="Einsätze" />
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
      <AppShell.Navbar visibleFrom="sm">{navigation}</AppShell.Navbar>
      <AppShell.Footer hiddenFrom="sm">{navigation}</AppShell.Footer>
      <AppShell.Main>
        <Box
          h={`calc(100dvh - ${HEADER_HEIGHT}px - var(--app-shell-footer-offset, 0rem))`}
        >
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
