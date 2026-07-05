import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@/test/render";
import { type KmlOverlayView, KmlPanel, type KmlPanelProps } from "./KmlPanel";

function renderPanel(over: Partial<KmlPanelProps> = {}) {
  const props: KmlPanelProps = {
    overlays: [],
    onAddFile: vi.fn(async () => ({})),
    onAddUrl: vi.fn(async () => ({})),
    onToggleVisibility: vi.fn(async () => ({})),
    onReload: vi.fn(async () => ({})),
    onRemove: vi.fn(async () => ({})),
    ...over,
  };
  render(<KmlPanel {...props} />);
  return props;
}

const urlOverlay: KmlOverlayView = {
  id: "k1",
  name: "Laufstrecke",
  sourceType: "url",
  visible: true,
};
const fileOverlay: KmlOverlayView = {
  id: "k2",
  name: "Zonen",
  sourceType: "file",
  visible: false,
};

describe("KmlPanel", () => {
  it("shows an empty hint when there are no overlays", () => {
    renderPanel();
    expect(screen.getByText(/Keine KML-Overlays/)).toBeInTheDocument();
  });

  it("adds a KML by URL", async () => {
    const onAddUrl = vi.fn(async () => ({}));
    renderPanel({ onAddUrl });
    await userEvent.type(screen.getByLabelText("Name"), "Laufstrecke");
    await userEvent.type(
      screen.getByLabelText("KML-URL"),
      "https://maps.example/x.kml",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Per URL einbinden" }),
    );
    expect(onAddUrl).toHaveBeenCalledWith(
      "Laufstrecke",
      "https://maps.example/x.kml",
    );
  });

  it("adds a KML by file, reading its content client-side", async () => {
    const onAddFile = vi.fn(async () => ({}));
    renderPanel({ onAddFile });
    const file = new File(["<kml><name>Zonen</name></kml>"], "zonen.kml", {
      type: "application/vnd.google-earth.kml+xml",
    });
    await userEvent.upload(screen.getByLabelText(/KML-Datei/), file);
    await waitFor(() =>
      expect(onAddFile).toHaveBeenCalledWith(
        "zonen.kml",
        "<kml><name>Zonen</name></kml>",
      ),
    );
  });

  it("toggles visibility of an overlay", async () => {
    const onToggleVisibility = vi.fn(async () => ({}));
    renderPanel({ overlays: [urlOverlay], onToggleVisibility });
    await userEvent.click(screen.getByRole("switch", { name: /Laufstrecke/ }));
    expect(onToggleVisibility).toHaveBeenCalledWith("k1", false);
  });

  it("offers reload only for URL sources", async () => {
    const onReload = vi.fn(async () => ({}));
    renderPanel({ overlays: [urlOverlay, fileOverlay], onReload });
    const urlRow = within(screen.getByTestId("kml-k1"));
    await userEvent.click(urlRow.getByRole("button", { name: "Neu laden" }));
    expect(onReload).toHaveBeenCalledWith("k1");
    expect(
      within(screen.getByTestId("kml-k2")).queryByRole("button", {
        name: "Neu laden",
      }),
    ).toBeNull();
  });

  it("removes an overlay", async () => {
    const onRemove = vi.fn(async () => ({}));
    renderPanel({ overlays: [fileOverlay], onRemove });
    await userEvent.click(
      within(screen.getByTestId("kml-k2")).getByRole("button", {
        name: "Entfernen",
      }),
    );
    expect(onRemove).toHaveBeenCalledWith("k2");
  });

  it("surfaces an action error", async () => {
    const onAddUrl = vi.fn(async () => ({
      error: "KML konnte nicht geladen werden (404).",
    }));
    renderPanel({ onAddUrl });
    await userEvent.type(screen.getByLabelText("Name"), "X");
    await userEvent.type(
      screen.getByLabelText("KML-URL"),
      "https://maps.example/missing.kml",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Per URL einbinden" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "KML konnte nicht geladen werden (404).",
    );
  });
});
