import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import { render, screen, within } from "@/test/render";
import { MapControls, type MapPanel } from "./MapControls";

function renderControls(
  over: Partial<React.ComponentProps<typeof MapControls>> = {},
) {
  const props = {
    openPanel: null as MapPanel | null,
    onTogglePanel: vi.fn(),
    onSetDefault: vi.fn(async (): Promise<ActionResult> => ({})),
    onReturnToDefault: vi.fn(),
    canReturnToDefault: true,
    ...over,
  };
  render(<MapControls {...props} />);
  return props;
}

const column = () => screen.getByRole("group", { name: "Kartenknöpfe" });

describe("MapControls", () => {
  it("lists the map controls from top to bottom", () => {
    renderControls();
    expect(
      within(column())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Kartenzeichen",
      "Bereiche",
      "Ebenen",
      "Standard-Ausschnitt festlegen",
      "Zum Standard-Ausschnitt zurück",
    ]);
  });

  it("marks the open panel's control as pressed", () => {
    renderControls({ openPanel: "areas" });
    expect(screen.getByRole("button", { name: "Bereiche" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Kartenzeichen" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the tapped panel control", async () => {
    const { onTogglePanel } = renderControls();
    await userEvent.click(screen.getByRole("button", { name: "Ebenen" }));
    expect(onTogglePanel).toHaveBeenCalledWith("layers");
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

  it("saves the default view only after confirming", async () => {
    const { onSetDefault } = renderControls();
    await userEvent.click(
      screen.getByRole("button", { name: "Standard-Ausschnitt festlegen" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Aktuellen Ausschnitt als Standard festlegen?",
    });
    expect(onSetDefault).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Festlegen" }),
    );

    expect(onSetDefault).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not save on Abbrechen", async () => {
    const { onSetDefault } = renderControls();
    await userEvent.click(
      screen.getByRole("button", { name: "Standard-Ausschnitt festlegen" }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Abbrechen",
      }),
    );

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSetDefault).not.toHaveBeenCalled();
  });

  it("keeps the confirmation open and shows the error when saving fails", async () => {
    renderControls({
      onSetDefault: vi.fn(async () => ({ error: "Ungültiger Ausschnitt." })),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Standard-Ausschnitt festlegen" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Festlegen" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Ungültiger Ausschnitt.",
    );
  });

  it("shows a fallback when saving throws", async () => {
    renderControls({
      onSetDefault: vi.fn(async () => {
        throw new Error("DB weg");
      }),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Standard-Ausschnitt festlegen" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Festlegen" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    );
  });
});
