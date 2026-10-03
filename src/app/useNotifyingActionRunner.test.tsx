import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { act, Providers, renderHook, screen, waitFor } from "@/test/render";
import type { NotificationSource } from "./action-notification";
import { useNotifyingActionRunner } from "./useNotifyingActionRunner";

const SOURCE: NotificationSource = { id: "probe", title: "Probe" };

function renderRunner() {
  return renderHook(() => useNotifyingActionRunner(SOURCE), {
    wrapper: Providers,
  });
}

async function failOnce(runner: ReturnType<typeof renderRunner>) {
  await act(async () => {
    await runner.result.current.run(async () => ({ error: "Kaputt." }));
  });
  await screen.findByRole("alert");
}

describe("useNotifyingActionRunner", () => {
  it("shows a returned error as a notification titled with its source", async () => {
    const runner = renderRunner();
    let returned: ActionResult | null = null;

    await act(async () => {
      returned = await runner.result.current.run(async () => ({
        error: "Kaputt.",
      }));
    });

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Probe");
    expect(notification).toHaveTextContent("Kaputt.");
    expect(returned).toEqual({ error: "Kaputt." });
    expect(runner.result.current.busy).toBe(false);
  });

  it("turns a thrown failure into the failure message", async () => {
    const runner = renderRunner();

    await act(async () => {
      await runner.result.current.run(async () => {
        throw new Error("offline");
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das hat nicht geklappt. Bitte erneut versuchen.",
    );
  });

  it("does not close the notification by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const runner = renderRunner();
      await failOnce(runner);

      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(screen.getByRole("alert")).toHaveTextContent("Kaputt.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows only one notification after failing twice", async () => {
    const runner = renderRunner();
    await failOnce(runner);

    await failOnce(runner);

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Kaputt.");
  });

  it("closes an earlier notification as soon as the action starts", async () => {
    const runner = renderRunner();
    await failOnce(runner);

    act(() => {
      void runner.result.current.run(() => new Promise<ActionResult>(() => {}));
    });

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(runner.result.current.busy).toBe(true);
  });

  it("shows nothing and hands back a success", async () => {
    const runner = renderRunner();
    let returned: ActionResult | null = null;

    await act(async () => {
      returned = await runner.result.current.run(
        async (): Promise<ActionResult & { id: string }> => ({ id: "a1" }),
      );
    });

    expect(returned).toEqual({ id: "a1" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays busy without a notification while a redirect navigates away", async () => {
    const runner = renderRunner();
    let returned: ActionResult | null | undefined;

    await act(async () => {
      returned = await runner.result.current.run(async () => {
        throw redirectError();
      });
    });

    expect(returned).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(runner.result.current.busy).toBe(true);
  });

  it("closes its notification on closeError", async () => {
    const runner = renderRunner();
    await failOnce(runner);

    act(() => runner.result.current.closeError());

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("closes the notification with its close button", async () => {
    const runner = renderRunner();
    await failOnce(runner);

    await act(async () =>
      screen.getByRole("button", { name: "Meldung schließen" }).click(),
    );

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
