import { describe, expect, it } from "vitest";
import { expectPublicPage } from "@/test/page-checks";
import { render, screen } from "@/test/render";
import DatenschutzPage from "./page";

expectPublicPage(DatenschutzPage);

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

  it("keeps an Einsatz with ETB, Kartenobjekte and Uploads until an admin deletes it after closing", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /Einsatztagebuch/,
        /Kartenobjekte/,
        /Uploads/,
        /Admin/,
        /abgeschlossen/,
        /gelöscht/,
      ),
    ).not.toHaveLength(0);
    expect(paragraphsWith(/keine automatischen Löschfristen/)).not.toHaveLength(
      0,
    );
  });

  it("drops the promise of deletion once the purpose ends", () => {
    render(<DatenschutzPage />);
    expect(
      screen.queryByText(/sobald der Zweck ihrer Verarbeitung entfällt/),
    ).toBeNull();
  });

  it("states the session runtime: 24 hours without use, 30 days at most", () => {
    render(<DatenschutzPage />);
    expect(paragraphsWith(/24 Stunden/, /30 Tage/)).not.toHaveLength(0);
    expect(screen.queryByText(/rund 30 Tagen/)).toBeNull();
    expect(paragraphsWith(/„Überall abmelden"/)).not.toHaveLength(0);
  });

  it("names the production session cookie", () => {
    render(<DatenschutzPage />);
    expect(paragraphsWith(/„__Host-einsatz_session"/)).not.toHaveLength(0);
    expect(screen.queryByText(/„einsatz_session"/)).toBeNull();
  });

  it("describes the server-side fetch of KML addresses and icons", () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole("heading", { name: /KML/ })).toBeInTheDocument();
    expect(
      paragraphsWith(/KML/, /Icons/, /Server/, /IP-Adresse des Servers/),
    ).not.toHaveLength(0);
  });

  it("describes the server-side fetch for uploaded KML files too", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(/hochgeladen/, /NetworkLinks/, /Icons/),
    ).not.toHaveLength(0);
  });

  it("states that a deleted user stays Urheber in the ETB until the Einsatz is deleted", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(/Nutzerkont/, /Urheber/, /bis der Einsatz gelöscht/),
    ).not.toHaveLength(0);
  });

  it("states that closing an Einsatz deletes all Gerätelinks and Ansichtslinks", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /Abschließen/,
        /alle Gerätelinks und Ansichtslinks/,
        /gelöscht/,
      ),
    ).not.toHaveLength(0);
  });

  it("keeps IP addresses in memory only, for login and password change", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /IP-Adresse/,
        /Anmeldung/,
        /Ändern des Passworts/,
        /Arbeitsspeicher/,
      ),
    ).not.toHaveLength(0);
  });

  it("lists the stored Kartenobjekte in the glossary's terms", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /Kartenzeichen/,
        /Bereiche/,
        /KML-Ebenen/,
        /Bild-Overlays/,
      ),
    ).not.toHaveLength(0);
    expect(screen.queryByText(/taktische Zeichen, Gebiete/)).toBeNull();
  });

  it("keeps the last reported position only as long as its Kartenzeichen keeps it", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /zuletzt gemeldete Position/,
        /bis das Kartenzeichen verschoben oder gelöscht wird/,
      ),
    ).not.toHaveLength(0);
  });

  it("states that MapTiler is the only external service a browser contacts", () => {
    render(<DatenschutzPage />);
    expect(
      paragraphsWith(
        /MapTiler ist der einzige externe Dienst, den Ihr Browser/,
      ),
    ).not.toHaveLength(0);
    expect(
      paragraphsWith(/Icons/, /kein Browser diese Anbieter kontaktiert/),
    ).not.toHaveLength(0);
  });

  it("names no external hosts but MapTiler and Photon", () => {
    render(<DatenschutzPage />);
    expect(namedHosts()).toEqual(["api.maptiler.com", "photon.komoot.io"]);
    expect(screen.queryByText(/openstreetmap/i)).toBeNull();
    expect(
      paragraphsWith(/photon\.komoot\.io/, /serverseitig/),
    ).not.toHaveLength(0);
  });
});

function paragraphsWith(...parts: RegExp[]): HTMLElement[] {
  return screen.queryAllByText(
    (_, element) =>
      element?.tagName === "P" &&
      parts.every((part) => part.test(element.textContent ?? "")),
  );
}

function namedHosts(): string[] {
  const text = [...document.body.querySelectorAll("p, li, h1, h2")]
    .map((element) => element.textContent)
    .join(" ")
    .replace(/\S+@\S+/g, "");
  const hosts = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g);
  return [...new Set(hosts)].sort();
}
