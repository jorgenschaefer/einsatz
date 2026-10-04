import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import {
  act,
  fireEvent,
  notificationArea,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render";
import { ViewLinkPanel, type ViewLinkPanelProps } from "./ViewLinkPanel";

const leitstelle = { id: "1", label: "Leitstelle", token: "tok-a" };

function setup(over: Partial<ViewLinkPanelProps> = {}) {
  const props: ViewLinkPanelProps = {
    links: [],
    onCreate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    ...over,
  };
  const { rerender } = render(<ViewLinkPanel {...props} />);
  return { ...props, removePanel: () => rerender(<p>Lagekarte</p>) };
}

const createButton = () =>
  screen.getByRole("button", { name: /Ansichtslink erzeugen/i });

async function createLeitstelle() {
  fireEvent.change(screen.getByLabelText(/Bezeichnung/i), {
    target: { value: "Leitstelle" },
  });
  await userEvent.click(createButton());
}

async function askToDelete(name = "Leitstelle") {
  await userEvent.click(
    screen.getByRole("button", { name: `${name} löschen` }),
  );
  return screen.findByRole("dialog", {
    name: `Ansichtslink „${name}“ löschen`,
  });
}

const confirmButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Endgültig löschen" });

describe("ViewLinkPanel", () => {
  it("shows an empty-state hint when there are no view links", () => {
    setup({ links: [] });
    expect(screen.getByText(/noch kein ansichtslink/i)).toBeInTheDocument();
  });

  it("creates a named view link and clears the field", async () => {
    const props = setup();
    await createLeitstelle();
    expect(props.onCreate).toHaveBeenCalledWith("Leitstelle");
    expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("");
  });

  it("disables the create button while a creation is in flight", async () => {
    let resolve: (result: ActionResult) => void = () => {};
    const onCreate = vi.fn(
      () => new Promise<ActionResult>((r) => (resolve = r)),
    );
    setup({ onCreate });
    await createLeitstelle();
    expect(createButton()).toBeDisabled();
    // Die Erzeugung abschließen und das folgende State-Update (Feld leeren,
    // Ladezustand beenden) abwarten, damit es innerhalb act() flusht.
    resolve({});
    await waitFor(() => expect(createButton()).toBeEnabled());
  });

  describe("when creating fails", () => {
    it("shows the failure as a notification titled Ansichtslinks, not atop the panel", async () => {
      setup({ onCreate: vi.fn(async () => ({ error: "Einsatz zu." })) });

      await createLeitstelle();

      const notification = await screen.findByRole("alert");
      expect(notification).toHaveTextContent("Ansichtslinks");
      expect(notification).toHaveTextContent("Einsatz zu.");
      expect(notificationArea()).toContainElement(notification);
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "Bezeichnung zu lang." }),
        "Bezeichnung zu lang.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s and keeps the label for another try",
      async (_, onCreate, message) => {
        setup({ onCreate });

        await createLeitstelle();

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("Leitstelle");
        expect(createButton()).toBeEnabled();
      },
    );

    it("clears the failure and the field once a retry succeeds", async () => {
      const onCreate = vi
        .fn<ViewLinkPanelProps["onCreate"]>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({});
      setup({ onCreate });
      await createLeitstelle();
      await screen.findByRole("alert");

      await userEvent.click(createButton());

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("");
    });

    describe("the failure", () => {
      async function setupWithFailure() {
        setup({
          links: [leitstelle],
          onCreate: vi.fn(async () => ({ error: "Bezeichnung zu lang." })),
        });
        await createLeitstelle();
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Bezeichnung zu lang.",
        );
      }

      it("goes away when the delete confirmation opens", async () => {
        await setupWithFailure();

        await askToDelete();

        expect(screen.queryByRole("alert")).toBeNull();
      });

      it("stays when the panel goes away", async () => {
        const { removePanel } = setup({
          onCreate: vi.fn(async () => ({ error: "Bezeichnung zu lang." })),
        });
        await createLeitstelle();
        await screen.findByRole("alert");

        removePanel();
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Bezeichnung zu lang.",
        );
      });

      it("stays while typing a Bezeichnung", async () => {
        await setupWithFailure();

        await userEvent.type(screen.getByLabelText(/Bezeichnung/i), " Nord");

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Bezeichnung zu lang.",
        );
      });
    });
  });

  it("lists links with their label and shows a fallback for a blank one", () => {
    setup({
      links: [
        { id: "1", label: "Leitstelle", token: "tok-a" },
        { id: "2", label: "", token: "tok-b" },
      ],
    });
    expect(screen.getByText("Leitstelle")).toBeInTheDocument();
    expect(screen.getByText("Ansichtslink")).toBeInTheDocument();
  });

  describe("copying a link", () => {
    const writeText = vi.fn();
    const provideClipboard = () =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
    const copy = () =>
      userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );

    const removeClipboard = () => {
      writeText.mockReset();
      delete (navigator as { clipboard?: unknown }).clipboard;
    };
    beforeEach(removeClipboard);
    afterEach(removeClipboard);

    it("copies the view URL of a link and confirms it with 'kopiert', like the device link panel", async () => {
      writeText.mockResolvedValue(undefined);
      provideClipboard();
      setup({ links: [leitstelle] });

      await copy();

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/view/tok-a"),
      );
      expect(await screen.findByText("kopiert")).toBeInTheDocument();
    });

    it("does not confirm 'kopiert' and hints instead in the panel when the clipboard API is unavailable", async () => {
      // Unsicherer Kontext / In-App-Webview: navigator.clipboard fehlt ganz.
      setup({ links: [leitstelle] });

      await copy();

      expect(screen.queryByText("kopiert")).toBeNull();
      const hint = await screen.findByRole("alert");
      expect(hint).toHaveTextContent(/Kopieren nicht möglich/);
      expect(notificationArea()).not.toContainElement(hint);
    });

    it("does not confirm 'kopiert' when writing to the clipboard is rejected", async () => {
      writeText.mockRejectedValue(new Error("denied"));
      provideClipboard();
      setup({ links: [leitstelle] });

      await copy();

      expect(writeText).toHaveBeenCalled();
      expect(screen.queryByText("kopiert")).toBeNull();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /nicht möglich/i,
      );
    });

    it("keeps the failure fallback visible instead of auto-hiding it", async () => {
      // Der Fehlerhinweis zeigt die einzige Stelle mit der rohen URL zum manuellen
      // Kopieren – anders als „kopiert" darf er nicht nach 2s verschwinden.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        setup({ links: [leitstelle] });
        await copy();
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });
        expect(screen.getByRole("alert")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("reveals a QR code on demand", async () => {
    setup({ links: [leitstelle] });
    expect(document.querySelector("svg")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle QR/i }),
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  describe("deleting a link", () => {
    it("asks in a dialog, not inline in the row, and deletes only once confirmed", async () => {
      const onDelete = vi.fn(async () => ({}));
      setup({ links: [leitstelle], onDelete });

      const dialog = await askToDelete();

      expect(onDelete).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Wer diesen Link hat, sieht die Lage sofort nicht mehr.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");
      expect(
        screen.queryByText("Zugang für diesen Link sofort beenden?"),
      ).toBeNull();

      await userEvent.click(confirmButton(dialog));

      expect(onDelete).toHaveBeenCalledWith("1");
      expect(onDelete).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("names a link without a label „Ansichtslink“ in the title", async () => {
      setup({ links: [{ id: "2", label: "  ", token: "tok-b" }] });

      expect(await askToDelete("Ansichtslink")).toBeInTheDocument();
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
      setup({ links: [leitstelle], onDelete });
      const dialog = await askToDelete();

      await cancel(dialog);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText("Leitstelle")).toBeInTheDocument();
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "Ansichtslink nicht gefunden." }),
        "Ansichtslink nicht gefunden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation and keeps the link",
      async (_, onDelete, message) => {
        setup({ links: [leitstelle], onDelete });
        const dialog = await askToDelete();

        await userEvent.click(confirmButton(dialog));

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
          message,
        );
        expect(screen.getByText("Leitstelle")).toBeInTheDocument();
        expect(confirmButton(dialog)).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );

    it("stays locked while deleting", async () => {
      const onDelete = vi.fn(() => new Promise<ActionResult>(() => {}));
      setup({ links: [leitstelle], onDelete });
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

    describe("while a creation that fails runs behind it", () => {
      async function failCreationBehindConfirmation() {
        let fail: (result: ActionResult) => void = () => {};
        setup({
          links: [leitstelle],
          onCreate: vi.fn(
            () => new Promise<ActionResult>((resolve) => (fail = resolve)),
          ),
        });
        await createLeitstelle();
        const dialog = await askToDelete();
        await act(async () => fail({ error: "Einsatz zu." }));
        return dialog;
      }

      it("shows the failure outside the dialog, closable with the dialog open", async () => {
        const dialog = await failCreationBehindConfirmation();

        const notification = await screen.findByRole("alert");
        expect(notification).toHaveTextContent("Einsatz zu.");
        expect(notificationArea()).toContainElement(notification);
        await userEvent.click(
          within(notification).getByRole("button", {
            name: "Meldung schließen",
          }),
        );

        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
        expect(screen.getByRole("dialog")).toBe(dialog);
      });

      it("closes the notification once the deletion is confirmed", async () => {
        const dialog = await failCreationBehindConfirmation();

        await userEvent.click(confirmButton(dialog));

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      });
    });
  });
});
