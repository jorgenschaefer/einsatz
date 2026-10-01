import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, fireEvent, render, screen, waitFor, within } from "@/test/render";
import { type KmlOverlayView, KmlPanel, type KmlPanelProps } from "./KmlPanel";

const NOT_FOUND = "KML konnte nicht geladen werden (404).";

const urlOverlay: KmlOverlayView = {
  id: "k1",
  name: "Laufstrecke",
  sourceType: "url",
  visible: true,
};

function renderPanel(over: Partial<KmlPanelProps> = {}) {
  const props: KmlPanelProps = {
    overlays: [urlOverlay],
    onAddFile: vi.fn(async () => ({})),
    onAddUrl: vi.fn(async () => ({})),
    onToggleVisibility: vi.fn(async () => ({})),
    onReload: vi.fn(async () => ({ error: NOT_FOUND })),
    onRemove: vi.fn(async () => ({})),
    ...over,
  };
  render(
    <div data-testid="panel">
      <KmlPanel {...props} />
    </div>,
  );
  return props;
}

const reload = () =>
  userEvent.click(
    within(screen.getByTestId("kml-k1")).getByRole("button", {
      name: "Neu laden",
    }),
  );

async function askToRemove() {
  await userEvent.click(
    within(screen.getByTestId("kml-k1")).getByRole("button", {
      name: "Entfernen",
    }),
  );
  return screen.findByRole("dialog");
}

describe("KmlPanel notifications", () => {
  it("shows a failure as a notification titled KML-Ebenen, not atop the panel", async () => {
    renderPanel();

    await reload();

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("KML-Ebenen");
    expect(notification).toHaveTextContent(NOT_FOUND);
    expect(within(screen.getByTestId("panel")).queryByRole("alert")).toBeNull();
  });

  it("does not close the notification by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPanel();
      await reload();
      await screen.findByRole("alert");

      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the notification with its close button", async () => {
    renderPanel();
    await reload();

    await userEvent.click(
      within(await screen.findByRole("alert")).getByRole("button", {
        name: "Meldung schließen",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows only one notification after failing twice", async () => {
    renderPanel();
    await reload();
    await screen.findByRole("alert");

    await reload();

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND);
  });

  it("closes the notification when the next attempt succeeds", async () => {
    const onReload = vi
      .fn<() => Promise<ActionResult>>()
      .mockResolvedValueOnce({ error: NOT_FOUND })
      .mockResolvedValueOnce({});
    renderPanel({ onReload });
    await reload();
    await screen.findByRole("alert");

    await reload();

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it.each([
    [
      "Sichtbarkeit schalten",
      () =>
        userEvent.click(screen.getByRole("switch", { name: "Laufstrecke" })),
    ],
    [
      "Per URL einbinden",
      async () => {
        fireEvent.change(screen.getByLabelText("KML-/KMZ-URL"), {
          target: { value: "https://maps.example/x.kml" },
        });
        await userEvent.click(
          screen.getByRole("button", { name: "Per URL einbinden" }),
        );
      },
    ],
    [
      "Datei wählen",
      () =>
        userEvent.upload(
          screen.getByLabelText("KML-/KMZ-Datei einbinden"),
          new File(["<kml/>"], "zonen.kml"),
        ),
    ],
    ["„Entfernen“ öffnen", () => askToRemove()],
  ])("closes the notification on %s", async (_, act) => {
    renderPanel();
    await reload();
    await screen.findByRole("alert");

    await act();

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("keeps the notification while typing a name or URL", async () => {
    renderPanel();
    await reload();
    await screen.findByRole("alert");

    await userEvent.type(screen.getByLabelText("Name"), "Strecke");
    await userEvent.type(screen.getByLabelText("KML-/KMZ-URL"), "https://x");

    expect(screen.getByRole("alert")).toHaveTextContent(NOT_FOUND);
  });

  it("shows no notification when the session has expired", async () => {
    renderPanel({
      onReload: vi.fn(async (): Promise<ActionResult> => {
        throw redirectError();
      }),
    });

    await reload();

    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("while the removal is being confirmed", () => {
    async function failReloadBehindConfirmation() {
      let fail: (result: ActionResult) => void = () => {};
      renderPanel({
        onReload: vi.fn(
          () => new Promise<ActionResult>((resolve) => (fail = resolve)),
        ),
      });
      await reload();
      const dialog = await askToRemove();
      await act(async () => fail({ error: NOT_FOUND }));
      return dialog;
    }

    it("shows a failure that arrives as a notification outside the dialog", async () => {
      const dialog = await failReloadBehindConfirmation();

      const notification = await screen.findByRole("alert");
      expect(notification).toHaveTextContent(NOT_FOUND);
      expect(notification).toHaveTextContent("KML-Ebenen");
      expect(dialog).not.toContainElement(notification);
      expect(screen.getByTestId("panel")).not.toContainElement(notification);
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("lets its close button close the notification with the dialog open", async () => {
      await failReloadBehindConfirmation();

      await userEvent.click(
        within(await screen.findByRole("alert")).getByRole("button", {
          name: "Meldung schließen",
        }),
      );

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes the notification once the removal is confirmed", async () => {
      const dialog = await failReloadBehindConfirmation();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Entfernen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });
});
