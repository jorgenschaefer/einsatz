import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { act, notificationArea, render, screen } from "@/test/render";
import { NameForm } from "./NameForm";

describe("NameForm", () => {
  function setup(
    onSubmit: (name: string) => Promise<ActionResult> = vi.fn(async () => ({})),
  ) {
    const props = { onSubmit, onSaved: vi.fn(), onCancel: vi.fn() };
    render(
      <NameForm
        label="Neuer Name"
        initial="UHSt 3"
        submitLabel="Speichern"
        {...props}
      />,
    );
    return {
      ...props,
      field: screen.getByRole("textbox", { name: "Neuer Name" }),
    };
  }

  const submit = () =>
    userEvent.click(screen.getByRole("button", { name: "Speichern" }));

  it("starts from the given name, with the focus in its field", () => {
    const { field } = setup();

    expect(field).toHaveValue("UHSt 3");
    expect(field).toHaveFocus();
  });

  it("submits the typed name and reports it saved", async () => {
    const { onSubmit, onSaved, field } = setup();

    await userEvent.type(field, " Nord");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith("UHSt 3 Nord");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter", async () => {
    const { onSubmit, field } = setup();

    await userEvent.type(field, " Nord{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("UHSt 3 Nord");
  });

  it("shows a returned error at the field, keeping the typed name and not saved", async () => {
    const { onSaved, field } = setup(
      vi.fn(async () => ({
        error: "Eine Stelle mit diesem Namen gibt es schon.",
      })),
    );

    await userEvent.clear(field);
    await userEvent.type(field, "Ziel");
    await submit();

    expect(field).toHaveAccessibleDescription(
      "Eine Stelle mit diesem Namen gibt es schon.",
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Eine Stelle mit diesem Namen gibt es schon.",
    );
    expect(notificationArea()).not.toContainElement(alert);
    expect(field).toHaveValue("Ziel");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows a failed save as an error at the field", async () => {
    const { onSaved, field } = setup(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await submit();

    expect(field).toHaveAccessibleDescription(
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("drops the error once saving succeeds", async () => {
    const onSubmit = vi
      .fn<(name: string) => Promise<ActionResult>>()
      .mockResolvedValueOnce({ error: "Der Name fehlt." })
      .mockResolvedValueOnce({});
    const { field } = setup(onSubmit);
    await submit();

    await submit();

    expect(field).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("locks the submit button until the name is saved", async () => {
    let saved = (_: ActionResult) => {};
    setup(
      vi.fn(() => new Promise<ActionResult>((resolve) => (saved = resolve))),
    );
    const button = screen.getByRole("button", { name: "Speichern" });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    await act(async () => saved({}));
    expect(button).toBeEnabled();
  });

  it("cancels without submitting", async () => {
    const { onSubmit, onCancel } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
