import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test/render";
import { DeviceLinkPanel, type DeviceLinkPanelProps } from "./DeviceLinkPanel";

function setup(over: Partial<DeviceLinkPanelProps> = {}) {
  const props: DeviceLinkPanelProps = {
    token: null,
    positionSource: "manual",
    reportedAt: null,
    onGenerate: vi.fn(),
    ...over,
  };
  render(<DeviceLinkPanel {...props} />);
  return props;
}

describe("DeviceLinkPanel", () => {
  it("offers to generate a device link when there is none", async () => {
    const props = setup({ token: null });
    expect(screen.queryByText(/manuell/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Gerätelink erzeugen/ }),
    );
    expect(props.onGenerate).toHaveBeenCalled();
  });

  it("shows the link, a QR code, and a regenerate action when a token exists", async () => {
    const props = setup({
      token: "secret-token-123",
      positionSource: "device",
      reportedAt: new Date("2026-07-03T12:00:00Z"),
    });
    const link = screen.getByLabelText(/Gerätelink/) as HTMLInputElement;
    expect(link.value).toContain("secret-token-123");
    expect(document.querySelector("svg")).toBeInTheDocument(); // QR-Code
    await userEvent.click(
      screen.getByRole("button", { name: /neu generieren/i }),
    );
    expect(props.onGenerate).toHaveBeenCalled();
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
