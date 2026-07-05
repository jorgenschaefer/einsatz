import {
  erzeugeTaktischesZeichen,
  type TaktischesZeichen,
} from "taktische-zeichen-core";
import type { SymbolComposition } from "./composition";

/**
 * Erzeugt aus einer Zeichen-Komposition ein DV-102-SVG als data:-URI (für den
 * Karten-Marker). Dünne Hülle um `taktische-zeichen-core` – der einzige Ort,
 * der die Bibliothek aufruft.
 */
export function renderSymbolDataUrl(composition: SymbolComposition): string {
  // Die Bezeichnung (text) wird bewusst NICHT ins SVG gezeichnet – sie stünde im
  // Symbol und wäre kaum lesbar. Sie wird als Label neben dem Marker gerendert.
  const { text: _text, ...rest } = composition;
  // taktische-zeichen-core verlangt mindestens Grundzeichen oder Symbol; defensiv
  // ein Grundzeichen ergänzen, damit fehlerhafte Daten das Rendern nicht sprengen.
  const spec: SymbolComposition =
    rest.grundzeichen || rest.symbol
      ? rest
      : { ...rest, grundzeichen: "taktische-formation" };
  return erzeugeTaktischesZeichen(spec as TaktischesZeichen).dataUrl;
}
