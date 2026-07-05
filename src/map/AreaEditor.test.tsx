import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AreaEditor, type AreaEditorProps } from "./AreaEditor";

function setup(over: Partial<AreaEditorProps> = {}) {
  const props: AreaEditorProps = {
    initial: { color: "#e2001a", opacity: 0.4, label: "Zone" },
    onSave: vi.fn(),
    onRedraw: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<AreaEditor {...props} />);
  return props;
}

describe("AreaEditor", () => {
  it("prefills color, opacity and label", () => {
    setup();
    expect(screen.getByLabelText(/Farbe/)).toHaveValue("#e2001a");
    expect(screen.getByLabelText(/Beschriftung/)).toHaveValue("Zone");
  });

  it("saves edited style", async () => {
    const props = setup();
    const label = screen.getByLabelText(/Beschriftung/);
    await userEvent.clear(label);
    await userEvent.type(label, "Gefahrenzone");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Gefahrenzone",
        color: "#e2001a",
        opacity: 0.4,
      }),
    );
  });

  it("disables Speichern while busy and shows a save error", () => {
    setup({ busy: true, error: "Speichern fehlgeschlagen." });
    expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Speichern fehlgeschlagen.",
    );
  });

  it("re-draws the shape", async () => {
    const props = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Form neu zeichnen/ }),
    );
    expect(props.onRedraw).toHaveBeenCalled();
  });

  it("deletes the area", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});
