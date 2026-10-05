import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, screen, waitFor } from "@/test/render";
import type { ImagePlacement } from "./image-overlay";
import { renderMapHook } from "./map-hooks.fixtures";
import { anImageOverlay } from "./map-objects.fixtures";
import { useImageOverlayEditing } from "./useImageOverlayEditing";

type SavingPlacement = (
  id: string,
  placement: ImagePlacement,
) => Promise<ActionResult>;

const NOT_FOUND = "Bild-Overlay nicht gefunden.";
const FAILURE = "Das hat nicht geklappt. Bitte erneut versuchen.";
const SCALED = { ...anImageOverlay.placement, scaleM: 800 };

const offline = async (): Promise<ActionResult> => {
  throw new Error("offline");
};

function renderImageEditing({
  onUpdateImagePlacement = vi.fn<SavingPlacement>(async () => ({})),
  onReplaceImage = vi.fn(async (_id: string, _file: File) => ({})),
  onDeleteImage = vi.fn(async (_id: string): Promise<ActionResult> => ({})),
} = {}) {
  const restoreImagePlacement = vi.fn();
  const rendered = renderMapHook(
    ({ mode }) =>
      useImageOverlayEditing({
        imageOverlays: [anImageOverlay],
        mode,
        onUpdateImagePlacement,
        onReplaceImage,
        onDeleteImage,
        restoreImagePlacement,
      }),
    {},
  );
  const editing = () => rendered.result.current.result;
  act(() => editing().startEditImage("i1"));
  return {
    editing,
    mode: () => rendered.result.current.mode,
    onUpdateImagePlacement,
    onReplaceImage,
    onDeleteImage,
    restoreImagePlacement,
  };
}

type ImageEditing = ReturnType<typeof renderImageEditing>;

/** Saves a placement, as the end of a gesture on the map does. */
const scaleOnMap = (hook: ImageEditing) =>
  act(() => hook.editing().saveImagePlacement("i1", SCALED));

const changeOpacity = (hook: ImageEditing) =>
  act(async () => hook.editing().changeImageOpacity(0.9));

const imageOverlaysNotification = () =>
  screen
    .queryAllByRole("alert")
    .find((alert) => alert.textContent?.includes("Bild-Overlays")) ?? null;

