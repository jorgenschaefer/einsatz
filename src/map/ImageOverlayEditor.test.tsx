import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { act, render, screen, waitFor, within } from "@/test/render";
import {
  ImageOverlayEditor,
  type ImageOverlayEditorProps,
} from "./ImageOverlayEditor";

function setup(over: Partial<ImageOverlayEditorProps> = {}) {
  const props: ImageOverlayEditorProps = {
    opacity: 0.8,
    onOpacityChange: vi.fn(),
    onReplace: vi.fn(),
    onDelete: vi.fn(async () => ({})),
    onDone: vi.fn(),
    ...over,
  };
  const { rerender } = render(<ImageOverlayEditor {...props} />);
  return {
    ...props,
    rerender: (more: Partial<ImageOverlayEditorProps>) =>
      rerender(<ImageOverlayEditor {...props} {...more} />),
  };
}

describe("ImageOverlayEditor", () => {
  it("shows the current opacity on the slider", () => {
    setup({ opacity: 0.8 });
    expect(screen.getByRole("slider", { name: "Deckkraft" })).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
  });

  it("adjusts the opacity via the slider", async () => {
    const onOpacityChange = vi.fn();
    setup({ opacity: 0.8, onOpacityChange });
    const slider = screen.getByRole("slider", { name: "Deckkraft" });
    act(() => slider.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(onOpacityChange).toHaveBeenCalled();
    expect(onOpacityChange.mock.calls.at(-1)![0]).toBeGreaterThan(0.8);
  });

  it("moves the slider before the opacity is saved", async () => {
    const onOpacityChange = vi.fn();
    setup({ opacity: 0.8, onOpacityChange });
    const slider = screen.getByRole("slider", { name: "Deckkraft" });
    act(() => slider.focus());

    await userEvent.keyboard("{ArrowRight}{ArrowRight}");

    expect(slider).toHaveAttribute("aria-valuenow", "90");
    expect(onOpacityChange.mock.calls.map(([o]) => o)).toEqual([0.85, 0.9]);
  });

  it("follows an opacity that changes elsewhere", () => {
    const { rerender } = setup({ opacity: 0.8 });

    rerender({ opacity: 0.5 });

    expect(screen.getByRole("slider", { name: "Deckkraft" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
  });

  it("replaces the file", async () => {
    const onReplace = vi.fn();
    setup({ onReplace });
    const file = new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
    expect(onReplace).toHaveBeenCalledWith(file);
  });

  it("finishes editing", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(props.onDone).toHaveBeenCalled();
  });

  describe("deleting", () => {
    const askToDelete = async () => {
      await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
      return screen.findByRole("dialog", { name: "Bild-Overlay löschen" });
    };

    const confirmButton = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", { name: "Endgültig löschen" });

    it("asks for confirmation first and deletes only once confirmed", async () => {
      const onDelete = vi.fn(async () => ({}));
      setup({ onDelete });

      const dialog = await askToDelete();

      expect(onDelete).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Das Bild wird mit seiner Datei gelöscht. Das lässt sich nicht rückgängig machen.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");

      await userEvent.click(confirmButton(dialog));

      expect(onDelete).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "with Abbrechen",
        (dialog: HTMLElement) =>
          userEvent.click(
            within(dialog).getByRole("button", { name: "Abbrechen" }),
          ),
      ],
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])("does not delete when cancelled %s", async (_, cancel) => {
      const onDelete = vi.fn(async () => ({}));
      setup({ onDelete });
      const dialog = await askToDelete();

      await cancel(dialog);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onDelete).not.toHaveBeenCalled();
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "Bild-Overlay nicht gefunden." }),
        "Bild-Overlay nicht gefunden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])("shows %s in the open confirmation", async (_, onDelete, message) => {
      setup({ onDelete });
      const dialog = await askToDelete();

      await userEvent.click(confirmButton(dialog));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
      expect(confirmButton(dialog)).toBeEnabled();
      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeEnabled();
    });

    it("stays locked while deleting", async () => {
      const onDelete = vi.fn(() => new Promise<ActionResult>(() => {}));
      setup({ onDelete });
      const dialog = await askToDelete();

      await userEvent.click(confirmButton(dialog));
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();
      await userEvent.click(confirmButton(dialog), { pointerEventsCheck: 0 });

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  it("disables controls while busy and shows an error", () => {
    setup({ busy: true, error: "Speichern fehlgeschlagen." });
    expect(screen.getByRole("button", { name: "Fertig" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen.",
    );
  });
});
