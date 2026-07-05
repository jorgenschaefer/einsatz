import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";

describe("AdvancedSymbolForm", () => {
  it("submits sensible defaults (Hilfsorganisation, Taktische Formation)", async () => {
    const onSubmit = vi.fn();
    render(<AdvancedSymbolForm submitLabel="Platzieren" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Platzieren" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        organisation: "hilfsorganisation",
        grundzeichen: "taktische-formation",
      }),
    );
  });

  it("includes the entered Bezeichnung as the composition text", async () => {
    const onSubmit = vi.fn();
    render(<AdvancedSymbolForm submitLabel="Platzieren" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Bezeichnung"), "Rotkreuz 83/1");
    await userEvent.click(screen.getByRole("button", { name: "Platzieren" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ text: "Rotkreuz 83/1" });
  });

  it("renders a control for every DV-102 axis plus the Bezeichnung", () => {
    render(<AdvancedSymbolForm submitLabel="Platzieren" onSubmit={vi.fn()} />);
    for (const axis of [
      "Organisation",
      "Grundzeichen",
      "Fachaufgabe",
      "Größenordnung",
      "Verwaltungsstufe",
      "Funktion",
      "Symbol",
    ]) {
      expect(screen.getByRole("combobox", { name: axis })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("textbox", { name: "Bezeichnung" }),
    ).toBeInTheDocument();
  });

  it("prefills from an initial composition when editing", async () => {
    const onSubmit = vi.fn();
    const initial = {
      grundzeichen: "ortsfeste-stelle",
      organisation: "feuerwehr",
      fachaufgabe: "brandbekaempfung",
      einheit: "zug",
      verwaltungsstufe: "kreis",
      funktion: "fuehrungskraft",
      symbol: "fahrzeug",
      text: "FW 1",
    };
    render(
      <AdvancedSymbolForm
        submitLabel="Speichern"
        initial={initial}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByLabelText("Bezeichnung")).toHaveValue("FW 1");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject(initial);
  });

  it("does not inject defaults when editing a composition that omits them", async () => {
    const onSubmit = vi.fn();
    render(
      <AdvancedSymbolForm
        submitLabel="Speichern"
        initial={{ grundzeichen: "gefahr" }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit.mock.calls[0][0].organisation).toBeUndefined();
  });

  it("disables the submit button while busy", () => {
    render(
      <AdvancedSymbolForm submitLabel="Speichern" busy onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
  });

  it("shows a live preview of the composed symbol", () => {
    render(<AdvancedSymbolForm submitLabel="Platzieren" onSubmit={vi.fn()} />);
    const preview = screen.getByAltText("Vorschau");
    expect(preview).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg/),
    );
  });
});
