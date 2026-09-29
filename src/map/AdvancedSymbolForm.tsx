"use client";

import { Button, Group, Image, Select, Stack, TextInput } from "@mantine/core";
import {
  einheiten,
  fachaufgaben,
  funktionen,
  grundzeichen,
  organisationen,
  symbole,
  verwaltungsstufen,
} from "@taktische-zeichen/core";
import { useState } from "react";
import {
  MAX_COMPOSITION_FIELD_LENGTH,
  type SymbolComposition,
} from "./composition";
import { renderSymbolDataUrl } from "./tactical-symbol";

export interface AdvancedSymbolFormProps {
  initial?: SymbolComposition;
  submitLabel: string;
  onSubmit: (composition: SymbolComposition) => void;
  busy?: boolean;
}

// Mantines Combobox hält die Optionen geschlossener Dropdowns sonst im DOM –
// bei sieben Achsen fast 200 Optionen, die das Öffnen des Formulars bremsen.
const comboboxProps = { keepMounted: false };

const options = (list: ReadonlyArray<{ id: string; label: string }>) =>
  list.map((x) => ({ value: x.id, label: x.label }));

// Progressive Offenlegung mit sinnvollen Defaults; übrige Achsen optional.
const DEFAULTS: SymbolComposition = {
  organisation: "hilfsorganisation",
  grundzeichen: "taktische-formation",
};

export function AdvancedSymbolForm({
  initial,
  submitLabel,
  onSubmit,
  busy = false,
}: AdvancedSymbolFormProps) {
  // Defaults nur beim Zusammensetzen (kein `initial`); beim Bearbeiten die
  // vorhandene Komposition unverändert übernehmen (keine Feldfarbe unterschieben).
  const [composition, setComposition] = useState<SymbolComposition>(
    initial ?? DEFAULTS,
  );

  const setAxis = (key: keyof SymbolComposition) => (value: string | null) =>
    setComposition((c) => ({ ...c, [key]: value ?? undefined }));

  return (
    <Stack>
      <Group justify="center">
        <Image
          alt="Vorschau"
          src={renderSymbolDataUrl(composition)}
          w={64}
          h={64}
          fit="contain"
        />
      </Group>
      <TextInput
        label="Bezeichnung"
        maxLength={MAX_COMPOSITION_FIELD_LENGTH}
        value={composition.text ?? ""}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setComposition((c) => ({ ...c, text: value || undefined }));
        }}
      />
      <Select
        comboboxProps={comboboxProps}
        label="Organisation"
        data={options(organisationen)}
        value={composition.organisation ?? null}
        onChange={setAxis("organisation")}
      />
      <Select
        comboboxProps={comboboxProps}
        label="Grundzeichen"
        data={options(grundzeichen)}
        value={composition.grundzeichen ?? null}
        onChange={setAxis("grundzeichen")}
        searchable
      />
      <Select
        comboboxProps={comboboxProps}
        label="Fachaufgabe"
        data={options(fachaufgaben)}
        value={composition.fachaufgabe ?? null}
        onChange={setAxis("fachaufgabe")}
        clearable
        searchable
      />
      <Select
        comboboxProps={comboboxProps}
        label="Größenordnung"
        data={options(einheiten)}
        value={composition.einheit ?? null}
        onChange={setAxis("einheit")}
        clearable
      />
      <Select
        comboboxProps={comboboxProps}
        label="Verwaltungsstufe"
        data={options(verwaltungsstufen)}
        value={composition.verwaltungsstufe ?? null}
        onChange={setAxis("verwaltungsstufe")}
        clearable
      />
      <Select
        comboboxProps={comboboxProps}
        label="Funktion"
        data={options(funktionen)}
        value={composition.funktion ?? null}
        onChange={setAxis("funktion")}
        clearable
      />
      <Select
        comboboxProps={comboboxProps}
        label="Symbol"
        data={options(symbole)}
        value={composition.symbol ?? null}
        onChange={setAxis("symbol")}
        clearable
        searchable
      />
      <Group justify="flex-end">
        <Button
          onClick={() => onSubmit(composition)}
          loading={busy}
          disabled={busy}
        >
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}
