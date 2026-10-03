import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { headers } from "next/headers";
import { ActionNotifications } from "./ActionNotifications";
import { AppFooter } from "./AppFooter";
import { theme } from "./theme";

export const metadata: Metadata = {
  title: "Lageführung",
  description: "Schlanke Lageführung für den Katastrophenschutz",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Set by src/proxy.ts; reading it also renders every page per request,
  // which the nonce needs.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="de" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" nonce={nonce} />
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
