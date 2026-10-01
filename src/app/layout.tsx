import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { ActionNotifications } from "./ActionNotifications";
import { AppFooter } from "./AppFooter";
import { theme } from "./theme";

export const metadata: Metadata = {
  title: "Lageführung",
  description: "Schlanke Lageführung für den Katastrophenschutz",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ActionNotifications />
          {children}
          <AppFooter />
        </MantineProvider>
      </body>
    </html>
  );
}
