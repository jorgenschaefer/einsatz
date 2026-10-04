import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@/test/render";
import { anImageOverlay } from "./map-objects.fixtures";
import {
  mapPanel,
  modeBand,
  openImageEditor,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SituationWorkspace", () => {
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
});
