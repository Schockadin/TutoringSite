import type { MetadataRoute } from "next";

/**
 * Ersetzt die bisherige statische robots.txt.
 *
 * Bewusst KEIN "Disallow: /app" – ein Disallow verhindert keine Indexierung
 * bereits bekannter URLs, sondern nur das Crawlen, und verraet den Pfad an
 * jeden, der die Datei liest. Die wirksame Massnahme ist der Header
 * "X-Robots-Tag: noindex, nofollow" (siehe next.config.ts und netlify.toml)
 * zusammen damit, dass keine oeffentliche Seite dorthin verlinkt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://dominic-zander.de/sitemap.xml",
  };
}
