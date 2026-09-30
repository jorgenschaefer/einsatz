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
  // Ein schlichtes Objekt statt `Modal.extend`: Das Theme wird auch in Server
  // Components geladen, und dort ist `Modal` nur eine Client-Referenz ohne
  // `extend` – jede Seite antwortete dann mit 500.
  components: {
    Modal: {
      styles: {
        header: { alignItems: "flex-start" },
        title: {
          fontWeight: 600,
          lineHeight: 1.35,
          minWidth: 0,
          overflowWrap: "anywhere",
        },
      },
    },
  },
});
