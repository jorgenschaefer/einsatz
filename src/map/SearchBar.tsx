"use client";

import {
  Box,
  Button,
  CloseButton,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { type FocusEvent, useRef, useState } from "react";
import type { GeoHit } from "@/server/geocoder/geocoder";
import { addressResultKey, type ObjectResult } from "./search";

export interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  objectResults: ObjectResult[];
  addressResults: GeoHit[];
  attribution: string;
  onChooseAddress: (hit: GeoHit) => void;
  onChooseObject: (result: ObjectResult) => void;
}

export function SearchBar({
  query,
  onQueryChange,
  objectResults,
  addressResults,
  attribution,
  onChooseAddress,
  onChooseObject,
}: SearchBarProps) {
  const [listOpen, setListOpen] = useState(false);
  const boxRef = useClickOutside<HTMLDivElement>(() => setListOpen(false));
  const fieldRef = useRef<HTMLInputElement>(null);
  const open = listOpen && query.trim().length > 0;
  const nothing = objectResults.length === 0 && addressResults.length === 0;

  return (
    <Box
      ref={boxRef}
      pos="relative"
      w="100%"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        fieldRef.current?.focus();
        setListOpen(false);
      }}
      onBlur={(e) => {
        if (focusLeaves(e)) setListOpen(false);
      }}
    >
      <TextInput
        ref={fieldRef}
        aria-label="Suche"
        placeholder="Objekte und Adressen suchen …"
        value={query}
        onChange={(e) => {
          setListOpen(true);
          onQueryChange(e.currentTarget.value);
        }}
        onFocus={() => setListOpen(true)}
        onClick={() => setListOpen(true)}
        rightSection={
          query ? (
            <CloseButton
              aria-label="Suche löschen"
              size="sm"
              onClick={() => onQueryChange("")}
            />
          ) : null
        }
      />
      {open && (
        <Paper
          withBorder
          shadow="md"
          p="xs"
          pos="absolute"
          top="100%"
          left={0}
          right={0}
          mt={4}
          style={{ zIndex: 600 }}
        >
          <Stack gap="xs">
            {objectResults.length > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600}>
                  Einsatzobjekte
                </Text>
                {objectResults.map((result) => (
                  <Button
                    key={result.id}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => {
                      setListOpen(false);
                      onChooseObject(result);
                    }}
                  >
                    {result.label}
                  </Button>
                ))}
              </Stack>
            )}
            {addressResults.length > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600}>
                  Adressen
                </Text>
                {addressResults.map((hit) => (
                  <Button
                    key={addressResultKey(hit)}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => {
                      setListOpen(false);
                      onChooseAddress(hit);
                    }}
                  >
                    {hit.label}
                  </Button>
                ))}
                <Text size="xs" c="dimmed">
                  {attribution}
                </Text>
              </Stack>
            )}
            {nothing && (
              <Text size="sm" c="dimmed">
                Keine Treffer.
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

/** Focus moved to an element outside field and list, e.g. by Tab. A click on
 * something unfocusable has no target here and is left to `useClickOutside`. */
function focusLeaves(e: FocusEvent<HTMLElement>): boolean {
  const next = e.relatedTarget;
  return next instanceof Node && !e.currentTarget.contains(next);
}
