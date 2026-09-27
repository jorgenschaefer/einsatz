import userEvent from "@testing-library/user-event";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@/test/render";
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
  it("groups the panel into a KML-Datei and a KML-URL section", () => {
    renderPanel();
    expect(
      screen.getByRole("region", { name: "KML-Datei" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "KML-URL" })).toBeInTheDocument();
  });

  it("shows a per-section empty hint when a section has no overlays", () => {
    renderPanel();
    expect(screen.getByText(/Noch keine KML-Datei/)).toBeInTheDocument();
    expect(screen.getByText(/Noch keine KML-URL/)).toBeInTheDocument();
  });

  it("lists each overlay under the section matching its source", () => {
    renderPanel({ overlays: [urlOverlay, fileOverlay] });
    const fileSection = within(
      screen.getByRole("region", { name: "KML-Datei" }),
    );
    expect(fileSection.getByTestId("kml-k2")).toBeInTheDocument();
    expect(fileSection.queryByTestId("kml-k1")).toBeNull();
    const urlSection = within(screen.getByRole("region", { name: "KML-URL" }));
    expect(urlSection.getByTestId("kml-k1")).toBeInTheDocument();
    expect(urlSection.queryByTestId("kml-k2")).toBeNull();
  });

  it("adds a KML by URL", async () => {
    const onAddUrl = vi.fn(async () => ({}));
    renderPanel({ onAddUrl });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Laufstrecke" },
    });
    fireEvent.change(screen.getByLabelText("KML-/KMZ-URL"), {
      target: { value: "https://maps.example/x.kml" },
    });
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
    await userEvent.upload(screen.getByLabelText(/Datei einbinden/), file);
    await waitFor(() =>
      expect(onAddFile).toHaveBeenCalledWith(
        "zonen.kml",
        "<kml><name>Zonen</name></kml>",
      ),
    );
  });

  it("unpacks a KMZ file client-side before adding it", async () => {
    const onAddFile = vi.fn(async () => ({}));
    renderPanel({ onAddFile });
    const kml = "<kml><name>Strecken</name></kml>";
    const kmz = zipSync({ "doc.kml": strToU8(kml) });
    const file = new File([kmz], "WTH26 all courses.kmz", {
      type: "application/vnd.google-earth.kmz",
    });
    await userEvent.upload(screen.getByLabelText(/Datei einbinden/), file);
    await waitFor(() =>
      expect(onAddFile).toHaveBeenCalledWith("WTH26 all courses.kmz", kml),
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
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("KML-/KMZ-URL"), {
      target: { value: "https://maps.example/missing.kml" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Per URL einbinden" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "KML konnte nicht geladen werden (404).",
    );
  });
});
