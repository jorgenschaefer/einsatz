import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import {
  ImageOverlayEditor,
  type ImageOverlayEditorProps,
} from "./ImageOverlayEditor";

function setup(over: Partial<ImageOverlayEditorProps> = {}) {
  const props: ImageOverlayEditorProps = {
    opacity: 0.8,
    onOpacityChange: vi.fn(),
    onReplace: vi.fn(),
    onDelete: vi.fn(),
    onDone: vi.fn(),
    ...over,
  };
  render(<ImageOverlayEditor {...props} />);
  return props;
}

describe("ImageOverlayEditor", () => {
  it("shows the current opacity on the slider", () => {
    setup({ opacity: 0.8 });
    expect(screen.getByRole("slider", { name: "Deckkraft" })).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
  });

  it("adjusts the opacity via the slider", async () => {
    const onOpacityChange = vi.fn();
    setup({ opacity: 0.8, onOpacityChange });
    const slider = screen.getByRole("slider", { name: "Deckkraft" });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onOpacityChange).toHaveBeenCalled();
    expect(onOpacityChange.mock.calls.at(-1)![0]).toBeGreaterThan(0.8);
  });

  it("replaces the file", async () => {
    const onReplace = vi.fn();
    setup({ onReplace });
    const file = new File(["%PDF-1.4"], "neu.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
    expect(onReplace).toHaveBeenCalledWith(file);
  });

  it("finishes editing", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(props.onDone).toHaveBeenCalled();
  });

  it("deletes the overlay", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("disables controls while busy and shows an error", () => {
    setup({ busy: true, error: "Speichern fehlgeschlagen." });
    expect(screen.getByRole("button", { name: "Fertig" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen.",
    );
  });
});
