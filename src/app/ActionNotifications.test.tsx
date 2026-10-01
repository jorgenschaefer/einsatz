import { notifications } from "@mantine/notifications";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, render, screen } from "@/test/render";

async function showNotification() {
  render(<div />);
  act(() => {
    notifications.show({ id: "probe", message: "Kaputt.", autoClose: false });
  });
  const notification = await screen.findByRole("alert");
  const root = notification.closest<HTMLElement>(".mantine-Notifications-root");
  if (!root) throw new Error("no notifications root");
  return root;
}

describe("ActionNotifications", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows notifications top center below the header on a phone", async () => {
    stubMatchMedia(false);

    const root = await showNotification();

    expect(root).toHaveAttribute("data-position", "top-center");
    expect(root.style.top).toBe("calc(40px + var(--mantine-spacing-sm))");
    expect(root.style.right).toBe("");
  });

  it("shows notifications top right over the map, left of the sidebar, on a desktop", async () => {
    stubMatchMedia(true);

    const root = await showNotification();

    expect(root).toHaveAttribute("data-position", "top-right");
    expect(root.style.top).toBe("calc(56px + var(--mantine-spacing-sm))");
    expect(root.style.right).toBe("calc(360px + var(--mantine-spacing-sm))");
    expect(root.style.maxWidth).toBe(
      "min(var(--notifications-container-width), 100% - 360px - 2 * var(--mantine-spacing-sm))",
    );
  });

  it.each([
    ["a phone", false],
    ["a desktop", true],
  ])(
    "keeps every container as tall as its notifications on %s",
    async (_, desktop) => {
      stubMatchMedia(desktop);
      await showNotification();

      const roots = document.querySelectorAll<HTMLElement>(
        ".mantine-Notifications-root",
      );

      expect(roots.length).toBeGreaterThan(1);
      for (const root of roots) expect(root.style.bottom).toBe("auto");
    },
  );

  it("lies above dialogs", async () => {
    const root = await showNotification();

    expect(
      Number(root.style.getPropertyValue("--notifications-z-index")),
    ).toBeGreaterThan(200);
  });
});
