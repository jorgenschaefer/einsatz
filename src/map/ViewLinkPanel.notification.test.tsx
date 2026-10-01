import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { act, render, screen, waitFor, within } from "@/test/render";
import { ViewLinkPanel, type ViewLinkPanelProps } from "./ViewLinkPanel";

const CLOSED = "Einsatz ist geschlossen.";
const leitstelle = { id: "1", label: "Leitstelle", token: "tok-a" };

function setup(over: Partial<ViewLinkPanelProps> = {}) {
  const props: ViewLinkPanelProps = {
    links: [leitstelle],
    onCreate: vi.fn(async () => ({ error: CLOSED })),
    onDelete: vi.fn(async () => ({})),
    ...over,
  };
  render(
    <div data-testid="panel">
      <ViewLinkPanel {...props} />
    </div>,
  );
  return props;
}

const create = () =>
  userEvent.click(
    screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
  );

async function askToDelete() {
  await userEvent.click(
    screen.getByRole("button", { name: "Leitstelle löschen" }),
  );
  return screen.findByRole("dialog", {
    name: "Ansichtslink „Leitstelle“ löschen",
  });
}

describe("ViewLinkPanel notifications", () => {
  it("shows a failure as a notification titled Ansichtslinks, not atop the panel", async () => {
    setup();

    await create();

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Ansichtslinks");
    expect(notification).toHaveTextContent(CLOSED);
    expect(screen.getByTestId("panel")).not.toContainElement(notification);
  });

  it("keeps the notification while typing a label", async () => {
    setup();
    await create();
    await screen.findByRole("alert");

    await userEvent.type(screen.getByLabelText(/Bezeichnung/i), "Leitstelle");

    expect(screen.getByRole("alert")).toHaveTextContent(CLOSED);
  });

  describe("while the deletion is being confirmed", () => {
    async function failCreationBehindConfirmation() {
      let fail: (result: ActionResult) => void = () => {};
      setup({
        onCreate: vi.fn(
          () => new Promise<ActionResult>((resolve) => (fail = resolve)),
        ),
      });
      await create();
      const dialog = await askToDelete();
      await act(async () => fail({ error: CLOSED }));
      return dialog;
    }

    it("shows a failure that arrives as a notification outside the dialog", async () => {
      const dialog = await failCreationBehindConfirmation();

      const notification = await screen.findByRole("alert");
      expect(notification).toHaveTextContent("Ansichtslinks");
      expect(notification).toHaveTextContent(CLOSED);
      expect(dialog).not.toContainElement(notification);
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("lets its close button close the notification with the dialog open", async () => {
      await failCreationBehindConfirmation();

      await userEvent.click(
        within(await screen.findByRole("alert")).getByRole("button", {
          name: "Meldung schließen",
        }),
      );

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes the notification once the deletion is confirmed", async () => {
      const dialog = await failCreationBehindConfirmation();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });
});
