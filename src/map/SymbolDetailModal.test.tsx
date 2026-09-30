import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { render, screen, waitFor } from "@/test/render";
import type { WorkspaceSymbol } from "./SituationWorkspace";
import { SymbolDetailModal } from "./SymbolDetailModal";

const SYMBOL: WorkspaceSymbol = {
  id: "s1",
  lat: 1,
  lng: 2,
  composition: {
    grundzeichen: "ortsfeste-stelle",
    organisation: "hilfsorganisation",
    text: "RK 1",
  },
};

function renderDetail(
  over: Partial<ComponentProps<typeof SymbolDetailModal>> = {},
) {
  const props = {
    symbol: SYMBOL,
    onClose: vi.fn(),
    onUpdate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    onGenerateDeviceLink: vi.fn(async () => ({})),
    ...over,
  };
  render(<SymbolDetailModal {...props} />);
  return props;
}

const save = () => userEvent.click(screen.getByText("Speichern"));

describe("SymbolDetailModal", () => {
  it("closes once the edit is saved", async () => {
    const { onUpdate, onClose } = renderDetail();
    await save();
    expect(onUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ text: "RK 1" }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and shows a fallback when saving throws", async () => {
    const { onClose } = renderDetail({
      onUpdate: vi.fn().mockRejectedValue(new Error("boom")),
    });
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks Löschen while saving", async () => {
    renderDetail({ onUpdate: () => new Promise<ActionResult>(() => {}) });
    await save();
    expect(
      screen.getByText("Löschen").closest("button") as HTMLElement,
    ).toHaveAttribute("data-loading");
  });
});
