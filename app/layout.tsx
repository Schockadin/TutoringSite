import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dominic-zander.de"),
  icons: {
    // Reihenfolge nach Vorliebe der Browser: wer SVG kann, nimmt es und
    // skaliert scharf; die PNG dienen als Rückfall, favicon.ico für
    // Altbestand und Windows-Verknüpfungen.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: [{ url: "/favicon.ico", sizes: "16x16 32x32 48x48" }],
    // iOS unterstützt für Apple-Touch-Icons kein SVG – hier muss ein PNG
    // stehen, sonst zeigt der Startbildschirm einen leeren Platzhalter.
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
