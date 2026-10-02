"use client";

import "./situation-workspace.css";
import { Box } from "@mantine/core";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ActionResult } from "@/app/action-result";
import type { EntryContent } from "@/journal/entry-route";
import { type JournalEntryView, JournalPanel } from "@/journal/JournalPanel";
import type { OperationStatus } from "@/server/operations/operations";
import { type StationView, StrengthPanel } from "@/strength/StrengthPanel";
import type { StrengthValues } from "@/strength/strength";
import { LageansichtShell } from "./LageansichtShell";
import { MainViewBar } from "./MainViewBar";
import { closeLageansichtNotifications } from "./notification-sources";
import {
  SituationMapView,
  type SituationMapViewProps,
} from "./SituationMapView";
import { useMainView } from "./useMainView";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { ViewLinkItem } from "./ViewLinkPanel";

export interface SituationWorkspaceProps extends SituationMapViewProps {
  operationName: string;
  status: OperationStatus;
  /** Nutzername des angemeldeten Nutzers; eigene ETB-Einträge zählen nicht als neu. */
  currentUsername: string;
  viewLinks: ViewLinkItem[];
  onCreateViewLink: (label: string) => Promise<ActionResult>;
  onDeleteViewLink: (id: string) => Promise<ActionResult>;
  journalEntries: JournalEntryView[];
  /** Die Werte für Von und An eines neuen ETB-Eintrags und einer Korrektur. */
  correspondents: string[];
  onAddJournalEntry: (entry: EntryContent) => Promise<ActionResult>;
  onCorrectJournalEntry: (
    id: string,
    content: EntryContent,
  ) => Promise<ActionResult>;
  onAnnulJournalEntry: (id: string) => Promise<ActionResult>;
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
  /** Für Tests injizierbar; sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

export function SituationWorkspace({
  operationId,
  operationName,
  status,
  currentUsername,
  viewLinks,
  onCreateViewLink,
  onDeleteViewLink,
  journalEntries,
  correspondents,
  onAddJournalEntry,
  onCorrectJournalEntry,
  onAnnulJournalEntry,
  stations,
  onCreateStation,
  onRenameStation,
  onRecordStrengthReport,
  onReportTotalStrength,
  onCorrectStrengthReport,
  onAnnulStrengthReport,
  eventsHook = useOperationEvents,
  ...mapProps
}: SituationWorkspaceProps) {
  const router = useRouter();
  const { connected } = eventsHook(`/operations/${operationId}/events`, () =>
    router.refresh(),
  );
  useEffect(() => closeLageansichtNotifications, []);
  const {
    isDesktop,
    mainView,
    selectMainView,
    newEtbEntries,
    newEntryRef,
    mapShown,
    shownPanel,
    selectMapPanel,
    closeSheet,
    closeSheetOnPhone,
  } = useMainView({ journalEntries, currentUsername });
  const now = useStalenessClock();

  const mainViewBar = (
    <MainViewBar
      activeView={mainView}
      onSelect={selectMainView}
      newEtbEntries={newEtbEntries}
    />
  );

  return (
    <LageansichtShell
      operationName={operationName}
      status={status}
      viewLinks={viewLinks}
      onCreateViewLink={onCreateViewLink}
      onDeleteViewLink={onDeleteViewLink}
      navigation={mainViewBar}
      connected={connected}
    >
      <Box
        className="situation-workspace"
        data-layout={isDesktop === null ? "unknown" : undefined}
      >
        <SituationMapView
          {...mapProps}
          operationId={operationId}
          isDesktop={isDesktop}
          mapShown={mapShown}
          shownPanel={shownPanel}
          onSelectPanel={selectMapPanel}
          onCloseSheet={closeSheet}
          closeSheetOnPhone={closeSheetOnPhone}
          now={now}
        />

        <Box
          className="etb-pane"
          data-view="etb"
          style={{
            flex: 1,
            minHeight: 0,
            display: mainView === "etb" ? undefined : "none",
          }}
          py="sm"
        >
          <JournalPanel
            operationId={operationId}
            entries={journalEntries}
            correspondents={correspondents}
            onAdd={onAddJournalEntry}
            onCorrect={onCorrectJournalEntry}
            onAnnul={onAnnulJournalEntry}
            newEntryRef={newEntryRef}
            visible={mainView === "etb"}
          />
        </Box>

        <Box
          className="strength-pane"
          data-view="strength"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: mainView === "strength" ? undefined : "none",
          }}
          py="sm"
        >
          <StrengthPanel
            stations={stations}
            onCreateStation={onCreateStation}
            onRenameStation={onRenameStation}
            onRecordStrengthReport={onRecordStrengthReport}
            onReportTotalStrength={onReportTotalStrength}
            onCorrectStrengthReport={onCorrectStrengthReport}
            onAnnulStrengthReport={onAnnulStrengthReport}
            now={now}
          />
        </Box>

        <Box className="sidebar-bar">{mainViewBar}</Box>
      </Box>
    </LageansichtShell>
  );
}
