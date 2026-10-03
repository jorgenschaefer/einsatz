import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { MapControls } from "./MapControls";

function renderControls(
  over: Partial<React.ComponentProps<typeof MapControls>> = {},
) {
  const props = {
    onReturnToDefault: vi.fn(),
    canReturnToDefault: true,
    ...over,
  };
  render(<MapControls {...props} />);
  return props;
}

const column = () => screen.getByRole("group", { name: "Kartenknöpfe" });

describe("MapControls", () => {
  it("holds only the return to the default view", () => {
    renderControls();
    expect(
      within(column())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Zum Standard-Ausschnitt zurück"]);
  });

  it("returns to the default view", async () => {
    const { onReturnToDefault } = renderControls();
    await userEvent.click(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    );
    expect(onReturnToDefault).toHaveBeenCalled();
  });

  it("disables the return without a default view", () => {
    renderControls({ canReturnToDefault: false });
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });
});
