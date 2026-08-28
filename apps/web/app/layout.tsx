import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Shell } from "../components/Shell";
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
  metadataBase: new URL("https://alloyra.fly.dev"),
  title: { default: "Alloyra", template: "%s | Alloyra" },
  description:
    "Alloy-design workbench for metallurgists: duty-driven screening, failure-mode audits, microstructure search, and composition design with provenance on every value. Research preview.",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "Alloyra",
    title: "Alloyra",
    description:
      "Alloy-design workbench: duty-driven screening, failure-mode audits, microstructure search, composition design.",
    type: "website",
    images: ["/og.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
