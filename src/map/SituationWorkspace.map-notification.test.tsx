import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { stubMatchMedia } from "@/test/match-media";
import { act, render, screen, waitFor, within } from "@/test/render";
import { AREA, anImageOverlay } from "./map-objects.fixtures";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";
import {
  buildProps,
  mapPanel,
  modeBand,
  openPanel,
  renderWorkspace,
  selectMainView,
  startEditingImage,
} from "./SituationWorkspace.fixtures";

const INVALID = "Ungültige Zeichen-Komposition.";
const CLOSED = "Einsatz ist geschlossen.";

type Workspace = ReturnType<typeof renderWorkspace>;

async function armKtw() {
  await openPanel("Kartenzeichen");
  await userEvent.click(screen.getByText(/KTW/));
}

async function clickMap({ captured }: Workspace) {
  await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
  await act(async () => {
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
  });
}

async function failPlacing(over: Partial<SituationWorkspaceProps> = {}) {
  const workspace = renderWorkspace({
    imageOverlays: [anImageOverlay],
    onPlace: vi.fn(async () => ({ error: INVALID })),
    ...over,
  });
  await armKtw();
  await clickMap(workspace);
  expect(await screen.findByRole("alert")).toHaveTextContent(INVALID);
  return workspace;
}

async function moveCircle() {
  await openPanel("Bereiche");
  await userEvent.click(
    await screen.findByLabelText("Deich bearbeiten", { selector: "button" }),
  );
  await userEvent.click(
    within(await screen.findByRole("dialog")).getByText("Verschieben"),
  );
}

const setCircleHere = () =>
  userEvent.click(
    within(modeBand("Kreis verschieben")).getByText("Hier setzen"),
  );

async function failSettingCircle() {
  renderWorkspace({
    areas: [AREA],
    onUpdateAreaGeometry: vi.fn(async () => ({ error: CLOSED })),
  });
  await moveCircle();
  await setCircleHere();
  expect(await screen.findByRole("alert")).toHaveTextContent(CLOSED);
}

const expectNoNotification = () =>
  expect(screen.queryByRole("alert")).toBeNull();

const expectNotification = (message: string) =>
  expect(screen.getByRole("alert")).toHaveTextContent(message);

describe("SituationWorkspace map notification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a failed map action as a notification titled Karte, not on the map", async () => {
    await failPlacing();

    const notification = screen.getByRole("alert");
    expect(within(notification).getByText("Karte")).toBeInTheDocument();
    expect(
      within(document.querySelector(".map-area") as HTMLElement).queryByRole(
        "alert",
      ),
    ).toBeNull();
  });

  it("shows no notification when the map action succeeds", async () => {
    const onPlace = vi.fn(async () => ({}));
    const workspace = renderWorkspace({ onPlace });
    await armKtw();

    await clickMap(workspace);

    await waitFor(() => expect(onPlace).toHaveBeenCalled());
    expectNoNotification();
  });

  describe("closes the Karte notification", () => {
    it("when a Kartenzeichen is armed", async () => {
      await failPlacing();
      await armKtw();
      expectNoNotification();
    });

    it("when drawing begins", async () => {
      await failPlacing();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      expectNoNotification();
    });

    it("when editing a Bild-Overlay begins", async () => {
      await failPlacing();
      await startEditingImage();
      expectNoNotification();
    });

    it("when moving a circle begins", async () => {
      await failSettingCircle();
      await moveCircle();
      expectNoNotification();
    });

    it("when redrawing a Bereich begins", async () => {
      await failSettingCircle();
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText("Deich bearbeiten", {
          selector: "button",
        }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText(
          /Form neu zeichnen/,
        ),
      );
      expectNoNotification();
    });

    it("when moving a circle is cancelled", async () => {
      await failSettingCircle();
      await userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Abbrechen"),
      );
      expectNoNotification();
    });

    it("when editing a Bild-Overlay is finished with Fertig", async () => {
      let settle: (result: ActionResult) => void = () => {};
      const workspace = renderWorkspace({
        imageOverlays: [anImageOverlay],
        onPlace: vi.fn(
          () => new Promise<ActionResult>((resolve) => (settle = resolve)),
        ),
      });
      await armKtw();
      await clickMap(workspace);
      await startEditingImage();
      await act(async () => settle({ error: INVALID }));
      expectNotification(INVALID);

      await userEvent.click(
        within(modeBand("Bild-Overlay bearbeiten")).getByText("Fertig"),
      );

      expectNoNotification();
    });
  });

  describe("keeps the Karte notification standing", () => {
    it("when the map is moved or zoomed", async () => {
      const { captured } = await failPlacing();
      act(() => captured.options?.onViewChange?.({ lat: 9, lng: 9, zoom: 9 }));
      expectNotification(INVALID);
    });

    it("when a panel is opened or changed", async () => {
      await failPlacing();
      await openPanel("Bereiche");
      await openPanel("Ebenen");
      expectNotification(INVALID);
    });

    it("through an action in the KML panel", async () => {
      const onReloadKml = vi.fn(async () => ({}));
      await failPlacing({
        kmlOverlays: [
          {
            id: "k1",
            name: "Laufstrecke",
            sourceType: "url",
            visible: true,
            content: "<kml/>",
          },
        ],
        onReloadKml,
      });
      await openPanel("Ebenen");

      await userEvent.click(
        within(mapPanel("Ebenen")).getByRole("button", { name: "Neu laden" }),
      );

      await waitFor(() => expect(onReloadKml).toHaveBeenCalled());
      expectNotification(INVALID);
    });

    it("when the map is hidden on a phone while circle moving is armed, and shown again", async () => {
      stubMatchMedia(false);
      await failSettingCircle();

      await selectMainView("ETB");
      expectNotification(CLOSED);
      await selectMainView("Lagekarte");

      expectNotification(CLOSED);
      expect(
        screen.queryByRole("toolbar", { name: "Kreis verschieben" }),
      ).toBeNull();
    });

    it("when the circle that could not be set is deleted elsewhere", async () => {
      const { props } = buildProps({
        areas: [AREA],
        onUpdateAreaGeometry: vi.fn(async () => ({ error: CLOSED })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await moveCircle();
      await setCircleHere();
      expect(await screen.findByRole("alert")).toHaveTextContent(CLOSED);

      rerender(<SituationWorkspace {...props} areas={[]} />);

      await waitFor(() =>
        expect(
          screen.queryByRole("toolbar", { name: "Kreis verschieben" }),
        ).toBeNull(),
      );
      // Lets a notification closed by the mode's end leave the DOM.
      await act(async () => {});
      expectNotification(CLOSED);
    });
  });
});
