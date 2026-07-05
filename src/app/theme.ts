import { createTheme, type MantineColorsTuple } from "@mantine/core";

// DRK-Rot als Akzentfarbe (unabhängig von den Organisationsfarben der taktischen Zeichen).
const drk: MantineColorsTuple = [
  "#ffe8ea",
  "#ffcfd3",
  "#f89ba2",
  "#f2666f",
  "#ed3a45",
  "#eb1f2c",
  "#ea1120",
  "#d10010",
  "#bb000b",
  "#a30003",
];

const PRIMARY_SHADE = 6;

/** Die effektive Akzentfarbe (DRK-Rot) – Quelle für Theme und Manifest. */
export const PRIMARY_COLOR = drk[PRIMARY_SHADE];

export const theme = createTheme({
  primaryColor: "drk",
  primaryShade: PRIMARY_SHADE,
  colors: { drk },
});
