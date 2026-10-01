import { Button, Modal } from "@mantine/core";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalCloseButton } from "@/test/modal-close-button";
import { clickModalOverlay } from "@/test/modal-overlay";
import { redirectError } from "@/test/redirect-error";
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

describe("ConfirmationModal", () => {
  it("colours the confirm button red unless told otherwise", () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    expect(buttonColor(button(dialog, "Annullieren"))).toBe("red");
  });

  it("colours the confirm button as told", () => {
    render(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        title="Gesamtstärke melden"
        confirmLabel="Melden"
        confirmColor="blue"
        onConfirm={vi.fn(async () => ({}))}
      >
        Die Summe wird eingetragen.
      </ConfirmationModal>,
    );

    expect(buttonColor(screen.getByRole("button", { name: "Melden" }))).toBe(
      "blue",
    );
  });

  it("puts the focus on Abbrechen when it opens", async () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    await waitFor(() => expect(button(dialog, "Abbrechen")).toHaveFocus());
  });

  it("shows its title, its consequence and both buttons", () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    expect(dialog).toHaveAccessibleName("Eintrag #3 annullieren");
    expect(dialog).toHaveTextContent("Das lässt sich nicht rückgängig machen.");
    expect(button(dialog, "Abbrechen")).toBeEnabled();
    expect(button(dialog, "Annullieren")).toBeEnabled();
  });

  it("makes both buttons large enough to tap on a phone", () => {
    const { dialog } = setup(vi.fn(async () => ({})));

    expect(button(dialog, "Abbrechen")).toHaveStyle({ height: "44px" });
    expect(button(dialog, "Annullieren")).toHaveStyle({ height: "44px" });
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

  describe("when the action redirects", () => {
    it("shows no failure and stays loading until the navigation lands", async () => {
      const onConfirm = vi.fn(async () => {
        throw redirectError();
      });
      const { onClose, dialog } = setup(onConfirm);

      await userEvent.click(button(dialog, "Annullieren"));
      await userEvent.click(button(dialog, "Annullieren"), {
        pointerEventsCheck: 0,
      });

      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(button(dialog, "Annullieren")).toHaveAttribute(
        "data-loading",
        "true",
      );
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
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
      await clickModalOverlay();

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

  describe("opened from a button outside any dialog", () => {
    function Unstacked() {
      const [asking, setAsking] = useState(false);
      return (
        <>
          <Button onClick={() => setAsking(true)}>Entfernen</Button>
          <ConfirmationModal
            opened={asking}
            onClose={() => setAsking(false)}
            title="Ebene entfernen"
            confirmLabel="Entfernen"
            onConfirm={vi.fn(async () => ({}))}
          >
            Das lässt sich nicht rückgängig machen.
          </ConfirmationModal>
        </>
      );
    }

    it.each([
      [
        "Abbrechen",
        (dialog: HTMLElement) => userEvent.click(button(dialog, "Abbrechen")),
      ],
      ["×", (dialog: HTMLElement) => clickModalCloseButton(dialog)],
      ["Escape", () => userEvent.keyboard("{Escape}")],
    ])(
      "returns the focus to that button when closed with %s",
      async (_, closeConfirmation) => {
        render(<Unstacked />);
        const opener = screen.getByRole("button", { name: "Entfernen" });
        await userEvent.click(opener);
        const dialog = await screen.findByRole("dialog");
        await waitFor(() => expect(button(dialog, "Abbrechen")).toHaveFocus());

        await closeConfirmation(dialog);

        await waitFor(() => expect(opener).toHaveFocus());
      },
    );
  });

  describe("on top of another dialog in a Modal.Stack", () => {
    function Stacked({
      onCloseBelow,
      onClose,
      removesOpenerOnConfirm = false,
    }: {
      onCloseBelow: () => void;
      onClose: () => void;
      removesOpenerOnConfirm?: boolean;
    }) {
      const [asking, setAsking] = useState(false);
      const [deleted, setDeleted] = useState(false);
      return (
        <Modal.Stack>
          <Modal
            stackId="unten"
            opened
            onClose={onCloseBelow}
            title="Kartenzeichen"
          >
            {!deleted && (
              <Button onClick={() => setAsking(true)}>Löschen</Button>
            )}
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
              onConfirm={async () => {
                if (removesOpenerOnConfirm) setDeleted(true);
                return {};
              }}
            >
              Das lässt sich nicht rückgängig machen.
            </ConfirmationModal>
          </Modal>
        </Modal.Stack>
      );
    }

    async function setupStacked({ removesOpenerOnConfirm = false } = {}) {
      const onCloseBelow = vi.fn();
      const onClose = vi.fn();
      render(
        <Stacked
          onCloseBelow={onCloseBelow}
          onClose={onClose}
          removesOpenerOnConfirm={removesOpenerOnConfirm}
        />,
      );
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

    const confirmation = () =>
      screen.getByRole("dialog", { name: "Kartenzeichen löschen" });
    const opener = () => screen.getByRole("button", { name: "Löschen" });

    it("puts the focus on Abbrechen when it opens", async () => {
      await setupStacked();

      await waitFor(() =>
        expect(button(confirmation(), "Abbrechen")).toHaveFocus(),
      );
    });

    it.each([
      ["Abbrechen", () => userEvent.click(button(confirmation(), "Abbrechen"))],
      ["×", () => clickModalCloseButton(confirmation())],
      ["Escape", () => userEvent.keyboard("{Escape}")],
    ])(
      "returns the focus to the button that opened it when closed with %s",
      async (_, closeConfirmation) => {
        const { onCloseBelow } = await setupStacked();
        await waitFor(() =>
          expect(button(confirmation(), "Abbrechen")).toHaveFocus(),
        );

        await closeConfirmation();

        await waitFor(() => expect(opener()).toHaveFocus());
        expect(screen.getByRole("dialog", { name: "Kartenzeichen" })).toBe(
          screen.getByRole("dialog"),
        );
        expect(onCloseBelow).not.toHaveBeenCalled();
      },
    );

    it("returns the focus to the button that opened it after confirming", async () => {
      await setupStacked();

      await userEvent.click(button(confirmation(), "Endgültig löschen"));

      await waitFor(() => expect(opener()).toHaveFocus());
    });

    it("focuses the dialog below when the button that opened it is gone", async () => {
      const { onCloseBelow } = await setupStacked({
        removesOpenerOnConfirm: true,
      });

      await userEvent.click(button(confirmation(), "Endgültig löschen"));

      const below = screen.getByRole("dialog", { name: "Kartenzeichen" });
      await waitFor(() => expect(below).toHaveFocus());
      await userEvent.keyboard("{Enter}");
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

      await clickModalOverlay();

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
