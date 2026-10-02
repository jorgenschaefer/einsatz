import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, notificationArea, render, screen } from "@/test/render";
import { NewOperationForm, type OperationFormAction } from "./NewOperationForm";

describe("NewOperationForm", () => {
  it("renders a required Bezeichnung field and a submit button", () => {
    render(<NewOperationForm action={async () => ({})} />);
    expect(screen.getByLabelText(/Bezeichnung/)).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Einsatz eröffnen" }),
    ).toBeInTheDocument();
  });

  it("submits the entered Bezeichnung and Beschreibung", async () => {
    const action = vi.fn<OperationFormAction>(async () => ({}));
    render(<NewOperationForm action={action} />);

    fireEvent.change(screen.getByLabelText(/Bezeichnung/), {
      target: { value: "Hochwasser" },
    });
    fireEvent.change(screen.getByLabelText(/Beschreibung/), {
      target: { value: "Deich Nord" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Einsatz eröffnen" }),
    );

    expect(action).toHaveBeenCalled();
    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("Hochwasser");
    expect(formData.get("description")).toBe("Deich Nord");
  });

  it("shows the validation error the action returns in the form", async () => {
    const action = vi.fn<OperationFormAction>(async () => ({
      error: "Die Bezeichnung darf nicht leer sein.",
    }));
    render(<NewOperationForm action={action} />);

    fireEvent.change(screen.getByLabelText(/Bezeichnung/), {
      target: { value: "Hochwasser" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Einsatz eröffnen" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Die Bezeichnung darf nicht leer sein.");
    expect(notificationArea()).not.toContainElement(alert);
  });
});
