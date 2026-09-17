import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUTA PASS — banc technique",
  description: "Déclenchement manuel des actions PASS, pour éprouver le pont natif sans ASR.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // L'écran est utilisé sur un téléphone tenu en main, souvent au soleil.
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
