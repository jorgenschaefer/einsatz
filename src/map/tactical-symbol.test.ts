import { describe, expect, it } from "vitest";
import { renderSymbolDataUrl } from "./tactical-symbol";

describe("renderSymbolDataUrl", () => {
  it("renders a composition to an SVG data URI", () => {
    const url = renderSymbolDataUrl({
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
      organisation: "hilfsorganisation",
    });
    expect(url).toMatch(/^data:image\/svg\+xml/);
    expect(url.length).toBeGreaterThan(20);
  });

  it("renders a composition lacking grundzeichen/symbol without throwing", () => {
    expect(renderSymbolDataUrl({ organisation: "hilfsorganisation" })).toMatch(
      /^data:image\/svg\+xml/,
    );
  });

  it("does not bake the Bezeichnung (text) into the SVG", () => {
    const base = {
      grundzeichen: "kraftfahrzeug-landgebunden",
      organisation: "hilfsorganisation",
    } as const;
    const ohne = renderSymbolDataUrl(base);
    const mit = renderSymbolDataUrl({ ...base, text: "83/1" });
    expect(mit).toBe(ohne);
  });

  it("produces different output when only the organisation (field colour) differs", () => {
    const base = {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
    } as const;
    const weiss = renderSymbolDataUrl({
      ...base,
      organisation: "hilfsorganisation",
    });
    const rot = renderSymbolDataUrl({ ...base, organisation: "feuerwehr" });
    expect(weiss).not.toBe(rot);
  });
});
