"use client";

import {
  Button,
  Group,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useId, useState } from "react";
import type { StationView, StrengthReportView } from "./StrengthPanel";
import {
  latestValidReport,
  type StrengthValues,
  sumOf,
  totalPersonsOf,
} from "./strength";
import { berlinTimeOfDay } from "./strength-total";

/** Neue Meldung einer Stelle, vorbelegt mit ihrer letzten gültigen Meldung. */
export function ReportForm({
  station,
  onReport,
  onBack,
}: {
  station: StationView;
  onReport: (values: StrengthValues) => Promise<void>;
  onBack: () => void;
}) {
  const latest = latestValidReport(station.reports);
  const { values, fields } = useStrengthFields(latest);
  const [busy, setBusy] = useState(false);

  const report = async (reported: StrengthValues) => {
    setBusy(true);
    try {
      await onReport(reported);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        report(values);
      }}
    >
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="subtle"
            size="xs"
            flex="none"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
          >
            Zurück
          </Button>
          <Title order={3} size="h5" miw={0}>
            {`${station.name} · neue Meldung`}
          </Title>
        </Group>
        {fields}
        <Group gap="xs">
          <Button type="submit" loading={busy}>
            Melden
          </Button>
          {latest && (
            <Button
              variant="default"
              disabled={busy}
              onClick={() => report(valuesOf(latest))}
            >
              Unverändert melden
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}

/** Korrigiert Stelle, Werte und Notiz einer Meldung; ihre Uhrzeit bleibt. */
export function CorrectionForm({
  station,
  report,
  stations,
  onCorrect,
  onCancel,
}: {
  station: StationView;
  report: StrengthReportView;
  stations: StationView[];
  onCorrect: (stationId: string, values: StrengthValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { values, fields } = useStrengthFields(report);
  const [stationId, setStationId] = useState(station.id);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onCorrect(stationId, values);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack gap="sm">
        <Title order={3} size="h5">
          {`${station.name} · Meldung ${berlinTimeOfDay(report.reportedAt)} korrigieren`}
        </Title>
        <NativeSelect
          label="Stelle"
          autoFocus
          value={stationId}
          onChange={(e) => setStationId(e.currentTarget.value)}
          data={stations.map((s) => ({ value: s.id, label: s.name }))}
        />
        {fields}
        <Group gap="xs">
          <Button type="submit" loading={busy}>
            Speichern
          </Button>
          <Button variant="subtle" onClick={onCancel}>
            Abbrechen
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

type Count = "leaders" | "subLeaders" | "crew" | "additionalPersonnel";

/** Eingaben für Führer, Unterführer, Einsatzkräfte, zusätzliches Personal und Notiz. */
function useStrengthFields(initial: StrengthValues | undefined) {
  const [counts, setCounts] = useState<Record<Count, string>>(() => ({
    leaders: String(initial?.leaders ?? 0),
    subLeaders: String(initial?.subLeaders ?? 0),
    crew: String(initial?.crew ?? 0),
    additionalPersonnel: String(initial?.additionalPersonnel ?? 0),
  }));
  const [note, setNote] = useState(initial?.note ?? "");

  const count = (field: Count) => Number(counts[field]);
  const values: StrengthValues = {
    leaders: count("leaders"),
    subLeaders: count("subLeaders"),
    crew: count("crew"),
    additionalPersonnel: count("additionalPersonnel"),
    note: note.trim() || null,
  };

  const countInput = (field: Count, label: string) => (
    <TextInput
      label={label}
      styles={ONE_LINE_LABEL}
      value={counts[field]}
      onChange={(e) => {
        const digits = e.currentTarget.value.replace(/\D/g, "");
        setCounts((c) => ({ ...c, [field]: digits }));
      }}
      onFocus={(e) => e.currentTarget.select()}
      inputMode="numeric"
      maxLength={4}
    />
  );

  const fields = (
    <>
      {/* Unterführer ist das längste Label; EK und G brauchen weniger Platz.
          Schlichtes 1fr (anders als SimpleGrids minmax(0, 1fr)) wird nie
          schmaler als das einzeilige Label: Diese Zeile kürzt nie mit „…". */}
      <SimpleGrid
        spacing="xs"
        style={{ gridTemplateColumns: "1fr 1.25fr 1fr 1fr" }}
      >
        {countInput("leaders", "Führer")}
        {countInput("subLeaders", "Unterführer")}
        {countInput("crew", "EK")}
        <Computed label="G" value={sumOf(values)} />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="xs">
        {countInput("additionalPersonnel", "Zusätzliches Personal")}
        <Computed label="Personen" value={totalPersonsOf(values)} />
      </SimpleGrid>
      <TextInput
        label="Notiz"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />
    </>
  );

  return { values, fields };
}

export const valuesOf = (report: StrengthValues): StrengthValues => ({
  leaders: report.leaders,
  subLeaders: report.subLeaders,
  crew: report.crew,
  additionalPersonnel: report.additionalPersonnel,
  note: report.note,
});

/**
 * Labels im Stärke-Raster bleiben einzeilig und enden bei Platzmangel mit „…"
 * (bei 320 px: „Zusätzliches Personal"), statt in die Nachbarspalte zu laufen
 * oder umzubrechen.
 */
const ONE_LINE_LABEL = {
  label: {
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
} as const;

function Computed({ label, value }: { label: string; value: number }) {
  const id = useId();
  // Input.Wrapper: dasselbe Label wie an den Eingabefeldern daneben.
  return (
    <Input.Wrapper label={label} id={id} styles={ONE_LINE_LABEL}>
      <Text component="output" id={id} display="block" fw={700} py={6}>
        {value}
      </Text>
    </Input.Wrapper>
  );
}
