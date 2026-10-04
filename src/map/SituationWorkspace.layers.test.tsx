import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@/test/render";
import { anImageOverlay } from "./map-objects.fixtures";
import {
  mapPanel,
  modeBand,
  openImageEditor,
  openPanel,
  renderWorkspace,
  scaleOnMap,
  startEditingImage,
} from "./SituationWorkspace.fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SituationWorkspace", () => {
  it("renders each visible KML overlay on the map as a layer", async () => {
    const { adapter } = renderWorkspace({
      kmlOverlays: [
        {
          id: "k1",
          name: "Laufstrecke",
          sourceType: "url",
          visible: true,
          content: "<kml/>",
        },
        {
          id: "k2",
          name: "Zonen",
          sourceType: "file",
          visible: false,
          content: "<kml2/>",
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: true,
      }),
    );
    expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k2", {
      content: "<kml2/>",
      visible: false,
    });
  });

  it("opens the Ebenen panel and toggles overlay visibility", async () => {
    const onSetKmlVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      kmlOverlays: [
        {
          id: "k1",
          name: "Laufstrecke",
          sourceType: "url",
          visible: true,
          content: "<kml/>",
        },
      ],
      onSetKmlVisibility,
    });
    await openPanel("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Laufstrecke/ }),
    );
    expect(onSetKmlVisibility).toHaveBeenCalledWith("k1", false);
  });

  it("renders each visible image overlay on the map", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await waitFor(() =>
      expect(adapter.setImageOverlay).toHaveBeenCalledWith("i1", {
        imageUrl: "/img/i1",
        placement: anImageOverlay.placement,
        aspect: 1.5,
        visible: true,
      }),
    );
  });

  it("opens the Ebenen panel and toggles image overlay visibility", async () => {
    const onSetImageVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onSetImageVisibility,
    });
    await openPanel("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Lageplan/ }),
    );
    expect(onSetImageVisibility).toHaveBeenCalledWith("i1", false);
  });

  it("saves the placement from a map gesture", async () => {
    const onUpdateImagePlacement = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)![1] as (
      p: unknown,
    ) => void;
    const moved = { ...anImageOverlay.placement, scaleM: 800, rotationDeg: 42 };
    await act(async () => onChange(moved));
    expect(onUpdateImagePlacement).toHaveBeenCalledWith("i1", moved);
  });

  it("puts a Bild-Overlay back on the map when saving its placement fails", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement: vi.fn(async () => ({
        error: "Bild-Overlay nicht gefunden.",
      })),
    });
    await openImageEditor();

    await scaleOnMap(adapter);

    await waitFor(() =>
      expect(adapter.restoreImageOverlay).toHaveBeenCalledWith("i1"),
    );
  });

  it("closes the Bild-Overlays notification when editing is finished in the band", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement: vi.fn(async () => ({
        error: "Bild-Overlay nicht gefunden.",
      })),
    });
    await openImageEditor();
    await scaleOnMap(adapter);
    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Bild-Overlays");

    await userEvent.click(
      within(modeBand("Bild-Overlay bearbeiten")).getByText("Fertig"),
    );

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows the Bild-Overlay band while editing and finishes editing from it", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await userEvent.click(
      within(modeBand("Bild-Overlay bearbeiten")).getByText("Fertig"),
    );
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("keeps editing the image overlay when the Ebenen panel is opened", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await openPanel("Kartenzeichen");
    await openPanel("Ebenen");
    expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
    expect(
      await screen.findByRole("slider", { name: "Deckkraft" }),
    ).toBeInTheDocument();
    expect(adapter.stopImageOverlayEdit).not.toHaveBeenCalled();
  });

  describe("when saving an edited image overlay does not come back with a result", () => {
    const replace = () =>
      userEvent.upload(
        screen.getByLabelText("Datei ersetzen"),
        new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" }),
      );

    it("shows the failure in the editor when replacing the file throws and leaves it usable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("offline");
        }),
      );
      renderWorkspace({ imageOverlays: [anImageOverlay] });
      await openImageEditor();

      await replace();

      const panel = within(mapPanel("Ebenen"));
      expect(await panel.findByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
      expect(
        panel.getByRole("button", { name: "Datei ersetzen" }),
      ).toBeEnabled();
      expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
    });

    it("goes to the login without a failure when replacing the file meets no session", async () => {
      const assign = vi.fn();
      vi.stubGlobal("location", { assign });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 401 })),
      );
      renderWorkspace({ imageOverlays: [anImageOverlay] });
      await openImageEditor();

      await replace();

      await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("confirming in the Ebenen panel", () => {
    const askToDeleteImage = async () => {
      await userEvent.click(
        within(mapPanel("Ebenen")).getByRole("button", { name: "Löschen" }),
      );
      return screen.findByRole("dialog", { name: "Bild-Overlay löschen" });
    };

    it("deletes a Bild-Overlay only once confirmed and ends editing it", async () => {
      const onDeleteImage = vi.fn(async () => ({}));
      const { adapter } = renderWorkspace({
        imageOverlays: [anImageOverlay],
        onDeleteImage,
      });
      await openImageEditor();
      const dialog = await askToDeleteImage();
      expect(onDeleteImage).not.toHaveBeenCalled();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Endgültig löschen" }),
      );

      expect(onDeleteImage).toHaveBeenCalledWith("i1");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled();
      expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
    });

    it("removes a KML-Overlay only once confirmed", async () => {
      const onRemoveKml = vi.fn(async () => ({}));
      renderWorkspace({
        kmlOverlays: [
          {
            id: "k1",
            name: "Zonen",
            sourceType: "file",
            visible: true,
            content: "<kml/>",
          },
        ],
        onRemoveKml,
      });
      await openPanel("Ebenen");
      await userEvent.click(
        within(mapPanel("Ebenen")).getByRole("button", { name: "Entfernen" }),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "KML-Overlay „Zonen“ entfernen",
      });
      expect(onRemoveKml).not.toHaveBeenCalled();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Entfernen" }),
      );

      expect(onRemoveKml).toHaveBeenCalledWith("k1");
    });
  });
});
