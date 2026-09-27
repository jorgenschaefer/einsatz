"use client";

import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Popover,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconWifiOff } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/app/BackLink";
import { useKeyboardOpen } from "@/map/useKeyboardOpen";
import { type ViewLinkItem, ViewLinkPanel } from "@/map/ViewLinkPanel";
import type { OperationStatus } from "@/server/operations/operations";

const HEADER_HEIGHT = { base: 40, sm: 56 };
const FOOTER_HEIGHT = 56;
const NAVBAR_WIDTH = 72;
const CONNECTION_LOST_LABEL =
  "Verbindung getrennt – wird automatisch wiederhergestellt";

const noop = async () => {};

function ConnectionIndicator() {
  return (
    <Popover position="bottom" withArrow>
      <Popover.Target>
        <ActionIcon
          color="orange"
          variant="light"
          aria-label={CONNECTION_LOST_LABEL}
        >
          <IconWifiOff size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm">{CONNECTION_LOST_LABEL}</Text>
      </Popover.Dropdown>
    </Popover>
  );
}

export function LageansichtShell({
  operationName,
  status,
  connected = true,
  viewLinks = [],
  onCreateViewLink = noop,
  onDeleteViewLink = noop,
  navigation = null,
  children,
}: {
  operationName: string;
  status: OperationStatus;
  /** Ist die Live-Verbindung getrennt, zeigt die Kopfzeile ein Symbol dafür. */
  connected?: boolean;
  viewLinks?: ViewLinkItem[];
  onCreateViewLink?: (label: string) => void | Promise<void>;
  onDeleteViewLink?: (id: string) => void | Promise<void>;
  /** Die Hauptansichten-Leiste: unten am Handy, links am Desktop. */
  navigation?: ReactNode;
  children: ReactNode;
}) {
  const [shareOpened, share] = useDisclosure(false);
  const keyboardOpen = useKeyboardOpen();
  const statusBadge = (
    <Badge color={status === "active" ? "green" : "gray"}>
      {status === "active" ? "aktiv" : "abgeschlossen"}
    </Badge>
  );

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      // Bei offener Bildschirmtastatur weicht die Leiste: „collapsed" gibt der
      // Hauptansicht die Höhe zurück; ausgehängt ist sie auch nicht mehr per
      // Tab erreichbar.
      footer={{
        height: { base: FOOTER_HEIGHT, sm: 0 },
        collapsed: keyboardOpen,
      }}
      navbar={{ width: { base: 0, sm: NAVBAR_WIDTH }, breakpoint: "sm" }}
      padding={0}
    >
      <AppShell.Header>
        <Group
          h="100%"
          px="md"
          justify="space-between"
          wrap="nowrap"
          visibleFrom="sm"
          data-testid="desktop-header"
        >
          <Group gap="sm" wrap="nowrap">
            <BackLink href="/operations" label="Einsätze" />
            <Title order={4}>{operationName}</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Button variant="light" size="sm" onClick={share.open}>
              Teilen
            </Button>
            {!connected && <ConnectionIndicator />}
            {statusBadge}
          </Group>
        </Group>

        <Group
          h="100%"
          px="sm"
          gap="xs"
          wrap="nowrap"
          hiddenFrom="sm"
          data-testid="mobile-header"
        >
          <Title order={4} style={{ flex: 1, minWidth: 0 }}>
            <Popover
              position="bottom-start"
              withArrow
              width={280}
              styles={{ dropdown: { maxWidth: "calc(100vw - 24px)" } }}
            >
              <Popover.Target>
                <UnstyledButton style={{ display: "block", width: "100%" }}>
                  <Text
                    size="sm"
                    fw={600}
                    truncate
                    component="span"
                    style={{ display: "block" }}
                  >
                    {operationName}
                  </Text>
                </UnstyledButton>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">{operationName}</Text>
              </Popover.Dropdown>
            </Popover>
          </Title>
          {!connected && <ConnectionIndicator />}
          {statusBadge}
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Menü">
                ⋮
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={share.open}>Teilen</Menu.Item>
              <Menu.Item component={Link} href="/operations">
                Zurück zu Einsätze
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar visibleFrom="sm">{navigation}</AppShell.Navbar>
      {!keyboardOpen && (
        <AppShell.Footer hiddenFrom="sm">{navigation}</AppShell.Footer>
      )}
      <AppShell.Main>
        <Box
          h={
            "calc(100dvh - var(--app-shell-header-offset, 0rem) - var(--app-shell-footer-offset, 0rem))"
          }
        >
          {children}
        </Box>
      </AppShell.Main>
      <Modal
        opened={shareOpened}
        onClose={share.close}
        title="Ansichtslinks teilen"
      >
        <ViewLinkPanel
          links={viewLinks}
          onCreate={onCreateViewLink}
          onDelete={onDeleteViewLink}
        />
      </Modal>
    </AppShell>
  );
}
