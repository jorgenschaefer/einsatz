import type { SymbolComposition } from "./composition";

export interface QuickSelectItem {
  id: string;
  label: string;
  composition: SymbolComposition;
}

/**
 * Fester Vorrat der Schnellauswahl: häufige, vorkonfigurierte Kompositionen.
 * Die Feldfarbe folgt strikt der Organisation (8 DV-102-Kategorien); die beiden
 * RTW unterscheiden sich allein darin (Hilfsorganisationen weiß / Feuerwehr rot).
 */
export const QUICK_SELECT: QuickSelectItem[] = [
  {
    id: "sanitaetsstreife",
    label: "Sanitätsstreife",
    composition: {
      grundzeichen: "taktische-formation",
      einheit: "trupp",
      fachaufgabe: "rettungswesen",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "unfallhilfsstelle",
    label: "Unfallhilfsstelle",
    composition: {
      grundzeichen: "ortsfeste-stelle",
      fachaufgabe: "rettungswesen",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "ktw",
    label: "KTW",
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
      symbol: "transport",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "rtw-hilfsorganisation",
    label: "RTW (Hilfsorganisationen)",
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "rtw-feuerwehr",
    label: "RTW (Feuerwehr)",
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
      organisation: "feuerwehr",
    },
  },
  {
    id: "nef",
    label: "NEF",
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "aerztliche-versorgung",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "gw-san",
    label: "GW-San",
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "aerztliche-versorgung",
      einheit: "gruppe",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "bhp",
    label: "BHP",
    composition: {
      grundzeichen: "ortsfeste-stelle",
      fachaufgabe: "rettungswesen",
      symbol: "bett",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "rmhp",
    label: "RMHP",
    composition: {
      grundzeichen: "stelle",
      fachaufgabe: "rettungswesen",
      symbol: "transport",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "bereitstellungsraum",
    label: "Bereitstellungsraum",
    composition: {
      grundzeichen: "ortsfeste-stelle",
      symbol: "sammeln",
      organisation: "hilfsorganisation",
    },
  },
  {
    id: "notunterkunft",
    label: "Notunterkunft",
    composition: {
      grundzeichen: "ortsfeste-stelle",
      fachaufgabe: "unterbringung",
      organisation: "hilfsorganisation",
    },
  },
];
