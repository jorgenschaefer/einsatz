import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { notificationArea, screen, waitFor, within } from "@/test/render";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { openPanel, renderWorkspace } from "./SituationWorkspace.fixtures";

const uploadPlan = async () =>
  userEvent.upload(
    screen.getByLabelText(/Bild-Overlay einbinden/),
    new File(["%PNG"], "plan.png", { type: "image/png" }),
  );

describe("uploading a Bild-Overlay", () => {
  it("sends the map area the uploader sees along with the file", async () => {
    const extent = { lat: 53.55, lng: 9.99, widthM: 7200, heightM: 5400 };
    const { factory } = fakeMapAdapterFactory(undefined, extent);
    const onAddImage = vi.fn(async () => ({}));
    renderWorkspace({ factory, onAddImage });

    await openPanel("Ebenen");
    await uploadPlan();

    await waitFor(() =>
      expect(onAddImage).toHaveBeenCalledWith(
        expect.objectContaining({ name: "plan.png" }),
        extent,
      ),
    );
  });

  it("asks to try again and uploads nothing before the map has loaded", async () => {
    // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
    // noch keine Karte und damit keinen Ausschnitt.
    vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
    try {
      const onAddImage = vi.fn(async () => ({}));
      renderWorkspace({ factory: undefined, onAddImage });

      await openPanel("Ebenen");
      await uploadPlan();

      const notification = await within(notificationArea()).findByRole("alert");
      expect(notification).toHaveTextContent("Bild-Overlays");
      expect(notification).toHaveTextContent(
        "Die Karte lädt noch. Bitte erneut versuchen.",
      );
      expect(onAddImage).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./leaflet-adapter");
    }
  });
});
