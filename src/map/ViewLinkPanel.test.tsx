import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { redirectError } from "@/test/redirect-error";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import { ViewLinkPanel, type ViewLinkPanelProps } from "./ViewLinkPanel";

function setup(over: Partial<ViewLinkPanelProps> = {}) {
  const props: ViewLinkPanelProps = {
    links: [],
    onCreate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    ...over,
  };
  render(<ViewLinkPanel {...props} />);
  return props;
}

describe("ViewLinkPanel", () => {
  it("shows an empty-state hint when there are no view links", () => {
    setup({ links: [] });
    expect(screen.getByText(/noch kein ansichtslink/i)).toBeInTheDocument();
  });

  it("creates a named view link and clears the field", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Bezeichnung/i), {
      target: { value: "Leitstelle" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
    );
    expect(props.onCreate).toHaveBeenCalledWith("Leitstelle");
    expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("");
  });

  it("disables the create button while a creation is in flight", async () => {
    let resolve: (result: ActionResult) => void = () => {};
    const onCreate = vi.fn(
      () => new Promise<ActionResult>((r) => (resolve = r)),
    );
    setup({ onCreate });
    fireEvent.change(screen.getByLabelText(/Bezeichnung/i), {
      target: { value: "Leitstelle" },
    });
    const button = screen.getByRole("button", {
      name: /Ansichtslink erzeugen/i,
    });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    // Die Erzeugung abschließen und das folgende State-Update (Feld leeren,
    // Ladezustand beenden) abwarten, damit es innerhalb act() flusht.
    resolve({});
    await waitFor(() => expect(button).toBeEnabled());
  });

  describe("when creating fails", () => {
    const createLeitstelle = async () => {
      fireEvent.change(screen.getByLabelText(/Bezeichnung/i), {
        target: { value: "Leitstelle" },
      });
      await userEvent.click(
        screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
      );
    };

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
        expect(
          screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
        ).toBeEnabled();
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

      await userEvent.click(
        screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
      );

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("");
    });

    describe("the failure", () => {
      const link = { id: "v1", label: "Leitstelle", token: "tok" };

      async function setupWithFailure(over: Partial<ViewLinkPanelProps> = {}) {
        const onCreate = vi
          .fn<ViewLinkPanelProps["onCreate"]>()
          .mockResolvedValueOnce({ error: "Bezeichnung zu lang." });
        setup({ links: [link], onCreate, ...over });
        await createLeitstelle();
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Bezeichnung zu lang.",
        );
        return onCreate;
      }

      it("goes away with its close button", async () => {
        await setupWithFailure();

        await userEvent.click(
          screen.getByRole("button", { name: "Meldung schließen" }),
        );

        expect(screen.queryByRole("alert")).toBeNull();
      });

      it("is gone while the next creation runs and shows that one's failure", async () => {
        let fail: (result: ActionResult) => void = () => {};
        const onCreate = await setupWithFailure();
        onCreate.mockReturnValueOnce(
          new Promise((resolve) => {
            fail = resolve;
          }),
        );

        await userEvent.click(
          screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
        );
        expect(screen.queryByRole("alert")).toBeNull();

        fail({ error: "Einsatz ist geschlossen." });
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Einsatz ist geschlossen.",
        );
      });

      it("goes away when the delete confirmation opens", async () => {
        await setupWithFailure();

        await userEvent.click(
          screen.getByRole("button", { name: "Leitstelle löschen" }),
        );

        await screen.findByRole("dialog");
        expect(screen.queryByRole("alert")).toBeNull();
      });

      it("stays while typing a Bezeichnung", async () => {
        await setupWithFailure();

        await userEvent.type(screen.getByLabelText(/Bezeichnung/i), " Nord");

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Bezeichnung zu lang.",
        );
      });
    });

    it("shows no failure when it redirects to the login", async () => {
      const onCreate = vi.fn(async () => {
        throw redirectError();
      });
      setup({ onCreate });

      await createLeitstelle();

      await waitFor(() => expect(onCreate).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).toBeNull();
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

  it("copies the view URL of a link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/view/tok-a"),
      );
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("shows a 'kopiert' confirmation after copying, like the device link panel", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(await screen.findByText("kopiert")).toBeInTheDocument();
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("does not confirm 'kopiert' and hints instead when the clipboard API is unavailable", async () => {
    // Unsicherer Kontext / In-App-Webview: navigator.clipboard fehlt ganz.
    delete (navigator as { clipboard?: unknown }).clipboard;
    setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle kopieren/i }),
    );
    expect(screen.queryByText("kopiert")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nicht möglich/i,
    );
  });

  it("does not confirm 'kopiert' when writing to the clipboard is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(writeText).toHaveBeenCalled();
      expect(screen.queryByText("kopiert")).toBeNull();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /nicht möglich/i,
      );
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("keeps the failure fallback visible instead of auto-hiding it", async () => {
    // Der Fehlerhinweis zeigt die einzige Stelle mit der rohen URL zum manuellen
    // Kopieren – anders als „kopiert" darf er nicht nach 2s verschwinden.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      delete (navigator as { clipboard?: unknown }).clipboard;
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reveals a QR code on demand", async () => {
    setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
    expect(document.querySelector("svg")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle QR/i }),
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  describe("deleting a link", () => {
    const leitstelle = { id: "1", label: "Leitstelle", token: "tok-a" };

    const askToDelete = async (name = "Leitstelle") => {
      await userEvent.click(
        screen.getByRole("button", { name: `${name} löschen` }),
      );
      return screen.findByRole("dialog", {
        name: `Ansichtslink „${name}“ löschen`,
      });
    };

    const confirmButton = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", { name: "Endgültig löschen" });

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

    it("clears a failure that arrived while the confirmation was open once the link is deleted", async () => {
      let fail: (result: ActionResult) => void = () => {};
      const onCreate = vi.fn(
        () => new Promise<ActionResult>((resolve) => (fail = resolve)),
      );
      setup({ links: [leitstelle], onCreate });
      await userEvent.click(
        screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
      );
      const dialog = await askToDelete();
      await act(async () => fail({ error: "Einsatz ist geschlossen." }));

      await userEvent.click(confirmButton(dialog));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByRole("alert")).toBeNull();
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
  });
});
