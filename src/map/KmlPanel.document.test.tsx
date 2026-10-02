import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { KmlPanel } from "./KmlPanel";

const NOT_KML = "Die Adresse liefert keine KML-Datei.";

describe("KmlPanel with a URL that delivers no KML", () => {
  it("shows that the address delivers no KML file and keeps Name and URL", async () => {
    render(
      <KmlPanel
        overlays={[]}
        onAddFile={vi.fn(async () => ({}))}
        onAddUrl={vi.fn(async () => ({ error: NOT_KML }))}
        onToggleVisibility={vi.fn(async () => ({}))}
        onReload={vi.fn(async () => ({}))}
        onRemove={vi.fn(async () => ({}))}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Pegel" },
    });
    fireEvent.change(screen.getByLabelText("KML-/KMZ-URL"), {
      target: { value: "https://maps.example/pegel" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Per URL einbinden" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_KML);
    expect(screen.getByLabelText("Name")).toHaveValue("Pegel");
    expect(screen.getByLabelText("KML-/KMZ-URL")).toHaveValue(
      "https://maps.example/pegel",
    );
  });
});
