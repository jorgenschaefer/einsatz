import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import {
  OperationLifecycleActions,
  type OperationLifecycleActionsProps,
} from "./OperationLifecycleActions";

function setup(over: Partial<OperationLifecycleActionsProps> = {}) {
  const props: OperationLifecycleActionsProps = {
    status: "active",
    onClose: vi.fn(),
    onReopen: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<OperationLifecycleActions {...props} />);
  return props;
}

const openMenu = () =>
  userEvent.click(screen.getByRole("button", { name: /Einsatz-Aktionen/ }));

describe("OperationLifecycleActions", () => {
  it("closes an active Einsatz from the menu", async () => {
    const props = setup({ status: "active" });
    await openMenu();
    expect(
      screen.queryByRole("menuitem", { name: /Wieder öffnen/ }),
    ).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Abschließen/ }),
    );
    expect(props.onClose).toHaveBeenCalled();
  });

  it("reopens a closed Einsatz from the menu", async () => {
    const props = setup({ status: "closed" });
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /Abschließen/ })).toBeNull();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Wieder öffnen/ }),
    );
    expect(props.onReopen).toHaveBeenCalled();
  });

  it("requires explicit confirmation before deleting, warning about the Einsatztagebuch", async () => {
    const props = setup();
    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    expect(await screen.findByText(/Einsatztagebuch/)).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /Endgültig löschen/ }),
    );
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const props = setup();
    await openMenu();
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Abbrechen" }),
    );
    expect(props.onDelete).not.toHaveBeenCalled();
  });
});
