"use client";

import { Button, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type ViewLinkItem, ViewLinkPanel } from "@/map/ViewLinkPanel";

export interface ViewLinkShareButtonProps {
  links: ViewLinkItem[];
  onCreate: (label: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export function ViewLinkShareButton({
  links,
  onCreate,
  onDelete,
}: ViewLinkShareButtonProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button variant="light" size="sm" onClick={open}>
        Teilen
      </Button>
      <Modal opened={opened} onClose={close} title="Ansichtslinks teilen">
        <ViewLinkPanel links={links} onCreate={onCreate} onDelete={onDelete} />
      </Modal>
    </>
  );
}
