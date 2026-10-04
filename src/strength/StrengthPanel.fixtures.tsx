import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { render, screen, within } from "@/test/render";
import {
  StrengthPanel,
  type StrengthPanelProps,
  type StrengthReportView,
} from "./StrengthPanel";

const succeed = async (): Promise<ActionResult> => ({});

export function setup(over: Partial<StrengthPanelProps> = {}) {
  const props: StrengthPanelProps = {
    stations: [
      { id: "s1", name: "UHSt 3", reports: [] },
      { id: "s2", name: "Ziel", reports: [] },
    ],
    onCreateStation: vi.fn(succeed),
    onRenameStation: vi.fn(succeed),
    onRecordStrengthReport: vi.fn(succeed),
    onReportTotalStrength: vi.fn(succeed),
    onCorrectStrengthReport: vi.fn(succeed),
    onAnnulStrengthReport: vi.fn(succeed),
    now: minutesAfterReport(5),
    ...over,
  };
  const { rerender } = render(<StrengthPanel {...props} />);
  return {
    ...props,
    rerender: (next: Partial<StrengthPanelProps>) =>
      rerender(<StrengthPanel {...props} {...next} />),
  };
}

export const report = (
  over: Partial<StrengthReportView> = {},
): StrengthReportView => ({
  id: "r1",
  leaders: 0,
  subLeaders: 1,
  crew: 6,
  additionalPersonnel: 2,
  note: "2 einsatzbereite Streifen",
  // 11:01 in Berlin (Sommerzeit)
  reportedAt: "2026-09-26T09:01:00.000Z",
  state: "gueltig",
  number: 5,
  ...over,
});

/** Die Stärke „F/UF/E/G" in der Ansicht: G unterstrichen statt „//" davor. */
export const strength =
  (text: string) =>
  (_: string, element: Element | null): boolean =>
    element?.textContent === text &&
    element.lastElementChild?.tagName === "U" &&
    element.lastElementChild.textContent === text.split("/").at(-1);

/** Zeitpunkt `minutes` Minuten nach dem Standard-Meldezeitpunkt von {@link report}. */
export function minutesAfterReport(minutes: number) {
  return new Date("2026-09-26T09:01:00.000Z").getTime() + minutes * 60_000;
}

export const card = (name: string) =>
  screen.getByText(name).closest("[data-station]") as HTMLElement;

export async function openCreateField() {
  await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
  return screen.getByRole("textbox", { name: "Name der Stelle" });
}

export async function openRenameField(name: string) {
  await userEvent.click(
    within(card(name)).getByRole("button", { name: `${name} umbenennen` }),
  );
  return screen.getByRole("textbox", { name: "Neuer Name" });
}
