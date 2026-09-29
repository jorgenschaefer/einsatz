import { Button, Modal } from "@mantine/core";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import { buttonColor } from "@/test/button-color";
import { render, screen, waitFor, within } from "@/test/render";
import { ConfirmationModal } from "./ConfirmationModal";

function setup(onConfirm: () => Promise<ActionResult>) {
  const onClose = vi.fn();
  render(
    <ConfirmationModal
      opened
      onClose={onClose}
      title="Eintrag #3 annullieren"
      confirmLabel="Annullieren"
      confirmColor="red"
      onConfirm={onConfirm}
    >
      Das lässt sich nicht rückgängig machen.
    </ConfirmationModal>,
  );
  return { onClose, dialog: screen.getByRole("dialog") };
}

const hanging = () => new Promise<ActionResult>(() => {});

const button = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole("button", { name });

function clickOverlay() {
  const overlay = document.querySelector(".mantine-Modal-overlay");
  if (!overlay) throw new Error("no overlay");
  return userEvent.click(overlay);
}

describe("ConfirmationModal", () => {
  it("colours the confirm button as told", () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    expect(buttonColor(button(dialog, "Annullieren"))).toBe("red");
  });

  it("colours the confirm button blue unless told otherwise", () => {
    render(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        title="Gesamtstärke melden"
        confirmLabel="Melden"
        onConfirm={vi.fn(async () => ({}))}
      >
        Die Summe wird eingetragen.
      </ConfirmationModal>,
    );

    expect(buttonColor(screen.getByRole("button", { name: "Melden" }))).toBe(
      "blue",
    );
  });

  it("shows its title, its consequence and both buttons", () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    expect(dialog).toHaveAccessibleName("Eintrag #3 annullieren");
    expect(dialog).toHaveTextContent("Das lässt sich nicht rückgängig machen.");
    expect(button(dialog, "Abbrechen")).toBeEnabled();
    expect(button(dialog, "Annullieren")).toBeEnabled();
  });

  it("closes once the action succeeds", async () => {
    const { onClose, dialog } = setup(vi.fn(async () => ({})));

    await userEvent.click(button(dialog, "Annullieren"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  it("shows a returned error in the open dialog and allows confirming again", async () => {
    const onConfirm = vi.fn(async () => ({ error: "Schon annulliert." }));
    const { onClose, dialog } = setup(onConfirm);

    await userEvent.click(button(dialog, "Annullieren"));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Schon annulliert.",
    );
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(button(dialog, "Annullieren"));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("shows a thrown failure in the open dialog and allows cancelling", async () => {
    const { onClose, dialog } = setup(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await userEvent.click(button(dialog, "Annullieren"));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Das hat nicht geklappt. Bitte erneut versuchen.",
    );
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(button(dialog, "Abbrechen"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("while the action runs", () => {
    it("shows the confirm button loading and locks cancelling", async () => {
      const { dialog } = setup(vi.fn(hanging));

      await userEvent.click(button(dialog, "Annullieren"));

      expect(button(dialog, "Annullieren")).toHaveAttribute(
        "data-loading",
        "true",
      );
      expect(button(dialog, "Abbrechen")).toBeDisabled();
    });

    it("does not close on Escape or a click beside the dialog", async () => {
      const { onClose, dialog } = setup(vi.fn(hanging));
      await userEvent.click(button(dialog, "Annullieren"));

      await userEvent.keyboard("{Escape}");
      await clickOverlay();

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not run the action again on a second tap", async () => {
      const onConfirm = vi.fn(hanging);
      const { dialog } = setup(onConfirm);

      await userEvent.click(button(dialog, "Annullieren"));
      await userEvent.click(button(dialog, "Annullieren"), {
        pointerEventsCheck: 0,
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("on top of another dialog in a Modal.Stack", () => {
    function Stacked({
      onCloseBelow,
      onClose,
    }: {
      onCloseBelow: () => void;
      onClose: () => void;
    }) {
      const [asking, setAsking] = useState(false);
      return (
        <Modal.Stack>
          <Modal
            stackId="unten"
            opened
            onClose={onCloseBelow}
            title="Kartenzeichen"
          >
            <Button onClick={() => setAsking(true)}>Löschen</Button>
            <ConfirmationModal
              stackId="oben"
              opened={asking}
              onClose={() => {
                setAsking(false);
                onClose();
              }}
              title="Kartenzeichen löschen"
              confirmLabel="Endgültig löschen"
              confirmColor="red"
              onConfirm={vi.fn(async () => ({}))}
            >
              Das lässt sich nicht rückgängig machen.
            </ConfirmationModal>
          </Modal>
        </Modal.Stack>
      );
    }

    async function setupStacked() {
      const onCloseBelow = vi.fn();
      const onClose = vi.fn();
      render(<Stacked onCloseBelow={onCloseBelow} onClose={onClose} />);
      await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
      await screen.findByRole("dialog", { name: "Kartenzeichen löschen" });
      return { onCloseBelow, onClose };
    }

    it("closes only itself on Escape", async () => {
      const { onCloseBelow, onClose } = await setupStacked();

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCloseBelow).not.toHaveBeenCalled();
    });
  });

  describe("before confirming", () => {
    it("closes on cancel without running the action", async () => {
      const onConfirm = vi.fn(async () => ({}));
      const { onClose, dialog } = setup(onConfirm);

      await userEvent.click(button(dialog, "Abbrechen"));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("closes on Escape without running the action", async () => {
      const onConfirm = vi.fn(async () => ({}));
      const { onClose } = setup(onConfirm);

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("closes on a click beside the dialog without running the action", async () => {
      const onConfirm = vi.fn(async () => ({}));
      const { onClose } = setup(onConfirm);

      await clickOverlay();

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
