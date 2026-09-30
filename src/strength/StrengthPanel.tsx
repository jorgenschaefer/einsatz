"use client";

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Input,
  Menu,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import {
  type Dispatch,
  Fragment,
  type SetStateAction,
  useId,
  useState,
} from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import {
  berlinTimeOfDay,
  isReportStale,
  isTotalStale,
  latestValidReport,
  type StrengthCounts,
  type StrengthValues,
  stationHistory,
  sumOf,
  totalHistory,
  totalOf,
  totalPersonsOf,
} from "./strength";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

export interface StrengthReportView extends StrengthValues {
  id: string;
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
  onReportTotalStrength: () => Promise<ActionResult>;
  onCorrectStrengthReport: (
    reportId: string,
    stationId: string,
    values: StrengthValues,
  ) => Promise<ActionResult>;
  onAnnulStrengthReport: (reportId: string) => Promise<ActionResult>;
  /** Tickender Zeitstempel für die Veraltung der Meldungen. */
  now: number;
}

export function StrengthPanel({
  stations,
  onCreateStation,
  onRenameStation,
  onRecordStrengthReport,
  onReportTotalStrength,
  onCorrectStrengthReport,
  onAnnulStrengthReport,
  now,
}: StrengthPanelProps) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [showTotalHistory, setShowTotalHistory] = useState(false);
  const [correctingReportId, setCorrectingReportId] = useState<string | null>(
    null,
  );
  const [annulTarget, setAnnulTarget] = useState<StrengthReportView | null>(
    null,
  );
  const [annulConfirmationOpen, annulConfirmation] = useDisclosure(false);
  const [error, setError] = useState<string | null>(null);
  const selectedStation = stations.find((s) => s.id === selectedStationId);
  // Nur gültige: eine annullierte Meldung lässt sich nicht mehr korrigieren.
  const correctingReport =
    selectedStation &&
    stationHistory(selectedStation.reports).find(
      (r) => r.id === correctingReportId,
    );

  const save = (action: () => Promise<ActionResult>, done: () => void) =>
    runAction(action, setError, done);

  const closeForms = () => {
    setCreating(false);
    setRenamingId(null);
    setSelectedStationId(null);
    setShowTotalHistory(false);
    setCorrectingReportId(null);
    setError(null);
  };

  const openAnnulConfirmation = (report: StrengthReportView) => {
    setAnnulTarget(report);
    annulConfirmation.open();
  };

  const openReport = (stationId: string) => {
    closeForms();
    setSelectedStationId(stationId);
  };

  return (
    // Lange Wörter umbrechen statt waagerecht zu scrollen (360 px).
    <Stack style={{ overflowWrap: "break-word" }}>
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
        <>
          {correctingReport && (
            <CorrectionForm
              key={correctingReport.id}
              station={selectedStation}
              report={correctingReport}
              stations={stations}
              onCorrect={(stationId, values) =>
                save(
                  () =>
                    onCorrectStrengthReport(
                      correctingReport.id,
                      stationId,
                      values,
                    ),
                  () =>
                    closeIfStillOpen(
                      setCorrectingReportId,
                      correctingReport.id,
                    ),
                )
              }
              onCancel={() => {
                setCorrectingReportId(null);
                setError(null);
              }}
            />
          )}
          {/* Bleibt beim Korrigieren eingehängt: eine begonnene Meldung übersteht das Abbrechen. */}
          <Box display={correctingReport ? "none" : undefined}>
            <ReportForm
              key={prefillKey(latestValidReport(selectedStation.reports))}
              station={selectedStation}
              onReport={(values) =>
                save(
                  () => onRecordStrengthReport(selectedStation.id, values),
                  () =>
                    closeIfStillOpen(setSelectedStationId, selectedStation.id),
                )
              }
              onBack={closeForms}
            />
          </Box>
          <StationHistory
            station={selectedStation}
            onCorrect={(reportId) => {
              setCorrectingReportId(reportId);
              setError(null);
            }}
            onAnnul={openAnnulConfirmation}
          />
        </>
      ) : showTotalHistory ? (
        <TotalHistory stations={stations} onBack={closeForms} />
      ) : (
        <>
          {stations.length > 0 && (
            <TotalCard
              stations={stations}
              now={now}
              onReport={onReportTotalStrength}
              onShowHistory={() => {
                closeForms();
                setShowTotalHistory(true);
              }}
            />
          )}

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
                  onSubmit={(name) => onRenameStation(station.id, name)}
                  onSaved={() => closeIfStillOpen(setRenamingId, station.id)}
                  onCancel={closeForms}
                />
              ) : (
                <StationCard
                  station={station}
                  now={now}
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
                onSubmit={onCreateStation}
                onSaved={() => setCreating(false)}
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

      {annulTarget && (
        <ConfirmationModal
          opened={annulConfirmationOpen}
          onClose={annulConfirmation.close}
          title={`${selectedStation?.name} · Meldung ${berlinTimeOfDay(annulTarget.reportedAt)} (#${annulTarget.number}) annullieren`}
          confirmLabel="Annullieren"
          onConfirm={() => onAnnulStrengthReport(annulTarget.id)}
        >
          <Text>
            Die Meldung zählt nicht mehr und bleibt durchgestrichen im
            Einsatztagebuch stehen. Das lässt sich nicht rückgängig machen.
          </Text>
        </ConfirmationModal>
      )}
    </Stack>
  );
}

