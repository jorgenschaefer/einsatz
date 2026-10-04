import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buttonColor } from "@/test/button-color";
import { screen, within } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import { chooseAction, entry, setup } from "./JournalPanel.fixtures";

describe("JournalPanel – Annullieren", () => {
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
});
