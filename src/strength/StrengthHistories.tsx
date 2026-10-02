"use client";

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Stack,
  Table,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { Fragment, useId } from "react";
import { StrengthFigures } from "./StrengthFigures";
import type { StationView, StrengthReportView } from "./StrengthPanel";
import {
  berlinTimeOfDay,
  type StrengthCounts,
  stationHistory,
  totalHistory,
  totalPersonsOf,
} from "./strength";

export function StationHistory({
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

export function TotalHistory({
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
        <StrengthFigures counts={counts} />
      </Table.Td>
      <Table.Td>{counts.additionalPersonnel}</Table.Td>
      <Table.Td>{totalPersonsOf(counts)}</Table.Td>
    </>
  );
}