/** Führt die Action aus und zeigt ihren Fehler; nur bei Erfolg wird `done` aufgerufen. */
async function runAction(
  action: () => Promise<ActionResult>,
  setError: (error: string | null) => void,
  done: () => void,
) {
  try {
    const { error } = await action();
    setError(error ?? null);
    if (!error) done();
  } catch {
    setError(SAVE_ERROR);
  }
}

/** Ändert sich, sobald eine andere Meldung oder andere Werte als letzte gültige gelten. */
function prefillKey(latest: StrengthReportView | undefined) {
  return latest ? JSON.stringify([latest.id, valuesOf(latest)]) : "";
}

/** Eine Speicherung, die spät fertig wird, schließt nur ihr eigenes Formular. */
function closeIfStillOpen(
  setOpenId: Dispatch<SetStateAction<string | null>>,
  id: string,
) {
  setOpenId((openId) => (openId === id ? null : openId));
}

function TotalCard({
  stations,
  now,
  onReport,
  onShowHistory,
}: {
  stations: StationView[];
  now: number;
  onReport: () => Promise<ActionResult>;
  onShowHistory: () => void;
}) {
  const total = totalOf(stations.map((s) => s.reports));
  const hasValidReport = stations.some((s) => latestValidReport(s.reports));
  const [confirmationOpen, confirmation] = useDisclosure(false);
  const titleId = useId();

  return (
    <Paper component="section" aria-labelledby={titleId} withBorder p="sm">
      <ConfirmationModal
        opened={confirmationOpen}
        onClose={confirmation.close}
        title="Gesamtstärke melden"
        confirmLabel="Melden"
        confirmColor="blue"
        onConfirm={onReport}
      >
        <Counts counts={total} />
        <Text>
          Die Summe wird als Gesamtstärke ins Einsatztagebuch eingetragen.
        </Text>
      </ConfirmationModal>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Title id={titleId} order={3} size="h5">
            Summe
          </Title>
          {total.oldestReportedAt && (
            <ReportTime
              label="älteste Meldung "
              time={total.oldestReportedAt}
              stale={isTotalStale(total, now)}
            />
          )}
        </Group>
        <Counts counts={total} />
        <Group gap="xs">
          <Button disabled={!hasValidReport} onClick={confirmation.open}>
            Gesamtstärke melden
          </Button>
          <Button
            variant="default"
            disabled={!hasValidReport}
            onClick={onShowHistory}
          >
            Verlauf
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/** Uhrzeit einer Meldung; veraltete hervorgehoben. */
function ReportTime({
  label = "",
  time,
  stale,
}: {
  label?: string;
  time: Date | string;
  stale: boolean;
}) {
  return (
    <Text
      size="xs"
      c={stale ? "red" : "dimmed"}
      fw={stale ? 700 : undefined}
      data-stale={stale || undefined}
    >
      {`${label}${berlinTimeOfDay(time)}`}
    </Text>
  );
}

function Counts({ counts }: { counts: StrengthCounts }) {
  return (
    <Group gap="xs" align="baseline">
      <Text fw={700} size="lg">
        <Strength counts={counts} />
      </Text>
      <Text size="sm" c="dimmed">
        {`+${counts.additionalPersonnel} zusätzlich`}
      </Text>
      <Text size="sm" c="dimmed">
        {`${totalPersonsOf(counts)} Personen`}
      </Text>
    </Group>
  );
}

function StationCard({
  station,
  now,
  onRename,
}: {
  station: StationView;
  now: number;
  onRename: () => void;
}) {
  const latest = latestValidReport(station.reports);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap">
        <Title order={3} size="h5" miw={0} style={{ overflowWrap: "anywhere" }}>
          {/* Ohne eigenen Handler: der Klick (auch per Tastatur) erreicht die Karte. */}
          <UnstyledButton fw="inherit" fz="inherit">
            {station.name}
          </UnstyledButton>
        </Title>
        <Group gap="xs" wrap="nowrap">
          {latest && (
            <ReportTime
              time={latest.reportedAt}
              stale={isReportStale(latest, now)}
            />
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
          <Counts counts={latest} />
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

type Count = "leaders" | "subLeaders" | "crew" | "additionalPersonnel";

/** Neue Meldung einer Stelle, vorbelegt mit ihrer letzten gültigen Meldung. */
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
function CorrectionForm({
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

const valuesOf = (report: StrengthValues): StrengthValues => ({
  leaders: report.leaders,
  subLeaders: report.subLeaders,
  crew: report.crew,
  additionalPersonnel: report.additionalPersonnel,
  note: report.note,
});

function StationHistory({
  station,
  onCorrect,
  onAnnul,
}: {
  station: StationView;
  onCorrect: (reportId: string) => void;
  onAnnul: (report: StrengthReportView) => void;
}) {
  const history = stationHistory(station.reports);
  const titleId = useId();
  if (history.length === 0) return null;

  return (
    <Stack gap="xs">
      <Title id={titleId} order={4} size="h6">
        {`Verlauf ${station.name}`}
      </Title>
      <Table aria-labelledby={titleId} fz="sm" horizontalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <StrengthHeads />
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {history.map((report) => (
            <Fragment key={report.number}>
              <Table.Tr style={report.note ? { borderBottom: 0 } : undefined}>
                <StrengthCells reportedAt={report.reportedAt} counts={report} />
                <Table.Td>
                  {/* Kein Fokus zurück auf „⋯": Korrigieren fokussiert das Formular oben im Bereich. */}
                  <Menu position="bottom-end" withinPortal returnFocus={false}>
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Aktionen für Meldung ${berlinTimeOfDay(report.reportedAt)} (#${report.number})`}
                      >
                        ⋯
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => onCorrect(report.id)}>
                        Korrigieren
                      </Menu.Item>
                      <Menu.Item color="red" onClick={() => onAnnul(report)}>
                        Annullieren …
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
              {/* Eigene Zeile über die volle Breite, damit die Werte auf 360 px nebeneinander passen. */}
              {report.note && (
                <Table.Tr>
                  <Table.Td
                    colSpan={5}
                    pt={0}
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {report.note}
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function TotalHistory({
  stations,
  onBack,
}: {
  stations: StationView[];
  onBack: () => void;
}) {
  const history = totalHistory(stations.map((s) => s.reports));
  const titleId = useId();

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
        >
          Zurück
        </Button>
        <Title id={titleId} order={3} size="h5">
          Summenverlauf
        </Title>
      </Group>
      {history.length > 0 && (
        <Table aria-labelledby={titleId} fz="sm" horizontalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <StrengthHeads />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {history.map((row) => (
              <Table.Tr key={row.number}>
                <StrengthCells reportedAt={row.reportedAt} counts={row.total} />
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Die Spalten Zeit, F/UF/E/G, + und Pers. beider Verläufe. */
function StrengthHeads() {
  return (
    <>
      <Table.Th>Zeit</Table.Th>
      <Table.Th>
        F/UF/E/<u>G</u>
      </Table.Th>
      <Table.Th>+</Table.Th>
      <Table.Th>Pers.</Table.Th>
    </>
  );
}

function StrengthCells({
  reportedAt,
  counts,
}: {
  reportedAt: Date | string;
  counts: StrengthCounts;
}) {
  return (
    <>
      <Table.Td>{berlinTimeOfDay(reportedAt)}</Table.Td>
      <Table.Td>
        <Strength counts={counts} />
      </Table.Td>
      <Table.Td>{counts.additionalPersonnel}</Table.Td>
      <Table.Td>{totalPersonsOf(counts)}</Table.Td>
    </>
  );
}

/** Die Stärke F/UF/E/G in der Ansicht: G unterstrichen statt „//" davor. */
function Strength({ counts }: { counts: StrengthCounts }) {
  return (
    <>
      {`${counts.leaders}/${counts.subLeaders}/${counts.crew}/`}
      <u>{sumOf(counts)}</u>
    </>
  );
}

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

function NameForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onSaved,
  onCancel,
}: {
  label: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<ActionResult>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Am Feld statt oben im Bereich: auf dem Smartphone steht das Formular oft weit unten.
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await runAction(() => onSubmit(name), setError, onSaved);
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
          error={error}
          errorProps={{ role: "alert" }}
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
