import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, notificationArea, render, screen } from "@/test/render";
import {
  type ChangePasswordAction,
  ChangePasswordForm,
} from "./ChangePasswordForm";

describe("ChangePasswordForm", () => {
  it("submits the current and the new password", async () => {
    const action = vi.fn<ChangePasswordAction>(async () => ({ success: true }));
    render(<ChangePasswordForm action={action} />);
    fireEvent.change(screen.getByLabelText(/Aktuelles Passwort/), {
      target: { value: "the-old-password" },
    });
    fireEvent.change(screen.getByLabelText(/Neues Passwort/), {
      target: { value: "a-brand-new-pass" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort ändern" }),
    );
    expect(action.mock.calls[0][1].get("currentPassword")).toBe(
      "the-old-password",
    );
    expect(action.mock.calls[0][1].get("password")).toBe("a-brand-new-pass");
  });

  it("shows the validation error the action returns in the form", async () => {
    const action = vi.fn<ChangePasswordAction>(async () => ({
      error: "Das Passwort muss mindestens 12 Zeichen haben.",
    }));
    render(<ChangePasswordForm action={action} />);
    fireEvent.change(screen.getByLabelText(/Aktuelles Passwort/), {
      target: { value: "the-old-password" },
    });
    fireEvent.change(screen.getByLabelText(/Neues Passwort/), {
      target: { value: "short" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort ändern" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/mindestens 12 Zeichen/);
    expect(notificationArea()).not.toContainElement(alert);
  });

  it("confirms success", async () => {
    const action = vi.fn<ChangePasswordAction>(async () => ({ success: true }));
    render(<ChangePasswordForm action={action} />);
    fireEvent.change(screen.getByLabelText(/Aktuelles Passwort/), {
      target: { value: "the-old-password" },
    });
    fireEvent.change(screen.getByLabelText(/Neues Passwort/), {
      target: { value: "a-brand-new-pass" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort ändern" }),
    );
    expect(await screen.findByText(/geändert/)).toBeInTheDocument();
  });
});
