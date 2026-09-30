import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import {
  act,
  fireEvent,
  Providers,
  render,
  routerRefresh,
  screen,
  within,
} from "@/test/render";
import { stubVisualViewport } from "@/test/visual-viewport";
import { SituationWorkspace } from "./SituationWorkspace";
import {
  buildProps,
  footerOffsetReleased,
  journalEntry,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  it("renders the operation name and Teilen in the header", () => {
    renderWorkspace({ operationName: "Cyclassics 2026" });
    expect(
      within(screen.getByTestId("desktop-header")).getByRole("heading", {
        name: "Cyclassics 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Teilen/i)).toBeInTheDocument();
  });

  describe.each([
    ["on a phone", false],
    ["on the desktop", true],
  ])("counting new ETB entries %s", (_, desktop) => {
    beforeEach(() => {
      stubMatchMedia(desktop);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Der ETB-Punkt der sichtbaren Leiste; sein Name trägt die Zahl neuer Einträge. */
    const etbItem = () =>
      within(screen.getByRole(desktop ? "main" : "contentinfo"))
        .getByText("ETB")
        .closest("button");

    it("counts a new entry from another author while the Lagekarte is shown", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[
            journalEntry(1, null),
            journalEntry(2, "ben"),
            journalEntry(3, null),
          ]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB 2 neue Einträge");
    });

    it("counts a new entry from another author while Stärke is shown", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Stärke");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB 1 neuer Eintrag");
    });

    it.each([
      ["Lagekarte", "Stärke"],
      ["Stärke", "Lagekarte"],
    ] as const)(
      "keeps the count when switching from %s to %s",
      async (from, to) => {
        const { props } = buildProps({
          journalEntries: [journalEntry(1, null)],
        });
        const { rerender } = render(<SituationWorkspace {...props} />);
        await selectMainView(from);
        rerender(
          <SituationWorkspace
            {...props}
            journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
          />,
        );

        await selectMainView(to);

        expect(etbItem()).toHaveAccessibleName("ETB 1 neuer Eintrag");
      },
    );

    it("does not count own entries", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "anna")]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB");
    });

    it("resets when switching to the ETB", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");
      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );

      await selectMainView("ETB");
      expect(etbItem()).toHaveAccessibleName("ETB");

      await selectMainView("Lagekarte");
      expect(etbItem()).toHaveAccessibleName("ETB");
    });

    it("treats entries arriving while the ETB is shown as seen", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );
      expect(etbItem()).toHaveAccessibleName("ETB");

      await selectMainView("Lagekarte");
      expect(etbItem()).toHaveAccessibleName("ETB");
    });
  });

  describe("the main view Stärke", () => {
    const pane = (view: string) =>
      document.querySelector(`[data-view="${view}"]`) as HTMLElement;

    it("is hidden until selected", () => {
      renderWorkspace();
      expect(pane("strength").style.display).toBe("none");
    });

    it("shows only the Stärke pane once selected", async () => {
      renderWorkspace();
      await selectMainView("Stärke");

      expect(pane("strength").style.display).toBe("");
      expect(pane("map").style.display).toBe("none");
      expect(pane("etb").style.display).toBe("none");
    });

    it("lists the Stellen and creates one", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      expect(
        within(pane("strength")).getByRole("heading", { name: "UHSt 3" }),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
        "Ziel{Enter}",
      );
      expect(props.onCreateStation).toHaveBeenCalledWith("Ziel");
    });

    it("renames a Stelle", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      await userEvent.click(
        screen.getByRole("button", { name: "UHSt 3 umbenennen" }),
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Neuer Name" }),
        " Nord{Enter}",
      );
      expect(props.onRenameStation).toHaveBeenCalledWith("st1", "UHSt 3 Nord");
    });

    it("records a Stärkemeldung of a Stelle", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(screen.getByRole("textbox", { name: "EK" }), "6");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(props.onRecordStrengthReport).toHaveBeenCalledWith("st1", {
        leaders: 0,
        subLeaders: 0,
        crew: 6,
        additionalPersonnel: 0,
        note: null,
      });
    });

    it("reports the Gesamtstärke and marks a report older than 60 minutes", async () => {
      const { props } = renderWorkspace({
        stations: [
          {
            id: "st1",
            name: "UHSt 3",
            reports: [
              {
                id: "r1",
                leaders: 0,
                subLeaders: 1,
                crew: 6,
                additionalPersonnel: 2,
                note: null,
                reportedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
                state: "gueltig",
                number: 1,
              },
            ],
          },
        ],
      });
      await selectMainView("Stärke");

      expect(screen.getByText(/^älteste Meldung/)).toHaveAttribute(
        "data-stale",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Gesamtstärke melden" }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Melden",
        }),
      );
      expect(props.onReportTotalStrength).toHaveBeenCalledTimes(1);
    });

    it("shows a Stelle and a Stärkemeldung arriving live while Stärke is shown", async () => {
      const { props } = buildProps({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Stärke");

      rerender(
        <SituationWorkspace
          {...props}
          stations={[
            {
              id: "st1",
              name: "UHSt 3",
              reports: [
                {
                  id: "r1",
                  leaders: 0,
                  subLeaders: 1,
                  crew: 6,
                  additionalPersonnel: 2,
                  note: null,
                  reportedAt: new Date().toISOString(),
                  state: "gueltig",
                  number: 1,
                },
              ],
            },
            { id: "st2", name: "Ziel", reports: [] },
          ]}
        />,
      );

      const strength = within(pane("strength"));
      const stationCard = strength
        .getByRole("heading", { name: "UHSt 3" })
        .closest("[data-station]") as HTMLElement;
      expect(stationCard).toHaveTextContent("0/1/6/7");
      expect(strength.getByRole("region", { name: "Summe" })).toHaveTextContent(
        "0/1/6/7",
      );
      expect(
        strength.getByRole("heading", { name: "Ziel" }),
      ).toBeInTheDocument();
    });

    it("keeps a half-filled Stärkemeldung when switching to the Lagekarte and back", async () => {
      renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(screen.getByRole("textbox", { name: "EK" }), "6");

      await selectMainView("Lagekarte");
      await selectMainView("Stärke");

      expect(screen.getByRole("textbox", { name: "EK" })).toHaveValue("6");
    });

    it("keeps a started Stelle name when switching to the ETB and back", async () => {
      renderWorkspace();
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
        "Ziel",
      );

      await selectMainView("ETB");
      await selectMainView("Stärke");

      expect(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
      ).toHaveValue("Ziel");
    });
  });

  it("keeps a started ETB entry when switching to the Lagekarte and back", async () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
      target: { value: "Deich gesichert" },
    });
    await selectMainView("Lagekarte");
    await selectMainView("ETB");
    expect(screen.getByLabelText("Neuer Eintrag")).toHaveValue(
      "Deich gesichert",
    );
  });

  it("does not recreate the map when switching views", async () => {
    const { factory, adapter } = renderWorkspace();
    await selectMainView("Lagekarte");
    await selectMainView("ETB");
    expect(factory.create).toHaveBeenCalledTimes(1);
    expect(adapter.destroy).not.toHaveBeenCalled();
  });

  it("starts on the ETB on a phone", () => {
    stubMatchMedia(false);
    try {
      renderWorkspace();
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).not.toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts on the ETB on the desktop, next to the Lagekarte", () => {
    stubMatchMedia(true);
    try {
      renderWorkspace();
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the main view when the width crosses 768 px", () => {
    const { fireChange } = stubMatchMedia(false);
    try {
      renderWorkspace();
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();

      // Die Breite überschreitet 768 px (Tablet drehen); die gewählte
      // Hauptansicht bleibt.
      act(() => {
        fireChange(true);
      });

      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows the ETB and leaves the Lagekarte to CSS in the server-rendered markup", () => {
    const { props } = buildProps();
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <Providers>
        <SituationWorkspace {...props} />
      </Providers>,
    );
    const pane = (view: string) =>
      container.querySelector(`[data-view="${view}"]`) as HTMLElement;
    expect(pane("etb").style.display).toBe("");
    expect(pane("map").style.display).toBe("");
    expect(pane("strength").style.display).toBe("none");
    // Hides the map on a phone until the width is known (situation-workspace.css).
    expect(pane("map").closest('[data-layout="unknown"]')).not.toBeNull();
  });

  it("hides the phone bar while the on-screen keyboard is open, even with the field still focused", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    try {
      renderWorkspace();
      const phoneBar = () => screen.queryByRole("contentinfo");
      expect(
        within(phoneBar() as HTMLElement).getByText("Lagekarte"),
      ).toBeInTheDocument();

      screen.getByLabelText("Neuer Eintrag").focus();
      act(() => viewport.resizeTo(window.innerHeight - 300));
      expect(phoneBar()).toBeNull();
      expect(footerOffsetReleased()).toBe(true);

      act(() => viewport.resizeTo(window.innerHeight));
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
      expect(phoneBar()).toBeInTheDocument();
      expect(footerOffsetReleased()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe("the cursor in the ETB on the desktop", () => {
    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const selectInSidebar = (name: "Lagekarte" | "ETB" | "Stärke") =>
      userEvent.click(within(screen.getByRole("main")).getByText(name));

    it("puts the cursor into Neuer Eintrag when ETB is chosen from the Lagekarte", async () => {
      renderWorkspace();
      await selectInSidebar("Lagekarte");
      await selectInSidebar("ETB");
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
    });

    it("puts the cursor into Neuer Eintrag when ETB is chosen from the Stärke", async () => {
      renderWorkspace();
      await selectInSidebar("Stärke");
      await selectInSidebar("ETB");
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
    });

    it("puts the cursor back into Neuer Eintrag when ETB is chosen while the ETB is shown", async () => {
      renderWorkspace();
      await selectInSidebar("ETB");
      act(() => screen.getByLabelText("Neuer Eintrag").blur());

      await selectInSidebar("ETB");
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
    });
  });

  it("leaves the cursor where it is when ETB is chosen on a phone", async () => {
    stubMatchMedia(false);
    try {
      renderWorkspace();
      await selectMainView("Lagekarte");
      await selectMainView("ETB");
      expect(screen.getByLabelText("Neuer Eintrag")).not.toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows the latest ETB entry when the ETB is chosen", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    try {
      renderWorkspace();
      await selectMainView("Lagekarte");
      scrollIntoView.mockClear();

      await selectMainView("ETB");

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  it("shows the ETB as the default main view on a phone and adds an entry", async () => {
    const onAddJournalEntry = vi.fn(async () => ({}));
    renderWorkspace({
      onAddJournalEntry,
      journalEntries: [
        {
          id: "e1",
          number: 1,
          createdAt: "2026-07-03T08:00:00.000Z",
          text: "Einsatz eröffnet",
          type: "einsatz-eröffnet",
          state: "gueltig",
          author: null,
          editedAt: null,
          revisions: [],
        },
      ],
    });
    expect(screen.getByText("Einsatz eröffnet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
      target: { value: "Deich gesichert" },
    });
    await userEvent.click(screen.getByText("Eintrag hinzufügen"));
    expect(onAddJournalEntry).toHaveBeenCalledWith("Deich gesichert");
  });

  it("shows a connection-lost symbol on both header sizes when the live stream is disconnected, without a banner above the work area", () => {
    renderWorkspace({ eventsHook: () => ({ connected: false }) });
    for (const testId of ["desktop-header", "mobile-header"]) {
      expect(
        within(screen.getByTestId(testId)).getByLabelText(
          "Verbindung getrennt – wird automatisch wiederhergestellt",
          { selector: "button" },
        ),
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reloads the full state when a live event arrives", () => {
    routerRefresh.mockClear();
    let fire: () => void = () => {};
    renderWorkspace({
      eventsHook: (_url, onChanged) => {
        fire = onChanged;
        return { connected: true };
      },
    });
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });
});
