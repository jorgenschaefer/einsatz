import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import { chooseAction, entry, setup } from "./JournalPanel.fixtures";

describe("JournalPanel – Korrigieren", () => {
  it("offers correcting from the entry's action menu without correcting yet", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    expect(screen.getByLabelText(/Korrektur/)).toHaveValue("Deich hält");
    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  it("hides the entry's menu while it is being corrected", async () => {
    setup();
    await chooseAction(1, "Korrigieren");
    expect(
      screen.queryByRole("button", { name: "Aktionen für Eintrag #1" }),
    ).toBeNull();
  });

  it("corrects a manual entry through an inline edit prefilled with the current text", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Deich hält nicht" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(props.onCorrect).toHaveBeenCalledWith("e1", "Deich hält nicht");
  });

  it("renders prior fassungen struck through with their author", () => {
    setup({
      entries: [
        entry({
          text: "Deich hält nicht",
          author: "bernd",
          editedAt: "2026-07-03T09:00:00.000Z",
          revisions: [
            {
              text: "Deich hält",
              author: "anna",
              createdAt: "2026-07-03T08:00:00.000Z",
            },
          ],
        }),
      ],
    });
    const prior = screen.getByText("Deich hält");
    expect(prior.closest("del")).toBeInTheDocument();
    // The prior fassung stays visible with its original author.
    expect(screen.getByText(/–\s*anna/)).toBeInTheDocument();
  });

  it("gives revisions with an identical timestamp distinct, collision-free keys", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sameTs = "2026-07-03T08:00:00.000Z";
    setup({
      entries: [
        entry({
          text: "Fassung 3",
          revisions: [
            { text: "Fassung 1", author: "anna", createdAt: sameTs },
            { text: "Fassung 2", author: "bernd", createdAt: sameTs },
          ],
        }),
      ],
    });
    expect(screen.getByText("Fassung 1")).toBeInTheDocument();
    expect(screen.getByText("Fassung 2")).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("saves a correction with Strg+Enter in the edit field", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Deich hält nicht" } });
    await userEvent.type(field, "{Control>}{Enter}{/Control}");
    expect(props.onCorrect).toHaveBeenCalledWith("e1", "Deich hält nicht");
  });

  it("surfaces a save error when a correction fails", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onCorrect });
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Neuer Text" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("surfaces a returned {error} from a correction (business ValidationError)", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockResolvedValue({
        error: "Annullierte Einträge können nicht geändert werden.",
      });
    setup({ onCorrect });
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Neuer Text" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(
      await screen.findByText(
        "Annullierte Einträge können nicht geändert werden.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a correction timestamp on a corrected entry", () => {
    setup({ entries: [entry({ editedAt: "2026-07-03T09:30:00.000Z" })] });
    expect(screen.getByText(/korrigiert/i)).toBeInTheDocument();
  });
});
