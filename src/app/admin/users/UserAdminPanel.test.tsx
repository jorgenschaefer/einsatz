import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

const rowOf = (username: string) =>
  screen.getByText(username).closest("[data-account]") as HTMLElement;

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

  it("requires explicit confirmation before deleting an account", async () => {
    const props = setup();
    await userEvent.click(
      within(rowOf("anna")).getByRole("button", { name: "Löschen" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/anna/)).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Endgültig löschen/ }),
    );
    expect(props.onDelete).toHaveBeenCalledWith("u1");
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const props = setup();
    await userEvent.click(
      within(rowOf("anna")).getByRole("button", { name: "Löschen" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Abbrechen" }),
    );
    expect(props.onDelete).not.toHaveBeenCalled();
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
