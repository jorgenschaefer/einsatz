import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { render, screen } from "@/test/render";
import { AreaEditorModal } from "./AreaEditorModal";
import type { RenderedArea } from "./SituationMap";

const AREA: RenderedArea = {
  id: "a1",
  geometry: { shape: "circle", center: { lat: 53.5, lng: 9.9 }, radius: 100 },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

describe("AreaEditorModal", () => {
  it("locks Speichern while saving", async () => {
    render(
      <AreaEditorModal
        area={AREA}
        onClose={vi.fn()}
        onUpdateAreaStyle={() => new Promise<ActionResult>(() => {})}
        onUpdateAreaGeometry={vi.fn(async () => ({}))}
        onDeleteArea={vi.fn(async () => ({}))}
        onRedraw={vi.fn()}
        onMoveCircle={vi.fn()}
      />,
    );
    const save = await screen.findByRole("button", { name: "Speichern" });
    await userEvent.click(save);
    expect(save).toBeDisabled();
  });
});
