import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { ViewLinkPanel, type ViewLinkPanelProps } from "./ViewLinkPanel";

function setup(over: Partial<ViewLinkPanelProps> = {}) {
  const props: ViewLinkPanelProps = {
    links: [],
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<ViewLinkPanel {...props} />);
  return props;
}

describe("ViewLinkPanel", () => {
  it("shows an empty-state hint when there are no view links", () => {
    setup({ links: [] });
    expect(screen.getByText(/noch kein ansichtslink/i)).toBeInTheDocument();
  });

  it("creates a named view link and clears the field", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText(/Bezeichnung/i), "Leitstelle");
    await userEvent.click(
      screen.getByRole("button", { name: /Ansichtslink erzeugen/i }),
    );
    expect(props.onCreate).toHaveBeenCalledWith("Leitstelle");
    expect(screen.getByLabelText(/Bezeichnung/i)).toHaveValue("");
  });

  it("disables the create button while a creation is in flight", async () => {
    let resolve: () => void = () => {};
    const onCreate = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    setup({ onCreate });
    await userEvent.type(screen.getByLabelText(/Bezeichnung/i), "Leitstelle");
    const button = screen.getByRole("button", {
      name: /Ansichtslink erzeugen/i,
    });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    // Die Erzeugung abschließen und das folgende State-Update (Feld leeren,
    // Ladezustand beenden) abwarten, damit es innerhalb act() flusht.
    resolve();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("lists links with their label and shows a fallback for a blank one", () => {
    setup({
      links: [
        { id: "1", label: "Leitstelle", token: "tok-a" },
        { id: "2", label: "", token: "tok-b" },
      ],
    });
    expect(screen.getByText("Leitstelle")).toBeInTheDocument();
    expect(screen.getByText("Ansichtslink")).toBeInTheDocument();
  });

  it("copies the view URL of a link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/view/tok-a"),
      );
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("shows a 'kopiert' confirmation after copying, like the device link panel", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(await screen.findByText("kopiert")).toBeInTheDocument();
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("does not confirm 'kopiert' and hints instead when the clipboard API is unavailable", async () => {
    // Unsicherer Kontext / In-App-Webview: navigator.clipboard fehlt ganz.
    delete (navigator as { clipboard?: unknown }).clipboard;
    setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle kopieren/i }),
    );
    expect(screen.queryByText("kopiert")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nicht möglich/i,
    );
  });

  it("does not confirm 'kopiert' when writing to the clipboard is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
      await userEvent.click(
        screen.getByRole("button", { name: /Leitstelle kopieren/i }),
      );
      expect(writeText).toHaveBeenCalled();
      expect(screen.queryByText("kopiert")).toBeNull();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /nicht möglich/i,
      );
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("reveals a QR code on demand", async () => {
    setup({ links: [{ id: "1", label: "Leitstelle", token: "tok-a" }] });
    expect(document.querySelector("svg")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle QR/i }),
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("deletes a link only after confirmation", async () => {
    const props = setup({
      links: [{ id: "1", label: "Leitstelle", token: "tok-a" }],
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Leitstelle löschen/i }),
    );
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /endgültig löschen/i }),
    );
    expect(props.onDelete).toHaveBeenCalledWith("1");
  });
});
