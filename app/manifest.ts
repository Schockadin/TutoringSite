import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest, ausgeliefert unter /manifest.webmanifest.
 *
 * Next.js verlinkt diese Datei automatisch in jeder Seite – ein eigenes
 * <link rel="manifest"> wäre doppelt.
 *
 * Zweck ist in erster Linie das Startbildschirm-Icon auf Android. Der
 * Einstiegspunkt ist bewusst die öffentliche Startseite und nicht der
 * Verwaltungsbereich: das Manifest ist öffentlich abrufbar, und der Pfad
 * /app gehört dort ebenso wenig hinein wie in die robots.txt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dominic Zander – Nachhilfe in Essen",
    short_name: "D. Zander",
    description:
      "Nachhilfe in Mathematik, Naturwissenschaften und Latein in Essen – online und vor Ort.",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      // "any" für die normale Darstellung, "maskable" für Androids
      // adaptive Icons: das System schneidet dort beliebig zu, deshalb
      // eine eigene Fassung mit Sicherheitsabstand.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
