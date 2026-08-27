import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Die Bilder sind bereits handoptimiert als WebP vorhanden und werden über
  // <picture> ausgeliefert. Kein next/image für das LCP-Bild, damit die
  // bestehende Optimierung nicht gegen eine Abhängigkeit vom Image-CDN getauscht wird.
  images: { unoptimized: true },

  // Die bisherigen Seiten lagen unter /impressum.html und /datenschutz.html.
  // Diese URLs sind indexiert und verlinkt, deshalb dauerhaft weiterleiten
  // statt sie ins Leere laufen zu lassen.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/impressum.html", destination: "/impressum", permanent: true },
      { source: "/datenschutz.html", destination: "/datenschutz", permanent: true },
    ];
  },

  // Sicherheitsheader, die bisher in netlify.toml standen. Hier gepflegt,
  // damit sie auch bei `next dev` und `next start` greifen.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Der Verwaltungsbereich gehört in keinen geteilten Cache und in keinen Suchindex.
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
