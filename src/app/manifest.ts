import type { MetadataRoute } from "next";
import { PRIMARY_COLOR } from "./theme";

/** Minimales Web-App-Manifest: installierbar, Vollbild, Icon – ohne Offline-Caching. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lageführung",
    short_name: "Lageführung",
    description: "Schlanke Lageführung für den Katastrophenschutz",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: PRIMARY_COLOR,
    lang: "de",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
