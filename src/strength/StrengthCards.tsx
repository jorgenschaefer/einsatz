"use client";

import {
  ActionIcon,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPencil } from "@tabler/icons-react";
import { useId } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { StrengthFigures } from "./StrengthFigures";
import type { StationView } from "./StrengthPanel";
import {
  berlinTimeOfDay,
  latestValidReport,
  type StrengthCounts,
  totalPersonsOf,
} from "./strength";
import { isReportStale, isTotalStale, totalOf } from "./total";

export function TotalCard({
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

export function StationCard({
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
        <StrengthFigures counts={counts} />
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
