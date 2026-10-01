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
  const open = query.trim().length > 0;
  const nothing = objectResults.length === 0 && addressResults.length === 0;

  return (
    <Box pos="relative" w="100%">
      <TextInput
        aria-label="Suche"
        placeholder="Objekte und Adressen suchen …"
        value={query}
        onChange={(e) => onQueryChange(e.currentTarget.value)}
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
                    onClick={() => onChooseObject(result)}
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
                    onClick={() => onChooseAddress(hit)}
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
