import { Modal } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";

function renderModal() {
  render(
    <Modal opened onClose={() => {}} title="Kartenzeichen bearbeiten">
      Inhalt
    </Modal>,
  );
  const dialog = screen.getByRole("dialog");
  const title = document.getElementById(
    dialog.getAttribute("aria-labelledby") ?? "",
  ) as HTMLElement;
  return { title, header: title.parentElement as HTMLElement };
}

describe("theme", () => {
  it("sets every dialog title semi-bold with line spacing", () => {
    const { title } = renderModal();

    expect(title).toHaveStyle({ fontWeight: "600", lineHeight: "1.35" });
  });

  it("lets a long dialog title wrap inside the dialog", () => {
    const { title } = renderModal();

    expect(title).toHaveStyle({ minWidth: "0", overflowWrap: "anywhere" });
  });

  it("keeps the close button level with the first title line", () => {
    const { header } = renderModal();

    expect(header).toHaveStyle({ alignItems: "flex-start" });
  });
});
