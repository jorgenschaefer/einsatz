import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, screen, waitFor, within } from "@/test/render";
import type { SituationWorkspaceProps } from "./SituationWorkspace";
import { openPanel, renderWorkspace } from "./SituationWorkspace.fixtures";

type Workspace = ReturnType<typeof renderWorkspace>;

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
