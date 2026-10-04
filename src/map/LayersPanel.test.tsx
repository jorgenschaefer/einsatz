import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@/test/render";
import { LayersPanel } from "./LayersPanel";
import { anImageOverlay } from "./map-objects.fixtures";

type LayersPanelProps = ComponentProps<typeof LayersPanel>;

const KML = {
  id: "k1",
  name: "Zonen",
  sourceType: "file" as const,
  visible: true,
  content: "<kml/>",
};

function renderPanel(over: Partial<LayersPanelProps> = {}) {
  const props: LayersPanelProps = {
    kmlOverlays: [KML],
    onAddKmlFile: vi.fn(async () => ({})),
    onAddKmlUrl: vi.fn(async () => ({})),
    onSetKmlVisibility: vi.fn(async () => ({})),
    onReloadKml: vi.fn(async () => ({})),
    onRemoveKml: vi.fn(async () => ({})),
    imageOverlays: [anImageOverlay],
    editingImageId: null,
    onAddImage: vi.fn(async () => ({})),
    onSetImageVisibility: vi.fn(async () => ({})),
    onEditImage: vi.fn(),
    imageEditing: anImageEditing(null),
    ...over,
  };
  render(<LayersPanel {...props} />);
  return props;
}

const editing = (over: Partial<LayersPanelProps["imageEditing"]> = {}) => ({
  editingImageId: "i1",
  imageEditing: { ...anImageEditing(anImageOverlay), ...over },
});

function anImageEditing(
  editingImage: LayersPanelProps["imageEditing"]["editingImage"],
): LayersPanelProps["imageEditing"] {
  return {
    editingImage,
    busy: false,
    error: null,
    changeImageOpacity: vi.fn(),
    replaceImage: vi.fn(),
    deleteImage: vi.fn(async () => ({})),
    finishEdit: vi.fn(),
  };
}

const follows = (first: HTMLElement, second: HTMLElement) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe("LayersPanel", () => {
  it("splits into KML-Datei, KML-URL and Bild-Overlays sections in order", () => {
    renderPanel();

    const file = screen.getByRole("region", { name: "KML-Datei" });
    const url = screen.getByRole("region", { name: "KML-URL" });
    const image = screen.getByRole("region", { name: "Bild-Overlays" });
    expect(follows(file, url)).toBe(true);
    expect(follows(url, image)).toBe(true);
  });

  it("toggles a KML-Ebene and a Bild-Overlay and starts editing a Bild-Overlay", async () => {
    const props = renderPanel();

    await userEvent.click(screen.getByRole("switch", { name: /Zonen/ }));
    await userEvent.click(screen.getByRole("switch", { name: /Lageplan/ }));
    await userEvent.click(screen.getByRole("button", { name: /Bearbeiten/ }));

    expect(props.onSetKmlVisibility).toHaveBeenCalledWith("k1", false);
    expect(props.onSetImageVisibility).toHaveBeenCalledWith("i1", false);
    expect(props.onEditImage).toHaveBeenCalledWith("i1");
  });

  it("removes a KML-Ebene once confirmed", async () => {
    const props = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    const dialog = await screen.findByRole("dialog", {
      name: "KML-Overlay „Zonen“ entfernen",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Entfernen" }),
    );

    expect(props.onRemoveKml).toHaveBeenCalledWith("k1");
  });

  it("shows no editor while no Bild-Overlay is edited", () => {
    renderPanel();

    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
  });

  describe("editing a Bild-Overlay", () => {
    it("shows its opacity, and changes it", async () => {
      const props = renderPanel(editing());
      const slider = screen.getByRole("slider", { name: "Deckkraft" });
      expect(slider).toHaveAttribute("aria-valuenow", "80");

      act(() => slider.focus());
      await userEvent.keyboard("{ArrowRight}");

      expect(props.imageEditing.changeImageOpacity).toHaveBeenCalled();
    });

    it("replaces its file and finishes editing", async () => {
      const props = renderPanel(editing());
      const file = new File(["%PDF-1.4"], "neu.pdf", {
        type: "application/pdf",
      });

      await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
      await userEvent.click(screen.getByRole("button", { name: "Fertig" }));

      expect(props.imageEditing.replaceImage).toHaveBeenCalledWith(file);
      expect(props.imageEditing.finishEdit).toHaveBeenCalled();
    });

    it("deletes the edited Bild-Overlay once confirmed", async () => {
      const props = renderPanel(editing());

      await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
      const dialog = await screen.findByRole("dialog", {
        name: "Bild-Overlay löschen",
      });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      );

      expect(props.imageEditing.deleteImage).toHaveBeenCalledWith("i1");
    });

    it("locks the editor while busy and shows the error", () => {
      renderPanel(
        editing({ busy: true, error: "Bild-Overlay nicht gefunden." }),
      );

      expect(
        screen.getByRole("button", { name: "Datei ersetzen" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Fertig" })).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Bild-Overlay nicht gefunden.",
      );
    });
  });
});
