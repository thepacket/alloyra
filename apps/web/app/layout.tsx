import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { DATASET_VERSION } from "@alloyra/data";
import { Rail } from "../components/Rail";
import { CommandPalette } from "../components/CommandPalette";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--archivo",
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--plex-mono",
});

export const metadata: Metadata = {
  title: "Alloyra",
  description: "Alloy-design workbench",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <div className="shell">
          <header className="titlebar">
            <span className="wordmark">
              Alloy<b>ra</b>
            </span>
            <CommandPalette />
            <span className="spacer" />
            <span className="sys-chip">
              DATA <b>{DATASET_VERSION}</b>
            </span>
            <span className="sys-chip">
              UNITS <b>SI</b>
            </span>
          </header>
          <Rail />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
