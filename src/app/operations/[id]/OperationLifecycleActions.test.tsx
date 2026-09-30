import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { clickModalOverlay } from "@/test/modal-overlay";
import { render, screen, within } from "@/test/render";
import {
  OperationLifecycleActions,
  type OperationLifecycleActionsProps,
} from "./OperationLifecycleActions";

function setup(over: Partial<OperationLifecycleActionsProps> = {}) {
  const props: OperationLifecycleActionsProps = {
    name: "Hochwasser",
    status: "active",
    onClose: vi.fn(),
    onReopen: vi.fn(),
    onDelete: vi.fn(async () => ({})),
    ...over,
  };
  render(<OperationLifecycleActions {...props} />);
  return props;
}

const openMenu = () =>
  userEvent.click(screen.getByRole("button", { name: /Einsatz-Aktionen/ }));

describe("OperationLifecycleActions", () => {
  it("closes an active Einsatz from the menu", async () => {
    const props = setup({ status: "active" });
    await openMenu();
    expect(
      screen.queryByRole("menuitem", { name: /Wieder öffnen/ }),
    ).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Abschließen/ }),
    );
    expect(props.onClose).toHaveBeenCalled();
  });

  it("reopens a closed Einsatz from the menu", async () => {
    const props = setup({ status: "closed" });
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /Abschließen/ })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Wieder öffnen/ }),
    );
    expect(props.onReopen).toHaveBeenCalled();
  });

  it("requires explicit confirmation before deleting, warning about the Einsatztagebuch", async () => {
    const props = setup();
    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Dieser Einsatz wird mit seinem gesamten Einsatztagebuch und allen Kartenobjekten unwiderruflich gelöscht.",
    );
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /Endgültig löschen/ }),
    );
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const props = setup();
    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Abbrechen" }),
    );
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  async function confirmDelete() {
    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Einsatz „Hochwasser“ löschen",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Endgültig löschen" }),
    );
    return dialog;
  }

  describe("while deleting", () => {
    const hanging = () => new Promise<ActionResult>(() => {});

    it("shows the confirm button loading and locks cancelling", async () => {
      setup({ onDelete: vi.fn(hanging) });

      const dialog = await confirmDelete();

      expect(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      ).toHaveAttribute("data-loading", "true");
      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
    });

    it("does not close on Escape or a click beside the dialog", async () => {
      setup({ onDelete: vi.fn(hanging) });
      await confirmDelete();

      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();

      expect(
        screen.getByRole("dialog", { name: "Einsatz „Hochwasser“ löschen" }),
      ).toBeInTheDocument();
    });

    it("does not delete again on a second tap", async () => {
      const onDelete = vi.fn(hanging);
      setup({ onDelete });

      const dialog = await confirmDelete();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        { pointerEventsCheck: 0 },
      );

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("when deleting fails", () => {
    it("shows an unexpected failure in the open dialog and allows confirming again", async () => {
      const onDelete = vi.fn(async () => {
        throw new Error("DB weg");
      });
      setup({ onDelete });

      const dialog = await confirmDelete();

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      );
      expect(onDelete).toHaveBeenCalledTimes(2);
    });

    it("shows a returned error in the open dialog", async () => {
      setup({ onDelete: vi.fn(async () => ({ error: "Nicht erlaubt." })) });

      const dialog = await confirmDelete();

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Nicht erlaubt.",
      );
    });
  });
});
