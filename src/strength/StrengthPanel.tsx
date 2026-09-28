"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import { type Dispatch, type SetStateAction, useId, useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import {
  latestValidReport,
  type StrengthValues,
  sumOf,
  totalPersonsOf,
} from "./strength";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

export interface StrengthReportView extends StrengthValues {
  reportedAt: string;
  state: "gueltig" | "annulliert";
  number: number;
}

export interface StationView {
  id: string;
  name: string;
  reports: StrengthReportView[];
}

export interface StrengthPanelProps {
  stations: StationView[];
  onCreateStation: (name: string) => Promise<ActionResult>;
  onRenameStation: (id: string, name: string) => Promise<ActionResult>;
  onRecordStrengthReport: (
    stationId: string,
    values: StrengthValues,
  ) => Promise<ActionResult>;
}

export function StrengthPanel({
  stations,
  onCreateStation,
  onRenameStation,
  onRecordStrengthReport,
}: StrengthPanelProps) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const selectedStation = stations.find((s) => s.id === selectedStationId);

  /** Führt die Action aus; nur bei Erfolg wird `done` aufgerufen. */
  const save = async (
    action: () => Promise<ActionResult>,
    done: () => void,
  ) => {
    try {
      const { error: err } = await action();
      setError(err ?? null);
      if (!err) done();
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const closeForms = () => {
    setCreating(false);
    setRenamingId(null);
    setSelectedStationId(null);
    setError(null);
  };

  const openReport = (stationId: string) => {
    closeForms();
    setSelectedStationId(stationId);
  };

  return (
    <Stack>
      {error && (
        <Alert
          color="red"
          role="alert"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}

      {selectedStation ? (
        <ReportForm
          station={selectedStation}
          onReport={(values) =>
            save(
              () => onRecordStrengthReport(selectedStation.id, values),
              () => closeIfStillOpen(setSelectedStationId, selectedStation.id),
            )
          }
          onBack={closeForms}
        />
      ) : (
        <>
          {stations.map((station) => (
            <Paper
              key={station.id}
              data-station
              withBorder
              p="sm"
              style={{
                cursor: renamingId === station.id ? undefined : "pointer",
              }}
              onClick={
                renamingId === station.id
                  ? undefined
                  : () => openReport(station.id)
              }
            >
              {renamingId === station.id ? (
                <NameForm
                  label="Neuer Name"
                  initial={station.name}
                  submitLabel="Speichern"
                  onSubmit={(name) =>
                    save(
                      () => onRenameStation(station.id, name),
                      () => closeIfStillOpen(setRenamingId, station.id),
                    )
                  }
                  onCancel={closeForms}
                />
              ) : (
                <StationCard
                  station={station}
                  onRename={() => {
                    closeForms();
                    setRenamingId(station.id);
                  }}
                />
              )}
            </Paper>
          ))}

          {creating ? (
            <Paper withBorder p="sm">
              <NameForm
                label="Name der Stelle"
                initial=""
                submitLabel="Anlegen"
                onSubmit={(name) =>
                  save(
                    () => onCreateStation(name),
                    () => setCreating(false),
                  )
                }
                onCancel={closeForms}
              />
            </Paper>
          ) : (
            <Button
              variant="default"
              w="fit-content"
              onClick={() => {
                closeForms();
                setCreating(true);
              }}
            >
              + Stelle
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}

/** Eine Speicherung, die spät fertig wird, schließt nur ihr eigenes Formular. */
function closeIfStillOpen(
  setOpenId: Dispatch<SetStateAction<string | null>>,
  id: string,
) {
  setOpenId((openId) => (openId === id ? null : openId));
}

function StationCard({
  station,
  onRename,
}: {
  station: StationView;
  onRename: () => void;
}) {
  const latest = latestValidReport(station.reports);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap">
        <Title order={3} size="h5">
          {/* Ohne eigenen Handler: der Klick (auch per Tastatur) erreicht die Karte. */}
          <UnstyledButton fw="inherit" fz="inherit">
            {station.name}
          </UnstyledButton>
        </Title>
        <Group gap="xs" wrap="nowrap">
          {latest && (
            <Text size="xs" c="dimmed">
              {berlinTimeOfDay(latest.reportedAt)}
            </Text>
          )}
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`${station.name} umbenennen`}
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <IconPencil size={16} />
          </ActionIcon>
        </Group>
      </Group>
      {latest ? (
        <>
          <Group gap="xs" align="baseline">
            <Text fw={700} size="lg">
              {`${latest.leaders}/${latest.subLeaders}/${latest.helpers}//${sumOf(latest)}`}
            </Text>
            <Text size="sm" c="dimmed">
              {`+${latest.additionalPersonnel} zusätzlich`}
            </Text>
            <Text size="sm" c="dimmed">
              {`${totalPersonsOf(latest)} Personen`}
            </Text>
          </Group>
          {latest.note && <Text size="sm">{latest.note}</Text>}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          noch keine Meldung
        </Text>
      )}
    </Stack>
  );
}

const berlinTimeOfDay = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

type Count = "leaders" | "subLeaders" | "helpers" | "additionalPersonnel";

/**
 * Neue Meldung einer Stelle. Vorbelegt wird einmal beim Öffnen; eine live
 * eintreffende Meldung überschreibt Getipptes nicht.
 */
function ReportForm({
  station,
  onReport,
  onBack,
}: {
  station: StationView;
  onReport: (values: StrengthValues) => Promise<void>;
  onBack: () => void;
}) {
  const latest = latestValidReport(station.reports);
  const [counts, setCounts] = useState<Record<Count, string>>(() => ({
    leaders: String(latest?.leaders ?? 0),
    subLeaders: String(latest?.subLeaders ?? 0),
    helpers: String(latest?.helpers ?? 0),
    additionalPersonnel: String(latest?.additionalPersonnel ?? 0),
  }));
  const [note, setNote] = useState(latest?.note ?? "");
  const [busy, setBusy] = useState(false);

  const count = (field: Count) => Number(counts[field]);
  const values: StrengthValues = {
    leaders: count("leaders"),
    subLeaders: count("subLeaders"),
    helpers: count("helpers"),
    additionalPersonnel: count("additionalPersonnel"),
    note: note.trim() || null,
  };

  const report = async (reported: StrengthValues) => {
    setBusy(true);
    try {
      await onReport(reported);
    } finally {
      setBusy(false);
    }
  };

  const countInput = (field: Count, label: string) => (
    <TextInput
      label={label}
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
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
          >
            Zurück
          </Button>
          <Title order={3} size="h5">
            {`${station.name} · neue Meldung`}
          </Title>
        </Group>
        <SimpleGrid cols={4} spacing="xs">
          {countInput("leaders", "Führer")}
          {countInput("subLeaders", "Unterführer")}
          {countInput("helpers", "Helfer")}
          <Computed label="Σ" value={sumOf(values)} />
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

const valuesOf = (report: StrengthValues): StrengthValues => ({
  leaders: report.leaders,
  subLeaders: report.subLeaders,
  helpers: report.helpers,
  additionalPersonnel: report.additionalPersonnel,
  note: report.note,
});

function Computed({ label, value }: { label: string; value: number }) {
  const id = useId();
  return (
    <Stack gap={0}>
      <Text id={id} size="sm" fw={500}>
        {label}
      </Text>
      <Text component="output" aria-labelledby={id} fw={700} py={6}>
        {value}
      </Text>
    </Stack>
  );
}

function NameForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(name);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack gap="xs">
        <TextInput
          label={label}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          autoFocus
        />
        <Group gap="xs">
          <Button type="submit" size="xs" loading={busy}>
            {submitLabel}
          </Button>
          <Button size="xs" variant="subtle" onClick={onCancel}>
            Abbrechen
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
