import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { AreaEditor, type AreaEditorProps } from "./AreaEditor";

function setup(over: Partial<AreaEditorProps> = {}) {
  const props: AreaEditorProps = {
    initial: { color: "#e2001a", opacity: 0.4, label: "Zone" },
    onSave: vi.fn(),
    onRedraw: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  const { rerender } = render(<AreaEditor {...props} />);
  return { props, rerender };
}

describe("AreaEditor", () => {
  it("prefills color, opacity and label", () => {
    setup();
    expect(screen.getByLabelText(/Farbe/)).toHaveValue("#e2001a");
    expect(screen.getByLabelText(/Beschriftung/)).toHaveValue("Zone");
  });

  it("shows the radius of a circle exactly with a decimal comma", () => {
    setup({ radius: 463.27 });
    expect(screen.getByLabelText(/Radius/)).toHaveValue("463,27 m");
  });

  it("shows no radius field without a radius", () => {
    setup();
    expect(screen.queryByLabelText(/Radius/)).not.toBeInTheDocument();
  });

  it("passes a changed radius", async () => {
    const { props } = setup({ radius: 463.27 });
    const radius = screen.getByLabelText(/Radius/);
    await userEvent.clear(radius);
    await userEvent.type(radius, "250,5");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      { color: "#e2001a", opacity: 0.4, label: "Zone" },
      250.5,
    );
  });

  it("passes no radius when unchanged", async () => {
    const { props } = setup({ radius: 463.27 });
    fireEvent.change(screen.getByLabelText(/Beschriftung/), {
      target: { value: "Gefahrenzone" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      { color: "#e2001a", opacity: 0.4, label: "Gefahrenzone" },
      undefined,
    );
  });

  it("passes no radius when the radius changed elsewhere but not in the field", async () => {
    const { props, rerender } = setup({ radius: 463.27 });
    rerender(<AreaEditor {...props} radius={300} />);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      { color: "#e2001a", opacity: 0.4, label: "Zone" },
      undefined,
    );
  });

  it("accepts a radius typed with a trailing decimal comma", async () => {
    const { props } = setup({ radius: 463.27 });
    const radius = screen.getByLabelText(/Radius/);
    await userEvent.clear(radius);
    await userEvent.type(radius, "250,");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      { color: "#e2001a", opacity: 0.4, label: "Zone" },
      250,
    );
  });

  it("clears the radius error once the radius is valid again", async () => {
    setup({ radius: 463.27 });
    const radius = screen.getByLabelText(/Radius/);
    await userEvent.clear(radius);
    await userEvent.type(radius, "0");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await userEvent.clear(radius);
    await userEvent.type(radius, "463,27");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["empty", ""],
    ["0", "0"],
    ["negative", "-5"],
  ])("rejects a %s radius with an error and does not save", async (_, typed) => {
    const { props } = setup({ radius: 463.27 });
    const radius = screen.getByLabelText(/Radius/);
    await userEvent.clear(radius);
    if (typed) await userEvent.type(radius, typed);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Der Radius muss größer als 0 sein.",
    );
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("saves edited style", async () => {
    const { props } = setup();
    const label = screen.getByLabelText(/Beschriftung/);
    fireEvent.change(label, { target: { value: "Gefahrenzone" } });
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(props.onSave).toHaveBeenCalledWith(
      { label: "Gefahrenzone", color: "#e2001a", opacity: 0.4 },
      undefined,
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
    const { props } = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Form neu zeichnen/ }),
    );
    expect(props.onRedraw).toHaveBeenCalled();
  });

  it("deletes the area", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(props.onDelete).toHaveBeenCalled();
  });
});
