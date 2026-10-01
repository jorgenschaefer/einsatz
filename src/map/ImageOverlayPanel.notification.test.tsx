import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { ImageOverlayPanel } from "./ImageOverlayPanel";

const TOO_BIG = "Die Datei ist größer als 20 MB.";

describe("ImageOverlayPanel notifications", () => {
  it("shows a failure as a notification titled Bild-Overlays, not atop the panel", async () => {
    render(
      <div data-testid="panel">
        <ImageOverlayPanel
          overlays={[{ id: "i1", name: "Lageplan", visible: true }]}
          onAdd={vi.fn(async () => ({ error: TOO_BIG }))}
          onToggleVisibility={vi.fn(async () => ({}))}
          onEdit={vi.fn()}
        />
      </div>,
    );

    await userEvent.upload(
      screen.getByLabelText(/Bild-Overlay einbinden/),
      new File(["x"], "big.png", { type: "image/png" }),
    );

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Bild-Overlays");
    expect(notification).toHaveTextContent(TOO_BIG);
    expect(screen.getByTestId("panel")).not.toContainElement(notification);
  });
});
