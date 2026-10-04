"use client";

import { Box, Button, Paper, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type Dispatch, type SetStateAction, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { ErrorAlert } from "@/app/ErrorAlert";
import { NameForm } from "./NameForm";
import { CorrectionForm, ReportForm, valuesOf } from "./ReportForms";
import { runAction } from "./run-action";
import { StationCard, TotalCard } from "./StrengthCards";
import { StationHistory, TotalHistory } from "./StrengthHistories";
import {
  berlinTimeOfDay,
  latestValidReport,
  type StrengthValues,
  stationHistory,
} from "./strength";

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
      <ErrorAlert error={error} onClose={() => setError(null)} />

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
