import userEvent from "@testing-library/user-event";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
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
  it("lets a long name without spaces wrap, with the row aligned at the top", () => {
    const longName = `${"Einsatzabschnitt".repeat(5)}.kml`;
    renderPanel({
      overlays: [
        { ...urlOverlay, name: longName },
        { ...fileOverlay, name: longName },
      ],
    });

    for (const id of ["k1", "k2"]) {
      const row = screen.getByTestId(`kml-${id}`);
      expect(within(row).getByText(longName)).toHaveStyle({
        overflowWrap: "anywhere",
      });
      expect(row.firstElementChild).toHaveStyle({
        "--group-align": "flex-start",
      });
    }
  });

  it("lets the row wrap, with the name growing and the buttons right-aligned", () => {
    renderPanel({ overlays: [urlOverlay, fileOverlay] });

    for (const id of ["k1", "k2"]) {
      const row = screen.getByTestId(`kml-${id}`);
      expect(row.firstElementChild).toHaveStyle({ "--group-wrap": "wrap" });
      expect(row.querySelector(".mantine-Switch-root")).toHaveStyle({
        flex: "1 1 auto",
        maxWidth: "100%",
      });
      expect(
        within(row).getByRole("button", { name: "Entfernen" }).parentElement,
      ).toHaveStyle({ marginLeft: "auto" });
    }
  });

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

  describe("removing an overlay", () => {
    const askToRemove = async () => {
      await userEvent.click(
        within(screen.getByTestId("kml-k2")).getByRole("button", {
          name: "Entfernen",
        }),
      );
      return screen.findByRole("dialog", {
        name: "KML-Overlay „Zonen“ entfernen",
      });
    };

    const confirmButton = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", { name: "Entfernen" });

    it("asks for confirmation first and removes only once confirmed", async () => {
      const onRemove = vi.fn(async () => ({}));
      renderPanel({ overlays: [urlOverlay, fileOverlay], onRemove });

      const dialog = await askToRemove();

      expect(onRemove).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Um es wieder anzuzeigen, muss die Datei oder URL neu eingebunden werden.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");

      await userEvent.click(confirmButton(dialog));

      expect(onRemove).toHaveBeenCalledWith("k2");
      expect(onRemove).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each([
      [
        "with Abbrechen",
        (dialog: HTMLElement) =>
          userEvent.click(
            within(dialog).getByRole("button", { name: "Abbrechen" }),
          ),
      ],
      ["on Escape", () => userEvent.keyboard("{Escape}")],
      ["on a click beside the confirmation", () => clickModalOverlay()],
    ])("does not remove when cancelled %s", async (_, cancel) => {
      const onRemove = vi.fn(async () => ({}));
      renderPanel({ overlays: [fileOverlay], onRemove });
      const dialog = await askToRemove();

      await cancel(dialog);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onRemove).not.toHaveBeenCalled();
      expect(screen.getByTestId("kml-k2")).toBeInTheDocument();
    });

    it.each([
      [
        "a returned error",
        async () => ({ error: "KML-Overlay nicht gefunden." }),
        "KML-Overlay nicht gefunden.",
      ],
      [
        "a thrown failure",
        async (): Promise<ActionResult> => {
          throw new Error("offline");
        },
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      ],
    ])(
      "shows %s in the open confirmation, not atop the panel",
      async (_, onRemove, message) => {
        renderPanel({ overlays: [fileOverlay], onRemove });
        const dialog = await askToRemove();

        await userEvent.click(confirmButton(dialog));

        const alerts = await screen.findAllByRole("alert");
        expect(alerts).toHaveLength(1);
        expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
        expect(screen.getByTestId("kml-k2")).toBeInTheDocument();
        expect(confirmButton(dialog)).toBeEnabled();
        expect(
          within(dialog).getByRole("button", { name: "Abbrechen" }),
        ).toBeEnabled();
      },
    );

    it("returns focus to the Entfernen button when the first confirmation is cancelled", async () => {
      renderPanel({ overlays: [fileOverlay] });
      await askToRemove();

      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(
          within(screen.getByTestId("kml-k2")).getByRole("button", {
            name: "Entfernen",
          }),
        ).toHaveFocus(),
      );
    });

    it("clears an earlier panel error once the overlay is removed", async () => {
      const onReload = vi.fn(async () => ({
        error: "KML konnte nicht geladen werden (404).",
      }));
      renderPanel({ overlays: [urlOverlay, fileOverlay], onReload });
      await userEvent.click(
        within(screen.getByTestId("kml-k1")).getByRole("button", {
          name: "Neu laden",
        }),
      );
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      const dialog = await askToRemove();

      await userEvent.click(confirmButton(dialog));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps an earlier panel error when the removal fails", async () => {
      const onReload = vi.fn(async () => ({
        error: "KML konnte nicht geladen werden (404).",
      }));
      const onRemove = vi.fn(async () => ({ error: "Gesperrt." }));
      renderPanel({ overlays: [urlOverlay, fileOverlay], onReload, onRemove });
      await userEvent.click(
        within(screen.getByTestId("kml-k1")).getByRole("button", {
          name: "Neu laden",
        }),
      );
      await screen.findByRole("alert");
      const dialog = await askToRemove();

      await userEvent.click(confirmButton(dialog));

      expect(
        await screen.findByText("KML konnte nicht geladen werden (404)."),
      ).toBeInTheDocument();
    });

    it("stays locked while removing", async () => {
      const onRemove = vi.fn(() => new Promise<ActionResult>(() => {}));
      renderPanel({ overlays: [fileOverlay], onRemove });
      const dialog = await askToRemove();

      await userEvent.click(confirmButton(dialog));
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();
      await userEvent.click(confirmButton(dialog), { pointerEventsCheck: 0 });

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
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
