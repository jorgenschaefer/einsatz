import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { PanelRow } from "./PanelRow";

describe("PanelRow", () => {
  it("offers copying next to editing when the row can be copied", async () => {
    const onCopy = vi.fn();
    render(
      <PanelRow
        icon={null}
        name="Bus 1"
        meta={null}
        onJump={vi.fn()}
        onEdit={vi.fn()}
        onCopy={onCopy}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Bus 1 kopieren" }),
    );
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("offers no copying when the row cannot be copied", () => {
    render(
      <PanelRow
        icon={null}
        name="Bus 1"
        meta={null}
        onJump={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Bus 1 bearbeiten" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /kopieren/ })).toBeNull();
  });
});
