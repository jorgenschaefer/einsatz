import { describe, expect, it } from "vitest";
import { expectPublicPage } from "@/test/page-checks";
import { render, screen } from "@/test/render";
import ImpressumPage from "./page";

expectPublicPage(ImpressumPage);

describe("ImpressumPage", () => {
  it("nennt die verantwortliche Person und die Anschrift", () => {
    render(<ImpressumPage />);
    expect(screen.getByText("Impressum")).toBeInTheDocument();
    expect(screen.getAllByText(/Jorgen Schäfer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sonderburger Str\. 1/).length).toBeGreaterThan(
      0,
    );
  });

  it("verlinkt die Kontakt-E-Mail als mailto", () => {
    render(<ImpressumPage />);
    expect(
      screen.getByRole("link", { name: "Jorgen.Schaefer@gmail.com" }),
    ).toHaveAttribute("href", "mailto:Jorgen.Schaefer@gmail.com");
  });

  it("verweist auf die Datenschutzerklärung", () => {
    render(<ImpressumPage />);
    expect(
      screen.getByRole("link", { name: "Datenschutzerklärung" }),
    ).toHaveAttribute("href", "/datenschutz");
  });
});
