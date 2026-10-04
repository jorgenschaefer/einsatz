import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalCloseButton } from "@/test/modal-close-button";
import { clickModalOverlay } from "@/test/modal-overlay";
import { act, render, screen, waitFor, within } from "@/test/render";
import { stubVisualViewport } from "@/test/visual-viewport";
import { LageansichtShell } from "./LageansichtShell";

const CONNECTION_LOST_LABEL =
  "Verbindung getrennt – wird automatisch wiederhergestellt";

const HEADER_TEST_IDS = ["desktop-header", "mobile-header"] as const;
type HeaderTestId = (typeof HEADER_TEST_IDS)[number];

type ShellProps = Omit<ComponentProps<typeof LageansichtShell>, "children">;

const baseProps = {
  operationName: "Hochwasser",
  status: "active",
  viewLinks: [],
  onCreateViewLink: async (): Promise<ActionResult> => ({}),
  onDeleteViewLink: async (): Promise<ActionResult> => ({}),
  onSetDefaultView: async (): Promise<ActionResult> => ({}),
  setDefaultViewDisabled: false,
} satisfies ShellProps;

const shell = (over: Partial<ShellProps> = {}) => (
  <LageansichtShell {...baseProps} {...over}>
    <div>Karte</div>
  </LageansichtShell>
);

const renderShell = (over: Partial<ShellProps> = {}) => render(shell(over));

const header = (testId: HeaderTestId) => within(screen.getByTestId(testId));

const openMenu = (testId: HeaderTestId) =>
  userEvent.click(header(testId).getByRole("button", { name: "Menü" }));

async function chooseFromMenu(entry: string, testId: HeaderTestId) {
  await openMenu(testId);
  await userEvent.click(await screen.findByRole("menuitem", { name: entry }));
}

/**
 * Gibt Mantines AppShell die Höhe der Leiste an die Hauptansicht zurück?
 * jsdom rechnet kein Layout; sichtbar ist das nur an der CSS-Variable, die
 * AppShell in ihr Inline-Stylesheet schreibt.
 */
const footerOffsetReleased = () =>
  [...document.querySelectorAll("style")].some((style) =>
    style.textContent?.includes("--app-shell-footer-offset:0px !important"),
  );

