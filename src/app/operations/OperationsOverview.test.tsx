import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import {
  type OperationSummary,
  OperationsOverview,
} from "./OperationsOverview";

const noop = async () => ({});

function op(over: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op-1",
    name: "Hochwasser",
    description: null,
    status: "active",
    ...over,
  };
}

describe("OperationsOverview", () => {
  it("links to the Konto page", () => {
    render(<OperationsOverview operations={[]} createAction={noop} />);
    expect(screen.getByRole("link", { name: /Konto/ })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("logs out from the header", async () => {
    const onLogout = vi.fn(async () => {});
    render(
      <OperationsOverview
        operations={[]}
        createAction={noop}
        onLogout={onLogout}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Abmelden/ }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("shows an empty state and a way to open a new Einsatz when there are none", () => {
    render(<OperationsOverview operations={[]} createAction={noop} />);
    expect(screen.getByText(/noch kein einsatz/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Neuer Einsatz/ }),
    ).toBeInTheDocument();
  });

  it("lists each Einsatz as a link to its Lageansicht", () => {
    render(
      <OperationsOverview
        operations={[
          op({ id: "a", name: "Hochwasser" }),
          op({ id: "b", name: "Sturm" }),
        ]}
        createAction={noop}
      />,
    );
    expect(screen.getByRole("link", { name: /Hochwasser/ })).toHaveAttribute(
      "href",
      "/operations/a",
    );
    expect(screen.getByRole("link", { name: /Sturm/ })).toHaveAttribute(
      "href",
      "/operations/b",
    );
  });

  it('opens a create form when "Neuer Einsatz" is clicked', async () => {
    render(<OperationsOverview operations={[]} createAction={noop} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Neuer Einsatz/ }),
    );
    expect(await screen.findByLabelText(/Bezeichnung/)).toBeInTheDocument();
  });

  it("closes an Einsatz from its per-card menu", async () => {
    const onCloseOperation = vi.fn(async () => {});
    render(
      <OperationsOverview
        operations={[op({ id: "a" })]}
        createAction={noop}
        onCloseOperation={onCloseOperation}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Einsatz-Aktionen/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Abschließen/ }),
    );
    expect(onCloseOperation).toHaveBeenCalledWith("a");
  });

  it("deletes an Einsatz from its per-card menu after confirmation", async () => {
    const onDeleteOperation = vi.fn(async () => {});
    render(
      <OperationsOverview
        operations={[op({ id: "a" })]}
        createAction={noop}
        onDeleteOperation={onDeleteOperation}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Einsatz-Aktionen/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Einsatz löschen/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Endgültig löschen/ }),
    );
    expect(onDeleteOperation).toHaveBeenCalledWith("a");
  });

  it("routes each card menu to its own Einsatz", async () => {
    const onReopenOperation = vi.fn(async () => {});
    render(
      <OperationsOverview
        operations={[
          op({ id: "a", name: "Hochwasser", status: "closed" }),
          op({ id: "b", name: "Sturm", status: "closed" }),
        ]}
        createAction={noop}
        onReopenOperation={onReopenOperation}
      />,
    );
    const sturmCard = screen
      .getByText("Sturm")
      .closest('[class*="Card"]') as HTMLElement;
    await userEvent.click(
      within(sturmCard).getByRole("button", { name: /Einsatz-Aktionen/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Wieder öffnen/ }),
    );
    expect(onReopenOperation).toHaveBeenCalledWith("b");
  });
});
