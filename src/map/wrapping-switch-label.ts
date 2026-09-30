/**
 * `styles` für einen `Switch`, dessen Label ein langer Dateiname ohne
 * Leerzeichen sein kann: Das Label bricht um, statt seine Zeile und damit das
 * Panel zu verbreitern.
 */
export const WRAPPING_SWITCH_LABEL = {
  label: { overflowWrap: "anywhere" },
} as const;
