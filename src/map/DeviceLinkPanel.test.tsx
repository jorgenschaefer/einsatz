import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { clickModalOverlay } from "@/test/modal-overlay";
import {
  notificationArea,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render";
import { DeviceLinkPanel, type DeviceLinkPanelProps } from "./DeviceLinkPanel";

function setup(over: Partial<DeviceLinkPanelProps> = {}) {
  const props: DeviceLinkPanelProps = {
    token: null,
    positionSource: "manual",
    reportedAt: null,
    onGenerate: vi.fn(async () => ({})),
    onRemove: vi.fn(async () => ({})),
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

const askToRemove = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "Gerätelink entfernen" }),
  );
  return screen.findByRole("dialog", { name: "Gerätelink entfernen" });
};

const removeButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Entfernen" });

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

  describe("removing an existing device link", () => {
    it("asks for confirmation first and removes only once confirmed", async () => {
      const props = setup({ token: "secret-token-123" });

      const dialog = await askToRemove();

      expect(props.onRemove).not.toHaveBeenCalled();
      expect(dialog).toHaveTextContent(
        "Der Link funktioniert sofort nicht mehr. Ein Gerät, das ihn offen hat, zeigt „Zugang beendet“.",
      );
      expect(buttonColor(removeButton(dialog))).toBe("red");

      await userEvent.click(removeButton(dialog));

      expect(props.onRemove).toHaveBeenCalledTimes(1);
      expect(props.onGenerate).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("does not remove when cancelled", async () => {
      const props = setup({ token: "secret-token-123" });
      const dialog = await askToRemove();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(props.onRemove).not.toHaveBeenCalled();
    });

    it("shows a returned error in the open confirmation", async () => {
      setup({
        token: "secret-token-123",
        onRemove: vi.fn(async () => ({ error: "Kartenzeichen fehlt." })),
      });
      const dialog = await askToRemove();

      await userEvent.click(removeButton(dialog));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Kartenzeichen fehlt.",
      );
    });

    it("is not offered when there is no device link", () => {
      setup({ token: null });
      expect(
        screen.queryByRole("button", { name: "Gerätelink entfernen" }),
      ).toBeNull();
    });
  });

  describe("copying the device link", () => {
    const writeText = vi.fn();
    const copy = () =>
      userEvent.click(screen.getByRole("button", { name: "kopieren" }));

    afterEach(() => {
      writeText.mockReset();
      delete (navigator as { clipboard?: unknown }).clipboard;
    });

    it("copies the device URL and confirms it with 'kopiert'", async () => {
      writeText.mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      setup({ token: "secret-token-123" });

      await copy();

      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/device/secret-token-123`,
      );
      expect(
        await screen.findByRole("button", { name: "kopiert" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("hints in the panel instead of confirming when copying fails", async () => {
      delete (navigator as { clipboard?: unknown }).clipboard;
      setup({ token: "secret-token-123" });

      await copy();

      const hint = await screen.findByRole("alert");
      expect(hint).toHaveTextContent(/Kopieren nicht möglich/);
      expect(notificationArea()).not.toContainElement(hint);
      expect(screen.queryByRole("button", { name: "kopiert" })).toBeNull();
    });
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
