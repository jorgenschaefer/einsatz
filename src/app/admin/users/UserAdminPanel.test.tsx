import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import {
  type AccountSummary,
  UserAdminPanel,
  type UserAdminPanelProps,
} from "./UserAdminPanel";

const accounts: AccountSummary[] = [
  { id: "a1", username: "chef", role: "admin" },
  { id: "u1", username: "anna", role: "user" },
];

function setup(over: Partial<UserAdminPanelProps> = {}) {
  const props: UserAdminPanelProps = {
    accounts,
    onCreate: vi.fn(async () => ({})),
    onSetRole: vi.fn(async () => ({})),
    onResetPassword: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    ...over,
  };
  render(<UserAdminPanel {...props} />);
  return props;
}

const rowOf = (username: string) => {
  const row = [
    ...document.querySelectorAll<HTMLElement>("[data-account]"),
  ].find((r) => within(r).queryByText(username));
  if (!row) throw new Error(`no account row for ${username}`);
  return row;
};

describe("UserAdminPanel", () => {
  it("lists each account with its role", () => {
    setup();
    expect(within(rowOf("chef")).getByText(/admin/i)).toBeInTheDocument();
    expect(within(rowOf("anna")).getByText(/nutzer|user/i)).toBeInTheDocument();
  });

  it("creates an account", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Nutzername/), {
      target: { value: "bob" },
    });
    fireEvent.change(screen.getByLabelText(/Start-Passwort/), {
      target: { value: "a-good-password" },
    });
    await userEvent.click(screen.getByLabelText(/Administrator/));
    await userEvent.click(
      screen.getByRole("button", { name: "Konto anlegen" }),
    );
    expect(props.onCreate).toHaveBeenCalledWith("bob", "a-good-password", true);
  });

  it("promotes a user and demotes an admin", async () => {
    const props = setup();
    await userEvent.click(
      within(rowOf("anna")).getByRole("button", { name: /Zu Admin/ }),
    );
    expect(props.onSetRole).toHaveBeenCalledWith("u1", "admin");
    await userEvent.click(
      within(rowOf("chef")).getByRole("button", { name: /Zu Nutzer/ }),
    );
    expect(props.onSetRole).toHaveBeenCalledWith("a1", "user");
  });

  describe("deleting an account", () => {
    const askToDelete = async (username = "anna") => {
      await userEvent.click(
        within(rowOf(username)).getByRole("button", { name: "Löschen" }),
      );
      return screen.findByRole("dialog", { name: "Konto löschen" });
    };
    const confirmButton = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", { name: "Endgültig löschen" });

    it("asks in a dialog and deletes only once confirmed", async () => {
      const onDelete = vi.fn(async () => ({}));
      setup({ onDelete });

      const dialog = await askToDelete("anna");

      expect(dialog).toHaveTextContent(
        "Das Konto anna wird unwiderruflich gelöscht.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");
      expect(onDelete).not.toHaveBeenCalled();

      await userEvent.click(confirmButton(dialog));

      expect(onDelete).toHaveBeenCalledWith("u1");
      expect(onDelete).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByRole("alert")).toBeNull();
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
      const dialog = await askToDelete("anna");

      await cancel(dialog);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onDelete).not.toHaveBeenCalled();
      expect(rowOf("anna")).toBeInTheDocument();
    });

    it("keeps the account name while the cancelled confirmation fades out", async () => {
      // Without env="test", so the modal keeps its exit transition.
      rtlRender(
        <MantineProvider>
          <UserAdminPanel
            accounts={accounts}
            onCreate={vi.fn()}
            onSetRole={vi.fn()}
            onResetPassword={vi.fn()}
            onDelete={vi.fn()}
          />
        </MantineProvider>,
      );
      const dialog = await askToDelete("anna");

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      expect(dialog).toHaveTextContent(
        "Das Konto anna wird unwiderruflich gelöscht.",
      );
    });

    it("dismisses an earlier error above the account list when asking", async () => {
      const onSetRole = vi.fn(async () => ({
        error:
          "Der letzte verbleibende Admin kann nicht zum Nutzer degradiert werden.",
      }));
      setup({ onSetRole });
      await userEvent.click(
        within(rowOf("chef")).getByRole("button", { name: /Zu Nutzer/ }),
      );
      await screen.findByRole("alert");

      await askToDelete("anna");

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("stays locked while deleting", async () => {
      const onDelete = vi.fn(() => new Promise<ActionResult>(() => {}));
      setup({ onDelete });
      const dialog = await askToDelete("anna");

      await userEvent.click(confirmButton(dialog));
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();
      await userEvent.click(confirmButton(dialog), { pointerEventsCheck: 0 });

      expect(confirmButton(dialog)).toHaveAttribute("data-loading", "true");
      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("deletes on a second confirmation after a failure", async () => {
      const onDelete = vi
        .fn<(id: string) => Promise<ActionResult>>()
        .mockResolvedValueOnce({ error: "Konto nicht gefunden." })
        .mockResolvedValueOnce({});
      setup({ onDelete });
      const dialog = await askToDelete("anna");

      await userEvent.click(confirmButton(dialog));
      await within(dialog).findByRole("alert");
      await userEvent.click(confirmButton(dialog));

      expect(onDelete).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "a returned error",
        async () => ({
          error: "Der letzte verbleibende Admin kann nicht gelöscht werden.",
        }),
        "Der letzte verbleibende Admin kann nicht gelöscht werden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation, not above the account list",
      async (_, onDelete, message) => {
        setup({ onDelete });
        const dialog = await askToDelete("chef");

        await userEvent.click(confirmButton(dialog));

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
          message,
        );
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("dialog")).toBe(dialog);
        expect(rowOf("chef")).toBeInTheDocument();
        expect(confirmButton(dialog)).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );
  });

  it("disables the create button while creation is in flight", async () => {
    let resolveCreate!: (r: { error?: string }) => void;
    const onCreate = vi.fn(
      () => new Promise<{ error?: string }>((res) => (resolveCreate = res)),
    );
    setup({ onCreate });
    fireEvent.change(screen.getByLabelText(/Nutzername/), {
      target: { value: "bob" },
    });
    fireEvent.change(screen.getByLabelText(/Start-Passwort/), {
      target: { value: "a-good-password" },
    });
    const button = screen.getByRole("button", { name: "Konto anlegen" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(onCreate).toHaveBeenCalledTimes(1);
    resolveCreate({});
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("resets a password inline", async () => {
    const props = setup();
    await userEvent.click(
      within(rowOf("anna")).getByRole("button", {
        name: /Passwort zurücksetzen/,
      }),
    );
    fireEvent.change(within(rowOf("anna")).getByLabelText(/Neues Passwort/), {
      target: { value: "reset-password-1" },
    });
    await userEvent.click(
      within(rowOf("anna")).getByRole("button", { name: "Setzen" }),
    );
    expect(props.onResetPassword).toHaveBeenCalledWith(
      "u1",
      "reset-password-1",
    );
  });

  it("shows the error an action returns (e.g. last-admin protection)", async () => {
    const onSetRole = vi.fn(async () => ({
      error:
        "Der letzte verbleibende Admin kann nicht zum Nutzer degradiert werden.",
    }));
    setup({ onSetRole });
    await userEvent.click(
      within(rowOf("chef")).getByRole("button", { name: /Zu Nutzer/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /letzte verbleibende Admin/,
    );
  });
});
