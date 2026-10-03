import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { act, screen, waitFor, within } from "@/test/render";
import type { ImagePlacement } from "./image-overlay";
import { anImageOverlay } from "./map-objects.fixtures";
import {
  mapPanel,
  modeBand,
  openImageEditor,
  renderWorkspace,
  scaleOnMap,
} from "./SituationWorkspace.fixtures";

const NOT_FOUND = "Bild-Overlay nicht gefunden.";

type FakeAdapter = ReturnType<typeof renderWorkspace>["adapter"];

const imageOverlaysNotification = () =>
  screen
    .queryAllByRole("alert")
    .find((alert) => alert.textContent?.includes("Bild-Overlays")) ?? null;

describe("SituationWorkspace saving a Bild-Overlay placement", () => {
  it.each([
    ["returns an error", async () => ({ error: NOT_FOUND }), NOT_FOUND],
    [
      "throws",
      async (): Promise<ActionResult> => {
        throw new Error("offline");
      },
      "Das hat nicht geklappt. Bitte erneut versuchen.",
    ],
  ])(
    "puts the image back on its saved placement and notifies when saving %s",
    async (_, onUpdateImagePlacement, message) => {
      const { adapter } = renderWorkspace({
        imageOverlays: [anImageOverlay],
        onUpdateImagePlacement,
      });
      await openImageEditor();

      await scaleOnMap(adapter);

      await waitFor(() =>
        expect(imageOverlaysNotification()).toHaveTextContent(message),
      );
      expect(within(mapPanel("Ebenen")).queryByRole("alert")).toBeNull();
      expect(adapter.restoreImageOverlay).toHaveBeenCalledWith("i1");
    },
  );

  it("keeps the new placement when saving succeeds", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement: vi.fn(async () => ({})),
    });
    await openImageEditor();

    await scaleOnMap(adapter);

    expect(adapter.restoreImageOverlay).not.toHaveBeenCalled();
    expect(imageOverlaysNotification()).toBeNull();
  });

  it("locks the editor while a placement is being saved", async () => {
    let finishSaving = () => {};
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement: () =>
        new Promise<ActionResult>((resolve) => {
          finishSaving = () => resolve({});
        }),
    });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)![1] as (
      placement: ImagePlacement,
    ) => void;

    act(() => {
      onChange({ ...anImageOverlay.placement, scaleM: 800 });
    });

    const editor = within(mapPanel("Ebenen"));
    expect(
      editor.getByRole("button", { name: "Datei ersetzen" }),
    ).toBeDisabled();
    expect(editor.getByRole("button", { name: "Fertig" })).toBeDisabled();
    await act(async () => finishSaving());
    expect(editor.getByRole("button", { name: "Fertig" })).toBeEnabled();
  });

  it("clears a failed opacity change from the editor once a new placement is saved", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement: vi
        .fn(async (): Promise<ActionResult> => ({}))
        .mockRejectedValueOnce(new Error("offline")),
    });
    await openImageEditor();
    const slider = screen.getByRole("slider", { name: "Deckkraft" });
    act(() => slider.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(
      await within(mapPanel("Ebenen")).findByRole("alert"),
    ).toBeInTheDocument();

    await scaleOnMap(adapter);

    expect(within(mapPanel("Ebenen")).queryByRole("alert")).toBeNull();
  });

  describe("closes the Bild-Overlays notification", () => {
    const failThenSucceed = () =>
      vi
        .fn(
          async (
            _id: string,
            _placement: ImagePlacement,
          ): Promise<ActionResult> => ({}),
        )
        .mockResolvedValueOnce({ error: NOT_FOUND });

    const failPlacement = async () => {
      const { adapter } = renderWorkspace({
        imageOverlays: [anImageOverlay],
        onUpdateImagePlacement: failThenSucceed(),
        onDeleteImage: vi.fn(async () => ({})),
      });
      await openImageEditor();
      await scaleOnMap(adapter);
      await waitFor(() => expect(imageOverlaysNotification()).not.toBeNull());
      return adapter;
    };

    it.each([
      [
        "a new placement is saved",
        (adapter: FakeAdapter) => scaleOnMap(adapter),
      ],
      [
        "the opacity changes",
        async () => {
          const slider = screen.getByRole("slider", { name: "Deckkraft" });
          act(() => slider.focus());
          await userEvent.keyboard("{ArrowRight}");
        },
      ],
      [
        "the file is replaced",
        () =>
          userEvent.upload(
            screen.getByLabelText("Datei ersetzen"),
            new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" }),
          ),
      ],
      [
        "deleting is confirmed",
        async () => {
          await userEvent.click(
            within(mapPanel("Ebenen")).getByRole("button", { name: "Löschen" }),
          );
          const dialog = await screen.findByRole("dialog", {
            name: "Bild-Overlay löschen",
          });
          await userEvent.click(
            within(dialog).getByRole("button", { name: "Endgültig löschen" }),
          );
        },
      ],
      [
        "Fertig is tapped in the editor",
        () => userEvent.click(within(mapPanel("Ebenen")).getByText("Fertig")),
      ],
      [
        "Fertig is tapped in the band",
        () =>
          userEvent.click(
            within(modeBand("Bild-Overlay bearbeiten")).getByText("Fertig"),
          ),
      ],
    ])("when %s", async (_, perform) => {
      const adapter = await failPlacement();

      await perform(adapter);

      await waitFor(() => expect(imageOverlaysNotification()).toBeNull());
    });
  });
});
