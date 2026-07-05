import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { type LoginAction, LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("renders username and password fields and a submit button", () => {
    render(<LoginForm action={async () => ({})} />);
    expect(screen.getByLabelText(/Nutzername/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Passwort/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anmelden" }),
    ).toBeInTheDocument();
  });

  it("shows the generic error the action returns", async () => {
    const action = vi.fn<LoginAction>(async () => ({
      error: "Anmeldung fehlgeschlagen.",
    }));
    render(<LoginForm action={action} />);

    await userEvent.type(screen.getByLabelText(/Nutzername/), "anna");
    await userEvent.type(screen.getByLabelText(/Passwort/), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(
      await screen.findByText("Anmeldung fehlgeschlagen."),
    ).toBeInTheDocument();
  });

  it("submits the entered credentials to the action", async () => {
    const action = vi.fn<LoginAction>(async () => ({}));
    render(<LoginForm action={action} />);

    await userEvent.type(screen.getByLabelText(/Nutzername/), "anna");
    await userEvent.type(screen.getByLabelText(/Passwort/), "a-good-password");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(action).toHaveBeenCalled();
    const formData = action.mock.calls[0][1];
    expect(formData.get("username")).toBe("anna");
    expect(formData.get("password")).toBe("a-good-password");
  });
});
