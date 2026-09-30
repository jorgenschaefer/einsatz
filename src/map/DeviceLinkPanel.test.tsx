import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import { act, render, screen, waitFor, within } from "@/test/render";
import { DeviceLinkPanel, type DeviceLinkPanelProps } from "./DeviceLinkPanel";

function setup(over: Partial<DeviceLinkPanelProps> = {}) {
  const props: DeviceLinkPanelProps = {
    token: null,
    positionSource: "manual",
    reportedAt: null,
    onGenerate: vi.fn(async () => ({})),
    ...over,
  };
  render(<DeviceLinkPanel {...props} />);
  return props;
}

const hanging = () => new Promise<ActionResult>(() => {});

const askToRegenerate = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "Gerätelink neu generieren" }),
  );
  return screen.findByRole("dialog", { name: "Gerätelink neu generieren" });
};

const confirmButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Neu generieren" });

describe("DeviceLinkPanel", () => {
  it("offers to generate a device link when there is none", async () => {
    const props = setup({ token: null });
    expect(screen.queryByText(/manuell/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Gerätelink erzeugen/ }),
    );
    expect(props.onGenerate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the link and a QR code when a token exists", () => {
    setup({
      token: "secret-token-123",
      positionSource: "device",
      reportedAt: new Date("2026-07-03T12:00:00Z"),
    });
    const link = screen.getByLabelText(/Gerätelink/) as HTMLInputElement;
    expect(link.value).toContain("secret-token-123");
    expect(document.querySelector("svg")).toBeInTheDocument(); // QR-Code
  });

  describe("regenerating an existing device link", () => {
    it("asks for confirmation first and regenerates only once confirmed", async () => {
      const props = setup({ token: "secret-token-123" });

      const dialog = await askToRegenerate();

      expect(props.onGenerate).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Der bisherige Link funktioniert sofort nicht mehr. Das Gerät muss den neuen Link öffnen.",
      );
      expect(buttonColor(confirmButton(dialog))).toBe("red");

      await userEvent.click(confirmButton(dialog));

      expect(props.onGenerate).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("does not regenerate when cancelled", async () => {
      const props = setup({ token: "secret-token-123" });
      const dialog = await askToRegenerate();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(props.onGenerate).not.toHaveBeenCalled();
    });

    it("does not regenerate on Escape", async () => {
      const props = setup({ token: "secret-token-123" });
      await askToRegenerate();

      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(props.onGenerate).not.toHaveBeenCalled();
    });

    it("does not regenerate on a click beside the confirmation", async () => {
      const props = setup({ token: "secret-token-123" });
      await askToRegenerate();

      await clickModalOverlay();

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(props.onGenerate).not.toHaveBeenCalled();
    });

    it("shows a returned error in the open confirmation", async () => {
      setup({
        token: "secret-token-123",
        onGenerate: vi.fn(async () => ({ error: "Kartenzeichen fehlt." })),
      });
      const dialog = await askToRegenerate();

      await userEvent.click(confirmButton(dialog));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Kartenzeichen fehlt.",
      );
    });

    it("shows a thrown failure in the open confirmation", async () => {
      setup({
        token: "secret-token-123",
        onGenerate: vi.fn(async () => {
          throw new Error("offline");
        }),
      });
      const dialog = await askToRegenerate();

      await userEvent.click(confirmButton(dialog));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
    });

    it("stays locked while regenerating", async () => {
      const onGenerate = vi.fn(hanging);
      setup({ token: "secret-token-123", onGenerate });
      const dialog = await askToRegenerate();

      await userEvent.click(confirmButton(dialog));
      await userEvent.keyboard("{Escape}");
      await clickModalOverlay();
      await userEvent.click(confirmButton(dialog), { pointerEventsCheck: 0 });

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });
  });

  it("resets the copy button label back to 'kopieren' after a delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    try {
      setup({ token: "secret-token-123" });
      await userEvent.click(screen.getByRole("button", { name: "kopieren" }));
      expect(
        screen.getByRole("button", { name: "kopiert" }),
      ).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(
        screen.getByRole("button", { name: "kopieren" }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("does not confirm 'kopiert' and hints instead when the clipboard API is unavailable", async () => {
    // Unsicherer Kontext / In-App-Webview: navigator.clipboard fehlt ganz.
    delete (navigator as { clipboard?: unknown }).clipboard;
    setup({ token: "secret-token-123" });
    await userEvent.click(screen.getByRole("button", { name: "kopieren" }));
    expect(screen.queryByRole("button", { name: "kopiert" })).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nicht möglich/i,
    );
  });

  it("shows the live position source and the last report", () => {
    setup({
      token: "t",
      positionSource: "device",
      reportedAt: new Date("2026-07-03T12:00:00Z"),
    });
    expect(screen.getByText(/Live/)).toBeInTheDocument();
    expect(screen.getByText(/zuletzt gemeldet/i)).toBeInTheDocument();
  });
});
