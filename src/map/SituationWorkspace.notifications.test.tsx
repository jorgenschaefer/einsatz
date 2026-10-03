import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { clickModalCloseButton } from "@/test/modal-close-button";
import { render, screen, waitFor, within } from "@/test/render";
import { anImageOverlay } from "./map-objects.fixtures";
import { SituationWorkspace } from "./SituationWorkspace";
import {
  buildProps,
  mapPanel,
  openPanel,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

const NOT_FOUND = "KML konnte nicht geladen werden (404).";

const failingKmlReload = {
  kmlOverlays: [
    {
      id: "k1",
      name: "Laufstrecke",
      sourceType: "url" as const,
      visible: true,
      content: "<kml/>",
    },
  ],
  imageOverlays: [anImageOverlay],
  onReloadKml: vi.fn(async () => ({ error: NOT_FOUND })),
};

async function failKmlReload() {
  await openPanel("Ebenen");
  await userEvent.click(
    within(mapPanel("Ebenen")).getByRole("button", { name: "Neu laden" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("KML-Ebenen");
}

const expectKmlNotification = () =>
  expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND);

describe("SituationWorkspace notifications", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("closes its notifications when the Lageansicht is left", async () => {
    const { props } = buildProps(failingKmlReload);
    const { rerender } = render(<SituationWorkspace {...props} />);
    await failKmlReload();

    rerender(<p>Einsätze</p>);

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows no notification for an action that fails after the Lageansicht is left", async () => {
    let fail = (_result: { error: string }) => {};
    const { props } = buildProps({
      ...failingKmlReload,
      onReloadKml: vi.fn(
        () =>
          new Promise<{ error: string }>((resolve) => {
            fail = resolve;
          }),
      ),
    });
    const { rerender } = render(<SituationWorkspace {...props} />);
    await openPanel("Ebenen");
    await userEvent.click(
      within(mapPanel("Ebenen")).getByRole("button", { name: "Neu laden" }),
    );

    rerender(<p>Einsätze</p>);
    fail({ error: NOT_FOUND });

    await screen.findByText("Einsätze");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("keep a KML-Ebenen notification standing", () => {
    it("through an action in the Bild-Overlays panel", async () => {
      renderWorkspace(failingKmlReload);
      await failKmlReload();

      await userEvent.click(
        within(mapPanel("Ebenen")).getByRole("switch", { name: "Lageplan" }),
      );

      expectKmlNotification();
    });

    it("when the panel changes on the desktop", async () => {
      stubMatchMedia(true);
      renderWorkspace(failingKmlReload);
      await failKmlReload();

      await userEvent.click(
        screen.getByLabelText("Bereiche", { selector: "button" }),
      );

      expect(screen.queryByRole("region", { name: "Ebenen" })).toBeNull();
      expectKmlNotification();
    });

    it("when the sheet is closed on a phone", async () => {
      stubMatchMedia(false);
      renderWorkspace(failingKmlReload);
      await failKmlReload();

      await userEvent.click(
        within(mapPanel("Ebenen")).getByLabelText("Schließen", {
          selector: "button",
        }),
      );

      expect(screen.queryByRole("region", { name: "Ebenen" })).toBeNull();
      expectKmlNotification();
    });

    it("when switching to the ETB and back on a phone", async () => {
      stubMatchMedia(false);
      renderWorkspace(failingKmlReload);
      await failKmlReload();

      await selectMainView("ETB");
      expectKmlNotification();
      await selectMainView("Lagekarte");

      expectKmlNotification();
    });
  });

  it("keeps an Ansichtslinks notification standing when the share dialog closes", async () => {
    renderWorkspace({
      onCreateViewLink: vi.fn(async () => ({
        error: "Einsatz ist geschlossen.",
      })),
    });
    await userEvent.click(
      within(screen.getByTestId("desktop-header")).getByRole("button", {
        name: "Menü",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Teilen" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Ansichtslinks teilen",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Ansichtslink erzeugen" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Ansichtslinks");

    await clickModalCloseButton(dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Einsatz ist geschlossen.",
    );
  });
});
