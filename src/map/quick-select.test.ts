import { describe, expect, it } from "vitest";
import { QUICK_SELECT } from "./quick-select";
import { renderSymbolDataUrl } from "./tactical-symbol";

describe("QUICK_SELECT palette", () => {
  it("offers the fixed set of common symbols", () => {
    const labels = QUICK_SELECT.map((i) => i.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Sanitätsstreife",
        "Unfallhilfsstelle",
        "KTW",
        "RTW (Hilfsorganisationen)",
        "RTW (Feuerwehr)",
        "NEF",
        "GW-San",
        "BHP",
        "RMHP",
        "Bereitstellungsraum",
      ]),
    );
    expect(QUICK_SELECT).toHaveLength(10);
  });

  it("distinguishes the two RTW only by organisation (field colour)", () => {
    const weiss = QUICK_SELECT.find(
      (i) => i.label === "RTW (Hilfsorganisationen)",
    );
    const rot = QUICK_SELECT.find((i) => i.label === "RTW (Feuerwehr)");
    expect(weiss?.composition.organisation).toBe("hilfsorganisation");
    expect(rot?.composition.organisation).toBe("feuerwehr");
  });

  it("has unique ids and every item renders to a data URI", () => {
    const ids = QUICK_SELECT.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of QUICK_SELECT) {
      expect(renderSymbolDataUrl(item.composition)).toMatch(
        /^data:image\/svg\+xml/,
      );
    }
  });
});