describe("LageansichtShell", () => {
  it("shows the operation name and the map content", () => {
    renderShell();
    expect(
      header("desktop-header").getByRole("heading", { name: "Hochwasser" }),
    ).toBeInTheDocument();
    expect(header("desktop-header").getByText("aktiv")).toBeInTheDocument();
    expect(screen.getByText("Karte")).toBeInTheDocument();
  });

  it("shows the navigation only in the phone bar, not in a left bar", () => {
    renderShell({ navigation: <div>Leiste</div> });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      within(screen.getByRole("contentinfo")).getByText("Leiste"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Leiste")).toHaveLength(1);
  });

  describe("while the on-screen keyboard is open", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("hides the phone bar, even with the field still focused", () => {
      const viewport = stubVisualViewport(window.innerHeight);
      render(
        <LageansichtShell {...baseProps} navigation={<div>Leiste</div>}>
          <textarea aria-label="Neuer Eintrag" />
        </LageansichtShell>,
      );
      const phoneBar = () => screen.queryByRole("contentinfo");
      expect(phoneBar()).toHaveTextContent("Leiste");

      screen.getByLabelText("Neuer Eintrag").focus();
      act(() => viewport.resizeTo(window.innerHeight - 300));
      expect(phoneBar()).toBeNull();
      expect(footerOffsetReleased()).toBe(true);

      act(() => viewport.resizeTo(window.innerHeight));
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
      expect(phoneBar()).toHaveTextContent("Leiste");
      expect(footerOffsetReleased()).toBe(false);
    });
  });

  it("carries no Einsatz lifecycle actions in the header (they live in the overview)", () => {
    renderShell();
    expect(
      screen.queryByRole("button", { name: /Einsatz-Aktionen/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Abschließen/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Einsatz löschen/ }),
    ).toBeNull();
  });

  it("shows the status on both header sizes", () => {
    renderShell();
    for (const testId of HEADER_TEST_IDS) {
      expect(header(testId).getByText("aktiv")).toBeInTheDocument();
    }
  });

  it("exposes the operation name as a heading on the phone header too", () => {
    renderShell();
    expect(
      header("mobile-header").getByRole("heading", { name: "Hochwasser" }),
    ).toBeInTheDocument();
  });

  it("shows the full operation name in a popover when the truncated name is tapped", async () => {
    const longName =
      "Cyclassics 2026 – Einsatzabschnitt 4 Nord an der langen Chaussee";
    renderShell({ operationName: longName });
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: longName }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(longName)).toBeInTheDocument();
  });

  describe.each(HEADER_TEST_IDS)("the ⋮ menu in the %s", (testId) => {
    it("is the header's only menu and lists its entries in order", async () => {
      renderShell();
      expect(
        header(testId).getAllByRole("button", { name: "Menü" }),
      ).toHaveLength(1);
      await openMenu(testId);
      expect(
        (await screen.findAllByRole("menuitem")).map(
          (item) => item.textContent,
        ),
      ).toEqual([
        "Teilen",
        "Standard-Ausschnitt festlegen",
        "Zurück zu Einsätze",
      ]);
    });

    it("opens Teilen, showing the given view links", async () => {
      renderShell({
        viewLinks: [{ id: "1", label: "Leitstelle", token: "tok-a" }],
      });
      expect(screen.queryByLabelText(/Bezeichnung/i)).toBeNull();
      await chooseFromMenu("Teilen", testId);
      const dialog = await screen.findByRole("dialog", {
        name: "Ansichtslinks teilen",
      });
      expect(within(dialog).getByText("Leitstelle")).toBeInTheDocument();
    });

    it("leads back to the list of Einsätze", async () => {
      renderShell();
      await openMenu(testId);
      expect(
        await screen.findByRole("menuitem", { name: "Zurück zu Einsätze" }),
      ).toHaveAttribute("href", "/operations");
    });

    it.each([
      ["Teilen", "Ansichtslinks teilen"],
      ["Standard-Ausschnitt festlegen", "Standard-Ausschnitt festlegen"],
    ])(
      "returns the focus to ⋮ when the dialog of %s closes",
      async (entry, title) => {
        renderShell();
        await chooseFromMenu(entry, testId);
        await screen.findByRole("dialog", { name: title });

        await userEvent.keyboard("{Escape}");

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await waitFor(() =>
          expect(
            header(testId).getByRole("button", { name: "Menü" }),
          ).toHaveFocus(),
        );
      },
    );

    it("disables Standard-Ausschnitt festlegen when told to", async () => {
      renderShell({ setDefaultViewDisabled: true });
      await openMenu(testId);
      expect(
        await screen.findByRole("menuitem", {
          name: "Standard-Ausschnitt festlegen",
        }),
      ).toBeDisabled();
    });
  });

  it("has no Teilen button and no Einsätze link outside the menu on the desktop", () => {
    renderShell();
    expect(
      header("desktop-header").queryByRole("button", { name: /Teilen/ }),
    ).toBeNull();
    expect(
      header("desktop-header").queryByRole("link", { name: /Einsätze/ }),
    ).toBeNull();
  });

  describe("Standard-Ausschnitt festlegen", () => {
    async function askToSetDefaultView(
      onSetDefaultView: () => Promise<ActionResult>,
    ) {
      renderShell({ onSetDefaultView });
      await chooseFromMenu("Standard-Ausschnitt festlegen", "desktop-header");
      return screen.findByRole("dialog", {
        name: "Standard-Ausschnitt festlegen",
      });
    }

    const confirmIn = (dialog: HTMLElement) =>
      userEvent.click(
        within(dialog).getByRole("button", { name: "Festlegen" }),
      );

    it("saves the default view only after confirming", async () => {
      const onSetDefaultView = vi.fn(async (): Promise<ActionResult> => ({}));
      const dialog = await askToSetDefaultView(onSetDefaultView);
      expect(dialog).toHaveTextContent(
        "Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes.",
      );
      expect(onSetDefaultView).not.toHaveBeenCalled();
      const festlegen = within(dialog).getByRole("button", {
        name: "Festlegen",
      });
      expect(buttonColor(festlegen)).toBe("blue");

      await userEvent.click(festlegen);

      expect(onSetDefaultView).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("does not save on Abbrechen", async () => {
      const onSetDefaultView = vi.fn(async (): Promise<ActionResult> => ({}));
      const dialog = await askToSetDefaultView(onSetDefaultView);
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onSetDefaultView).not.toHaveBeenCalled();
    });

    it.each([
      [
        "the error when saving fails",
        async (): Promise<ActionResult> => ({
          error: "Ungültiger Ausschnitt.",
        }),
        "Ungültiger Ausschnitt.",
      ],
      [
        "a fallback when saving throws",
        async (): Promise<ActionResult> => {
          throw new Error("DB weg");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])("keeps the confirmation open and shows %s", async (_, save, message) => {
      const dialog = await askToSetDefaultView(save);
      await confirmIn(dialog);

      expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
    });

    it("locks Abbrechen while saving", async () => {
      const dialog = await askToSetDefaultView(
        () => new Promise<ActionResult>(() => {}),
      );
      await confirmIn(dialog);

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
    });
  });

  describe("deleting a view link from Teilen", () => {
    const deletableShell = (
      onDeleteViewLink: (id: string) => Promise<ActionResult>,
      viewLinks = [{ id: "1", label: "Leitstelle", token: "tok-a" }],
    ) => shell({ viewLinks, onDeleteViewLink });

    async function askToDelete(
      onDeleteViewLink: (id: string) => Promise<ActionResult> = vi.fn(
        async () => ({}),
      ),
    ) {
      const { rerender } = render(deletableShell(onDeleteViewLink));
      await chooseFromMenu("Teilen", "desktop-header");
      await userEvent.click(
        await screen.findByRole("button", { name: "Leitstelle löschen" }),
      );
      const confirmation = await screen.findByRole("dialog", {
        name: "Ansichtslink „Leitstelle“ löschen",
      });
      return { confirmation, rerender };
    }

    const shareDialog = () =>
      screen.getByRole("dialog", { name: "Ansichtslinks teilen" });

    it.each([
      [
        "on Abbrechen",
        (confirmation: HTMLElement) =>
          userEvent.click(
            within(confirmation).getByRole("button", { name: "Abbrechen" }),
          ),
      ],
      [
        "on ×",
        (confirmation: HTMLElement) => clickModalCloseButton(confirmation),
      ],
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])(
      "closes only the confirmation %s and returns to Teilen with the link",
      async (_, cancel) => {
        const { confirmation } = await askToDelete();

        await cancel(confirmation);

        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", {
              name: "Ansichtslink „Leitstelle“ löschen",
            }),
          ).toBeNull(),
        );
        expect(within(shareDialog()).getByText("Leitstelle")).toBeVisible();
        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: "Leitstelle löschen" }),
          ).toHaveFocus(),
        );
      },
    );

    it("keeps the focus in Teilen after the link is deleted, so Enter does not close it", async () => {
      const onDeleteViewLink = vi.fn(async () => {
        rerender(deletableShell(onDeleteViewLink, []));
        return {};
      });
      const { confirmation, rerender } = await askToDelete(onDeleteViewLink);

      await userEvent.click(
        within(confirmation).getByRole("button", {
          name: "Endgültig löschen",
        }),
      );

      await waitFor(() => expect(shareDialog()).toHaveFocus());
      await userEvent.keyboard("{Enter}");
      expect(shareDialog()).toBeInTheDocument();
      expect(within(shareDialog()).queryByText("Leitstelle")).toBeNull();
    });

    it.each([
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])("keeps both dialogs open %s while deleting", async (_, cancel) => {
      const onDeleteViewLink = vi.fn(() => new Promise<ActionResult>(() => {}));
      const { confirmation } = await askToDelete(onDeleteViewLink);

      await userEvent.click(
        within(confirmation).getByRole("button", {
          name: "Endgültig löschen",
        }),
      );
      await cancel();

      expect(onDeleteViewLink).toHaveBeenCalledWith("1");
      expect(confirmation).toBeInTheDocument();
      expect(shareDialog()).toBeInTheDocument();
    });
  });

  it("shows no connection-lost symbol on either header size while connected", () => {
    renderShell({ connected: true });
    for (const testId of HEADER_TEST_IDS) {
      expect(
        header(testId).queryByRole("button", { name: CONNECTION_LOST_LABEL }),
      ).toBeNull();
    }
  });

  it("shows an orange connection-lost symbol on both header sizes when disconnected, each with a popover explaining it, and no banner", async () => {
    renderShell({ connected: false });
    expect(screen.queryByRole("status")).toBeNull();
    for (const testId of HEADER_TEST_IDS) {
      const button = header(testId).getByRole("button", {
        name: CONNECTION_LOST_LABEL,
      });
      await userEvent.click(button);
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(CONNECTION_LOST_LABEL),
      ).toBeInTheDocument();
      await userEvent.click(button);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });
});
