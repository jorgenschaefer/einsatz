import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { screen, within } from "@/test/render";
import { AREA } from "./map-objects.fixtures";
import {
  mapPanel,
  openPanel,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";

describe("SituationWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the panel open on the desktop when Verschieben starts moving a circle", async () => {
    stubMatchMedia(true);
    renderWorkspace({ areas: [AREA] });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText("Deich bearbeiten", { selector: "button" }),
    );

    await userEvent.click(
      within(await screen.findByRole("dialog")).getByText("Verschieben"),
    );

    expect(
      screen.getByRole("toolbar", { name: "Kreis verschieben" }),
    ).toBeInTheDocument();
    expect(mapPanel("Bereiche")).toBeVisible();
  });
});
