import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buttonColor } from "@/test/button-color";
import { screen, waitFor, within } from "@/test/render";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import { chooseAction, entry, setup } from "./JournalPanel.fixtures";

describe("JournalPanel – Annullieren", () => {
  it("shows the header of an annulled entry struck through", () => {
    setup({
      entries: [
        entry({
          state: "annulliert",
          sender: "UHSt 2",
          recipient: "EAL",
          channel: "Funk",
        }),
      ],
    });

    const header = screen.getByText("Von UHSt 2 an EAL", { exact: false });
    expect(header.closest("del")).toBeInTheDocument();
  });

  it("asks for confirmation before annulling and annuls only once confirmed", async () => {
    const props = setup();
    await chooseAction(1, "Annullieren …");
    expect(props.onAnnul).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", {
      name: "Eintrag #1 annullieren",
    });
    expect(within(dialog).getByText(/nicht rückgängig/)).toBeInTheDocument();
    const annullieren = within(dialog).getByRole("button", {
      name: "Annullieren",
    });
    expect(buttonColor(annullieren)).toBe("red");
    await userEvent.click(annullieren);
    expect(props.onAnnul).toHaveBeenCalledWith("e1");
  });

  it("keeps the entry valid when the confirmation is cancelled", async () => {
    const props = setup();
    await chooseAction(1, "Annullieren …");
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(props.onAnnul).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the confirmation after a successful annulment", async () => {
    setup();
    await chooseAction(1, "Annullieren …");
    await userEvent.click(screen.getByRole("button", { name: "Annullieren" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("annuls only once on a double click", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockReturnValue(new Promise(() => {}));
    setup({ onAnnul });
    await chooseAction(1, "Annullieren …");
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Annullieren" }),
    );
    expect(onAnnul).toHaveBeenCalledTimes(1);
  });

  it("annuls the entry whose menu was used when several are listed", async () => {
    const props = setup({
      entries: [
        entry({ id: "e1", number: 1, text: "Deich hält" }),
        entry({ id: "e2", number: 2, text: "Pegel steigt" }),
      ],
    });
    await chooseAction(2, "Annullieren …");
    await screen.findByRole("dialog", { name: "Eintrag #2 annullieren" });
    await userEvent.click(screen.getByRole("button", { name: "Annullieren" }));
    expect(props.onAnnul).toHaveBeenCalledWith("e2");
  });

  it("keeps the confirmation open while the annulment is in flight", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockReturnValue(new Promise(() => {}));
    setup({ onAnnul });
    await chooseAction(1, "Annullieren …");
    await userEvent.click(screen.getByRole("button", { name: "Annullieren" }));
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await userEvent.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Eintrag #1 annullieren" }),
    ).toBeInTheDocument();
  });

  it("can annul another entry after an annulment has settled", async () => {
    const props = setup({
      entries: [
        entry({ id: "e1", number: 1, text: "Deich hält" }),
        entry({ id: "e2", number: 2, text: "Pegel steigt" }),
      ],
    });
    await chooseAction(1, "Annullieren …");
    await userEvent.click(screen.getByRole("button", { name: "Annullieren" }));
    await chooseAction(2, "Annullieren …");
    await userEvent.click(
      await screen.findByRole("button", { name: "Annullieren" }),
    );
    expect(props.onAnnul).toHaveBeenLastCalledWith("e2");
  });

  it("ignores a second click while the settled confirmation fades out", async () => {
    const onAnnul = vi.fn<JournalPanelProps["onAnnul"]>(async () => ({}));
    // Without env="test", so the modal keeps its exit transition and stays
    // clickable while it fades out.
    rtlRender(
      <MantineProvider>
        <JournalPanel
          operationId="op-1"
          entries={[entry()]}
          correspondents={[]}
          onAdd={vi.fn()}
          onCorrect={vi.fn()}
          onAnnul={onAnnul}
          visible
        />
      </MantineProvider>,
    );
    await chooseAction(1, "Annullieren …");
    const confirm = await screen.findByRole("button", { name: "Annullieren" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(onAnnul).toHaveBeenCalledTimes(1);
  });

  it("shows a failed annulment in the still open confirmation", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onAnnul });
    await chooseAction(1, "Annullieren …");
    const dialog = await screen.findByRole("dialog", {
      name: "Eintrag #1 annullieren",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Annullieren" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Das hat nicht geklappt. Bitte erneut versuchen.",
    );
  });

  it("shows the reason in the still open confirmation when annulling is rejected", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockResolvedValue({ error: "Eintrag nicht gefunden." });
    setup({ onAnnul });
    await chooseAction(1, "Annullieren …");
    const dialog = await screen.findByRole("dialog", {
      name: "Eintrag #1 annullieren",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Annullieren" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Eintrag nicht gefunden.",
    );
  });

  it("opens the next confirmation without the previous error", async () => {
    const onAnnul = vi
      .fn<JournalPanelProps["onAnnul"]>()
      .mockResolvedValue({ error: "Eintrag nicht gefunden." });
    setup({
      entries: [entry({ id: "e1", number: 1 }), entry({ id: "e2", number: 2 })],
      onAnnul,
    });
    await chooseAction(1, "Annullieren …");
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Eintrag #1 annullieren" }),
      ).getByRole("button", { name: "Annullieren" }),
    );
    await screen.findByText("Eintrag nicht gefunden.");
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await chooseAction(2, "Annullieren …");

    const dialog = await screen.findByRole("dialog", {
      name: "Eintrag #2 annullieren",
    });
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });
});
