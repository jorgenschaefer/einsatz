"use client";

import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
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
import { type ReactNode, useRef } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { HEADER_HEIGHT } from "@/map/lageansicht-sizes";
import { useKeyboardOpen } from "@/map/useKeyboardOpen";
import { type ViewLinkItem, ViewLinkPanel } from "@/map/ViewLinkPanel";
import type { OperationStatus } from "@/server/operations/operations";

const FOOTER_HEIGHT = 56;
const CONNECTION_LOST_LABEL =
  "Verbindung getrennt – wird automatisch wiederhergestellt";

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
  viewLinks,
  onCreateViewLink,
  onDeleteViewLink,
  onSetDefaultView,
  setDefaultViewDisabled,
  navigation = null,
  children,
}: {
  operationName: string;
  status: OperationStatus;
  /** Ist die Live-Verbindung getrennt, zeigt die Kopfzeile ein Symbol dafür. */
  connected?: boolean;
  viewLinks: ViewLinkItem[];
  onCreateViewLink: (label: string) => Promise<ActionResult>;
  onDeleteViewLink: (id: string) => Promise<ActionResult>;
  /** Macht den gerade gezeigten Kartenausschnitt zum Standard-Ausschnitt. */
  onSetDefaultView: () => Promise<ActionResult>;
  /** Am Handy unter ETB und Stärke: dann ist keine Karte zu sehen. */
  setDefaultViewDisabled: boolean;
  /** Die Hauptansichten-Leiste unten am Handy. */
  navigation?: ReactNode;
  children: ReactNode;
}) {
  const [shareOpened, share] = useDisclosure(false);
  const [setDefaultViewConfirmationOpened, setDefaultViewConfirmation] =
    useDisclosure(false);
  const keyboardOpen = useKeyboardOpen();
  // Der Menüeintrag, der einen Dialog geöffnet hat, ist beim Schließen schon
  // weg; den Fokus bekommt dann der ⋮-Knopf, über den er geöffnet wurde.
  const menuButton = useRef<HTMLButtonElement | null>(null);
  const focusMenuButton = () => menuButton.current?.focus();
  const statusBadge = (
    <Badge color={status === "active" ? "green" : "gray"}>
      {status === "active" ? "aktiv" : "abgeschlossen"}
    </Badge>
  );
  const menu = (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Menü"
          onClick={(event) => {
            menuButton.current = event.currentTarget;
          }}
        >
          ⋮
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={share.open}>Teilen</Menu.Item>
        <Menu.Item
          disabled={setDefaultViewDisabled}
          onClick={setDefaultViewConfirmation.open}
        >
          Standard-Ausschnitt festlegen
        </Menu.Item>
        <Menu.Item component={Link} href="/operations">
          Zurück zu Einsätze
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
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
          <Title order={4}>{operationName}</Title>
          <Group gap="sm" wrap="nowrap">
            {!connected && <ConnectionIndicator />}
            {statusBadge}
            {menu}
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
          {menu}
        </Group>
      </AppShell.Header>
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
      <Modal.Stack>
        <Modal
          stackId="ansichtslinks-teilen"
          opened={shareOpened}
          onClose={share.close}
          returnFocus={false}
          onExitTransitionEnd={focusMenuButton}
          title="Ansichtslinks teilen"
        >
          <ViewLinkPanel
            links={viewLinks}
            onCreate={onCreateViewLink}
            onDelete={onDeleteViewLink}
          />
        </Modal>
      </Modal.Stack>
      <ConfirmationModal
        opened={setDefaultViewConfirmationOpened}
        onClose={setDefaultViewConfirmation.close}
        title="Standard-Ausschnitt festlegen"
        confirmLabel="Festlegen"
        confirmColor="blue"
        onConfirm={onSetDefaultView}
        onExited={focusMenuButton}
      >
        <Text>
          Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses
          Einsatzes.
        </Text>
      </ConfirmationModal>
    </AppShell>
  );
}
