import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, screen, waitFor, within } from "@/test/render";
import type { SituationWorkspaceProps } from "./SituationWorkspace";
import {
  AREA,
  modeBand,
  openPanel,
  renderWorkspace,
} from "./SituationWorkspace.fixtures";

const POLYGON = {
  ...AREA,
  id: "a2",
  label: "Zone",
  geometry: {
    shape: "polygon" as const,
    points: [
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { lat: 5, lng: 6 },
    ],
  },
};

type Workspace = ReturnType<typeof renderWorkspace>;

const completeDrawing = async ({ adapter }: Workspace) => {
  await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
  const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
    g: unknown,
  ) => void;
  await act(async () => {
    onComplete(POLYGON.geometry);
  });
};

const openAreaEditor = async (label: string) => {
  await openPanel("Bereiche");
  await userEvent.click(
    await screen.findByLabelText(`${label} bearbeiten`, { selector: "button" }),
  );
  return screen.findByRole("dialog");
};

type Failing = (
  action: () => Promise<ActionResult>,
) => Partial<SituationWorkspaceProps>;

const mapActions: [string, Failing, (workspace: Workspace) => Promise<void>][] =
  [
    [
      "placing a Kartenzeichen",
      (action) => ({ onPlace: action }),
      async ({ captured }) => {
        await openPanel("Kartenzeichen");
        await userEvent.click(screen.getByText(/KTW/));
        await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
        await act(async () => {
          captured.options!.onMapClick!({ lat: 50, lng: 8 });
        });
      },
    ],
    [
      "drawing a Bereich",
      (action) => ({ onCreateArea: action }),
      async (workspace) => {
        await openPanel("Bereiche");
        await userEvent.click(screen.getByText("Polygon"));
        await completeDrawing(workspace);
      },
    ],
    [
      "redrawing a Bereich",
      (action) => ({ areas: [POLYGON], onUpdateAreaGeometry: action }),
      async (workspace) => {
        await userEvent.click(
          within(await openAreaEditor("Zone")).getByText(/Form neu zeichnen/),
        );
        await completeDrawing(workspace);
      },
    ],
    [
      "moving a circle",
      (action) => ({ areas: [AREA], onUpdateAreaGeometry: action }),
      async () => {
        await userEvent.click(
          within(await openAreaEditor("Deich")).getByText("Verschieben"),
        );
        await userEvent.click(
          within(modeBand("Kreis verschieben")).getByText("Hier setzen"),
        );
      },
    ],
  ];

describe("SituationWorkspace map actions", () => {
  it.each(mapActions)(
    "shows the failure as the Karte notification when %s throws",
    async (_, failing, perform) => {
      const action = vi.fn(async (): Promise<ActionResult> => {
        throw new Error("db down");
      });
      const workspace = renderWorkspace(failing(action));

      await perform(workspace);

      const notification = await screen.findByRole("alert");
      expect(within(notification).getByText("Karte")).toBeInTheDocument();
      expect(notification).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
    },
  );

  it("closes the Karte notification with its ×", async () => {
    const [, failing, perform] = mapActions[0];
    const workspace = renderWorkspace(
      failing(
        vi.fn(async (): Promise<ActionResult> => {
          throw new Error("db down");
        }),
      ),
    );
    await perform(workspace);
    await screen.findByRole("alert");

    await userEvent.click(
      screen.getByRole("button", { name: "Meldung schließen" }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(mapActions)(
    "shows no failure when %s redirects to the login",
    async (_, failing, perform) => {
      const action = vi.fn(async (): Promise<ActionResult> => {
        throw redirectError();
      });
      const workspace = renderWorkspace(failing(action));

      await perform(workspace);

      await waitFor(() => expect(action).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );
});