describe("useImageOverlayEditing", () => {
  it("starts editing the Bild-Overlay", () => {
    const hook = renderImageEditing();

    expect(hook.mode().editingImageId).toBe("i1");
    expect(hook.editing().editingImage).toBe(anImageOverlay);
  });

  it("saves the placement from a map gesture without leaving edit mode", async () => {
    const hook = renderImageEditing();

    await scaleOnMap(hook);

    expect(hook.onUpdateImagePlacement).toHaveBeenCalledWith("i1", SCALED);
    expect(hook.mode().editingImageId).toBe("i1");
  });

  it("changes only the opacity of the saved placement", async () => {
    const hook = renderImageEditing();

    await changeOpacity(hook);

    expect(hook.onUpdateImagePlacement).toHaveBeenCalledWith("i1", {
      ...anImageOverlay.placement,
      opacity: 0.9,
    });
    expect(hook.mode().editingImageId).toBe("i1");
  });

  it.each([
    ["saved", async () => ({}), true],
    ["refused", async () => ({ error: "Nicht gefunden." }), false],
  ])("reports whether the opacity was %s", async (_, save, saved) => {
    const hook = renderImageEditing({ onUpdateImagePlacement: vi.fn(save) });
    let result: boolean | undefined;

    await act(async () => {
      result = await hook.editing().changeImageOpacity(0.9);
    });

    expect(result).toBe(saved);
  });

  it("replaces the file of the Bild-Overlay being edited, and keeps editing", async () => {
    const hook = renderImageEditing();
    const file = new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" });

    await act(async () => hook.editing().replaceImage(file));

    expect(hook.onReplaceImage).toHaveBeenCalledWith("i1", file);
    expect(hook.mode().editingImageId).toBe("i1");
  });

  it.each([
    ["returns an error", async () => ({ error: NOT_FOUND }), NOT_FOUND],
    ["throws", offline, FAILURE],
  ])(
    "shows in the editor, without a notification, when replacing the file %s, and keeps editing",
    async (_, onReplaceImage, message) => {
      const hook = renderImageEditing({
        onReplaceImage: vi.fn(onReplaceImage),
      });

      await act(async () => hook.editing().replaceImage(new File([""], "x")));

      await waitFor(() => expect(hook.editing().error).toBe(message));
      expect(hook.editing().busy).toBe(false);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(hook.mode().editingImageId).toBe("i1");
    },
  );

  it("finishes editing", () => {
    const hook = renderImageEditing();

    act(() => hook.editing().finishEdit());

    expect(hook.mode().editingImageId).toBeNull();
    expect(hook.editing().editingImage).toBeNull();
  });

  describe("saving a placement", () => {
    it.each([
      ["returns an error", async () => ({ error: NOT_FOUND }), NOT_FOUND],
      ["throws", offline, FAILURE],
    ])(
      "puts the image back on its saved placement and notifies when saving %s",
      async (_, onUpdateImagePlacement, message) => {
        const hook = renderImageEditing({
          onUpdateImagePlacement: vi.fn(onUpdateImagePlacement),
        });

        await scaleOnMap(hook);

        await waitFor(() =>
          expect(imageOverlaysNotification()).toHaveTextContent(message),
        );
        expect(hook.editing().error).toBeNull();
        expect(hook.restoreImagePlacement).toHaveBeenCalledWith("i1");
      },
    );

    it("keeps the new placement when saving succeeds", async () => {
      const hook = renderImageEditing();

      await scaleOnMap(hook);

      expect(hook.restoreImagePlacement).not.toHaveBeenCalled();
      expect(imageOverlaysNotification()).toBeNull();
    });

    it("is busy while a placement is being saved", async () => {
      let finishSaving = () => {};
      const hook = renderImageEditing({
        onUpdateImagePlacement: vi.fn<SavingPlacement>(
          () =>
            new Promise((resolve) => {
              finishSaving = () => resolve({});
            }),
        ),
      });

      act(() => {
        void hook.editing().saveImagePlacement("i1", SCALED);
      });

      expect(hook.editing().busy).toBe(true);
      await act(async () => finishSaving());
      expect(hook.editing().busy).toBe(false);
    });

    it("clears a failed opacity change once a new placement is saved", async () => {
      const hook = renderImageEditing({
        onUpdateImagePlacement: vi
          .fn<SavingPlacement>(async () => ({}))
          .mockImplementationOnce(offline),
      });
      await changeOpacity(hook);
      await waitFor(() => expect(hook.editing().error).toBe(FAILURE));

      await scaleOnMap(hook);

      expect(hook.editing().error).toBeNull();
    });
  });

  describe("when saving does not come back with a result", () => {
    it("shows the failure of an opacity change in the editor and stays usable", async () => {
      const hook = renderImageEditing({
        onUpdateImagePlacement: vi.fn(offline),
      });

      await changeOpacity(hook);

      await waitFor(() => expect(hook.editing().error).toBe(FAILURE));
      expect(hook.editing().busy).toBe(false);
      expect(hook.mode().editingImageId).toBe("i1");
    });

    it("forgets the failure once editing is finished and started again", async () => {
      const hook = renderImageEditing({
        onUpdateImagePlacement: vi.fn(offline),
      });
      await changeOpacity(hook);
      await waitFor(() => expect(hook.editing().error).toBe(FAILURE));

      act(() => hook.editing().finishEdit());
      act(() => hook.editing().startEditImage("i1"));

      expect(hook.editing().error).toBeNull();
    });

    it.each([
      ["scaling it on the map", scaleOnMap],
      ["changing the opacity", changeOpacity],
    ])(
      "shows no failure when %s redirects to the login",
      async (_, perform) => {
        const action = vi.fn<SavingPlacement>(async () => {
          throw redirectError();
        });
        const hook = renderImageEditing({ onUpdateImagePlacement: action });

        await perform(hook);

        await waitFor(() => expect(action).toHaveBeenCalled());
        expect(screen.queryByRole("alert")).toBeNull();
        expect(hook.editing().error).toBeNull();
      },
    );
  });

  describe("deleting", () => {
    it("deletes the Bild-Overlay and ends editing it", async () => {
      const hook = renderImageEditing();

      await act(async () => {
        await hook.editing().deleteImage("i1");
      });

      expect(hook.onDeleteImage).toHaveBeenCalledWith("i1");
      expect(hook.mode().editingImageId).toBeNull();
    });

    it("hands back a returned error and keeps editing", async () => {
      const hook = renderImageEditing({
        onDeleteImage: vi.fn(async () => ({ error: NOT_FOUND })),
      });

      let result: ActionResult | undefined;
      await act(async () => {
        result = await hook.editing().deleteImage("i1");
      });

      expect(result).toEqual({ error: NOT_FOUND });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(hook.mode().editingImageId).toBe("i1");
    });

    it("lets a thrown failure through and keeps editing", async () => {
      const hook = renderImageEditing({ onDeleteImage: vi.fn(offline) });

      await act(() =>
        expect(hook.editing().deleteImage("i1")).rejects.toThrow("offline"),
      );

      expect(hook.mode().editingImageId).toBe("i1");
    });
  });

  describe("closes the Bild-Overlays notification", () => {
    const failPlacementFirst = async () => {
      const hook = renderImageEditing({
        onUpdateImagePlacement: vi
          .fn<SavingPlacement>(async () => ({}))
          .mockResolvedValueOnce({ error: NOT_FOUND }),
      });
      await scaleOnMap(hook);
      await waitFor(() => expect(imageOverlaysNotification()).not.toBeNull());
      return hook;
    };

    it.each([
      ["a new placement is saved", scaleOnMap],
      ["the opacity changes", changeOpacity],
      [
        "the file is replaced",
        (hook: ImageEditing) =>
          act(async () =>
            hook.editing().replaceImage(new File(["%PDF-1.4"], "neu.pdf")),
          ),
      ],
      [
        "the Bild-Overlay is deleted",
        (hook: ImageEditing) =>
          act(async () => {
            await hook.editing().deleteImage("i1");
          }),
      ],
      [
        "editing is finished",
        (hook: ImageEditing) => act(() => hook.editing().finishEdit()),
      ],
    ])("when %s", async (_, perform) => {
      const hook = await failPlacementFirst();

      await perform(hook);

      await waitFor(() => expect(imageOverlaysNotification()).toBeNull());
    });
  });
});
