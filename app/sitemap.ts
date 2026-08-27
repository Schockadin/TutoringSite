import type { MetadataRoute } from "next";

/**
 * Ersetzt die bisherige statische sitemap.xml.
 * Der Verwaltungsbereich taucht bewusst NICHT auf.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://dominic-zander.de/",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://dominic-zander.de/impressum",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://dominic-zander.de/datenschutz",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
