import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import type { JournalEntryType } from "./entry-type";
import { JournalPanel } from "./JournalPanel";
import {
  entry,
  newEntry,
  newEntryField,
  panelProps,
  setup,
} from "./JournalPanel.fixtures";

describe("JournalPanel", () => {
  it("adds a new manual entry from the input row", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Neuer Eintrag/), {
      target: { value: "Neue Lage" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Neue Lage" }),
    );
  });

  it("adds a new manual entry with Strg+Enter in the input field", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Neuer Eintrag/), {
      target: { value: "Neue Lage" },
    });
    await userEvent.type(
      screen.getByLabelText(/Neuer Eintrag/),
      "{Control>}{Enter}{/Control}",
    );
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Neue Lage" }),
    );
  });

  it("does not add an empty entry", async () => {
    const props = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("hides the automatic entries when the filter is enabled, keeping the others", async () => {
    const types: JournalEntryType[] = [
      "manuell",
      "einsatz-eröffnet",
      "einsatz-geschlossen",
      "stelle-angelegt",
      "stelle-umbenannt",
      "stärkemeldung",
      "gesamtstärke-gemeldet",
    ];
    setup({
      entries: types.map((type, i) =>
        entry({ id: type, number: i + 1, type, text: type }),
      ),
    });

    const shownTypes = () => types.filter((t) => screen.queryByText(t));
    expect(shownTypes()).toEqual(types);

    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));

    expect(shownTypes()).toEqual([
      "manuell",
      "stelle-umbenannt",
      "stärkemeldung",
      "gesamtstärke-gemeldet",
    ]);
  });

  it("hands out the Neuer Eintrag field through newEntryRef", () => {
    const newEntryRef = createRef<HTMLTextAreaElement>();
    setup({ newEntryRef });
    expect(newEntryRef.current).toBe(newEntryField());
  });

  // Am Desktop scrollt nur die Liste; das Feld steht fest darunter
  // (situation-workspace.css).
  it("keeps Neuer Eintrag and its button outside the scrolling list", () => {
    setup();
    const list = screen
      .getByText("Deich hält")
      .closest(".journal-entries") as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list).not.toContainElement(newEntryField());
    expect(list).not.toContainElement(
      screen.getByRole("button", { name: "Eintrag hinzufügen" }),
    );
  });

  describe("scrolling to the latest entry", () => {
    let scrollIntoView: MockInstance<Element["scrollIntoView"]>;

    beforeEach(() => {
      scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    });

    afterEach(() => scrollIntoView.mockRestore());

    const listEnd = () =>
      document.querySelector(".journal-entries")?.lastElementChild;

    it("brings the end of the list and Neuer Eintrag into view once it becomes visible", () => {
      const { rerender } = render(
        <JournalPanel {...panelProps({ visible: false })} />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(<JournalPanel {...panelProps({ visible: true })} />);

      expect(scrollIntoView.mock.contexts).toEqual([listEnd(), newEntry()]);
    });

    it("scrolls to the end after adding an entry, and follows it when it arrives", async () => {
      const props = panelProps();
      const { rerender } = render(<JournalPanel {...props} />);
      scrollIntoView.mockClear();

      await userEvent.type(newEntryField(), "Pegel steigt");
      await userEvent.click(
        screen.getByRole("button", { name: "Eintrag hinzufügen" }),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
      scrollIntoView.mockClear();

      rerender(
        <JournalPanel
          {...props}
          entries={[...props.entries, entry({ id: "e2", number: 2 })]}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });
  });
});
