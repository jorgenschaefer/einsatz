"use client";

import { Anchor } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

/** Zurück-Link mit vorangestelltem Pfeil-Icon, z. B. „← Einsätze". */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Anchor
      component={Link}
      href={href}
      size="sm"
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <IconArrowLeft size={16} aria-hidden />
      {label}
    </Anchor>
  );
}
