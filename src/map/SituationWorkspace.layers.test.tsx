import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, screen, waitFor, within } from "@/test/render";
import type { ImagePlacement } from "./image-overlay";
import {
  anImageOverlay,
  mapPanel,
  modeBand,
  openImageEditor,
  openPanel,
  renderWorkspace,
  startEditingImage,
} from "./SituationWorkspace.fixtures";

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

  it("splits the Ebenen panel into KML-Datei, KML-URL and Bild-Overlays sections in order", async () => {
    renderWorkspace();
    await openPanel("Ebenen");
    const file = screen.getByRole("region", { name: "KML-Datei" });
    const url = screen.getByRole("region", { name: "KML-URL" });
    const image = screen.getByRole("region", { name: "Bild-Overlays" });
    expect(
      file.compareDocumentPosition(url) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      url.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it("edits an image overlay: shows handles on the map and the inline controls", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalledWith(
        "i1",
        expect.any(Function),
      ),
    );
    expect(within(mapPanel("Ebenen")).getByText("Fertig")).toBeInTheDocument();
  });

  it("saves the placement from a map gesture without leaving edit mode", async () => {
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
    // Bearbeiten bleibt aktiv.
    expect(within(mapPanel("Ebenen")).getByText("Fertig")).toBeInTheDocument();
  });

  it("changes the opacity from the inline controls", async () => {
    const onUpdateImagePlacement = vi.fn(
      async (_id: string, _placement: ImagePlacement) => ({}),
    );
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openImageEditor();
    const slider = await screen.findByRole("slider", { name: "Deckkraft" });
    act(() => slider.focus());
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(onUpdateImagePlacement).toHaveBeenCalled());
    const [, placement] = onUpdateImagePlacement.mock.calls.at(-1)!;
    expect(placement.opacity).toBeGreaterThan(0.8);
    expect(placement.scaleM).toBe(anImageOverlay.placement.scaleM);
  });

  it("replaces the file of an image overlay, keeping it in edit mode", async () => {
    const onReplaceImage = vi.fn(async () => ({}));
    renderWorkspace({ imageOverlays: [anImageOverlay], onReplaceImage });
    await openImageEditor();
    const file = new File(["%PDF-1.4"], "neu.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
    expect(onReplaceImage).toHaveBeenCalledWith("i1", file);
  });

  it("finishes editing, removing the handles from the map", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    await userEvent.click(within(mapPanel("Ebenen")).getByText("Fertig"));
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
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
    const moveOnMap = async (
      adapter: ReturnType<typeof renderWorkspace>["adapter"],
    ) => {
      await waitFor(() =>
        expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
      );
      const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)![1] as (
        p: unknown,
      ) => void;
      await act(async () =>
        onChange({ ...anImageOverlay.placement, scaleM: 800 }),
      );
    };
    const changeOpacity = async () => {
      const slider = await screen.findByRole("slider", { name: "Deckkraft" });
      act(() => slider.focus());
      await userEvent.keyboard("{ArrowRight}");
    };
    const replace = () =>
      userEvent.upload(
        screen.getByLabelText("Datei ersetzen"),
        new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" }),
      );

    const userActions: [
      string,
      "onUpdateImagePlacement" | "onReplaceImage",
      (adapter: ReturnType<typeof renderWorkspace>["adapter"]) => Promise<void>,
    ][] = [
      ["moving it on the map", "onUpdateImagePlacement", moveOnMap],
      ["changing the opacity", "onUpdateImagePlacement", changeOpacity],
      ["replacing the file", "onReplaceImage", replace],
    ];

    it.each(userActions)(
      "shows the failure in the editor when %s throws and leaves it usable",
      async (_, prop, perform) => {
        const { adapter } = renderWorkspace({
          imageOverlays: [anImageOverlay],
          [prop]: vi.fn(async () => {
            throw new Error("offline");
          }),
        });
        await openImageEditor();

        await perform(adapter);

        const panel = within(mapPanel("Ebenen"));
        expect(await panel.findByRole("alert")).toHaveTextContent(
          "Das hat nicht geklappt. Bitte erneut versuchen.",
        );
        expect(
          panel.getByRole("button", { name: "Datei ersetzen" }),
        ).toBeEnabled();
        expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
      },
    );

    it.each([
      ["the band", () => modeBand("Bild-Overlay bearbeiten")],
      ["the Ebenen panel", () => mapPanel("Ebenen")],
    ])(
      "forgets the failure once editing is finished from %s",
      async (_, finishFrom) => {
        const { adapter } = renderWorkspace({
          imageOverlays: [anImageOverlay],
          onUpdateImagePlacement: vi.fn(async () => {
            throw new Error("offline");
          }),
        });
        await openImageEditor();
        await moveOnMap(adapter);
        expect(
          await within(mapPanel("Ebenen")).findByRole("alert"),
        ).toBeInTheDocument();

        await userEvent.click(within(finishFrom()).getByText("Fertig"));
        await openPanel("Ebenen"); // schließt das noch offene Panel
        await openImageEditor();

        expect(within(mapPanel("Ebenen")).queryByRole("alert")).toBeNull();
      },
    );

    it.each(userActions)(
      "shows no failure when %s redirects to the login",
      async (_, prop, perform) => {
        const action = vi.fn(async () => {
          throw redirectError();
        });
        const { adapter } = renderWorkspace({
          imageOverlays: [anImageOverlay],
          [prop]: action,
        });
        await openImageEditor();

        await perform(adapter);

        await waitFor(() => expect(action).toHaveBeenCalled());
        expect(screen.queryByRole("alert")).toBeNull();
      },
    );
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

    it.each([
      [
        "a returned error",
        async () => ({ error: "Bild-Overlay nicht gefunden." }),
        "Bild-Overlay nicht gefunden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation and keeps editing the Bild-Overlay",
      async (_, onDeleteImage, message) => {
        const { adapter } = renderWorkspace({
          imageOverlays: [anImageOverlay],
          onDeleteImage,
        });
        await openImageEditor();
        const dialog = await askToDeleteImage();

        await userEvent.click(
          within(dialog).getByRole("button", { name: "Endgültig löschen" }),
        );

        expect(screen.getAllByRole("alert")).toEqual([
          within(dialog).getByRole("alert"),
        ]);
        expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
        expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
        expect(adapter.stopImageOverlayEdit).not.toHaveBeenCalled();
      },
    );

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
