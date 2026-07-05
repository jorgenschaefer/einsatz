import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import DatenschutzPage from "./page";

describe("DatenschutzPage", () => {
  it("nennt den Verantwortlichen", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText("Datenschutzerklärung")).toBeInTheDocument();
    expect(screen.getAllByText(/Jorgen Schäfer/).length).toBeGreaterThan(0);
  });

  it("nennt den Hosting-Auftragsverarbeiter IONOS", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/IONOS SE/)).toBeInTheDocument();
  });

  it("beschreibt Kartendienst und Standortverarbeitung", () => {
    render(<DatenschutzPage />);
    expect(screen.getAllByText(/MapTiler/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /Standortdaten/ }),
    ).toBeInTheDocument();
  });

  it("verweist auf das Impressum", () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/impressum",
    );
  });

  it("nennt MapTiler-Rechtsträger in der Schweiz mit Angemessenheitsbeschluss", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/MapTiler AG/)).toBeInTheDocument();
    expect(screen.getByText(/Angemessenheitsbeschluss/)).toBeInTheDocument();
  });

  it("hält den Grundsatz ohne Personenbezug fest und die Einwilligung für Standortdaten", () => {
    render(<DatenschutzPage />);
    expect(screen.getByText(/Grundsatz:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Art\. 6 Abs\. 1 lit\. a DSGVO/),
    ).toBeInTheDocument();
  });

  it("enthält keine offenen Prüf-/Bestätigungshinweise mehr", () => {
    render(<DatenschutzPage />);
    expect(screen.queryByText(/zu prüfen|zu bestätigen/)).toBeNull();
  });
});
