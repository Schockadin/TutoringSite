import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { SiteHeader } from "@/components/SiteHeader";

const TITLE = "Nachhilfe Essen – Mathe, Naturwissenschaften & Latein | Dominic Zander";
const DESCRIPTION =
  "Professionelle Nachhilfe in Essen: Mathematik, Naturwissenschaften, Informatik und Latein für Klasse 5–13. Persönlich vor Ort, 13 Jahre Erfahrung. Jetzt unverbindlich Kontakt aufnehmen.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Nachhilfe Essen",
    "Mathe Nachhilfe Essen",
    "Latein Nachhilfe",
    "Nachhilfe Mathematik",
    "Abiturvorbereitung Essen",
    "Nachhilfe Naturwissenschaften",
    "Nachhilfelehrer Essen",
  ],
  authors: [{ name: "Dominic Zander" }],
  alternates: { canonical: "./" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  openGraph: {
    type: "website",
    siteName: "Dominic Zander Nachhilfe",
    locale: "de_DE",
    title: "Nachhilfe Essen – Mathe, Naturwissenschaften & Latein",
    description:
      "Professionelle Nachhilfe in Mathematik, Naturwissenschaften und Latein – persönlich vor Ort in Essen. 13 Jahre Erfahrung.",
    url: "https://dominic-zander.de/",
    images: [
      {
        url: "https://dominic-zander.de/img/profil-picture.jpg",
        width: 656,
        height: 779,
        alt: "Dominic Zander, Nachhilfelehrer aus Essen",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Nachhilfe Essen – Mathe, Naturwissenschaften & Latein",
    description:
      "Professionelle Nachhilfe in Mathematik, Naturwissenschaften und Latein – persönlich vor Ort in Essen.",
    images: ["https://dominic-zander.de/img/profil-picture.jpg"],
  },
  // Nicht-standardisierte Angaben, die die Metadata-API nicht typisiert kennt.
  other: {
    "format-detection": "telephone=yes",
    "geo.region": "DE-NW",
    "geo.placename": "Essen",
    "geo.position": "51.4556;7.0116",
    ICBM: "51.4556, 7.0116",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["EducationalOrganization", "LocalBusiness"],
  "@id": "https://dominic-zander.de/#organization",
  name: "Dominic Zander Nachhilfe",
  url: "https://dominic-zander.de/",
  image: "https://dominic-zander.de/img/profil-picture.jpg",
  logo: "https://dominic-zander.de/favicon.svg",
  description:
    "Professionelle Nachhilfe in Mathematik, Naturwissenschaften, Informatik und Latein für Klasse 5–13 – persönlich vor Ort in Essen und Umgebung.",
  areaServed: { "@type": "City", name: "Essen" },
  priceRange: "€€",
  email: "kontakt@dominic-zander.de",
  telephone: "+49-176-40138531",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Nordsternstr. 6a",
    postalCode: "45329",
    addressLocality: "Essen",
    addressRegion: "Nordrhein-Westfalen",
    addressCountry: "DE",
  },
  geo: { "@type": "GeoCoordinates", latitude: 51.4556, longitude: 7.0116 },
  founder: {
    "@type": "Person",
    name: "Dominic Zander",
    jobTitle: "Nachhilfelehrer",
    alumniOf: "Universität Duisburg-Essen",
  },
  knowsAbout: ["Mathematik", "Physik", "Chemie", "Biologie", "Informatik", "Latein"],
  contactPoint: {
    "@type": "ContactPoint",
    email: "kontakt@dominic-zander.de",
    telephone: "+49-176-40138531",
    contactType: "customer service",
    availableLanguage: "German",
  },
};

export default function HomePage() {
  return (
    <>
      {/* LCP-Bild vorladen für schnelleren Seitenaufbau. React 19 hebt
          Link-Tags selbstständig in den <head>. */}
      <link
        rel="preload"
        as="image"
        href="/img/herobanner.webp"
        type="image/webp"
        fetchPriority="high"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader withNav />

      <main>
        <section id="top" className="hero">
          <div className="container hero-inner">
            <h1>Nachhilfe, die ankommt.</h1>
            <p className="hero-sub">
              Individuelle Unterstützung in <strong>Mathematik</strong>,{" "}
              <strong>Naturwissenschaften</strong> und <strong>Latein</strong> – persönlich vor
              Ort in Essen und Umgebung.
            </p>
            <div className="hero-actions">
              <a href="#kontakt" className="btn btn-primary">
                Jetzt Kontakt aufnehmen
              </a>
              <a href="#faecher" className="btn btn-secondary">
                Angebot ansehen
              </a>
            </div>
          </div>
        </section>

        <section id="ueber-mich" className="section">
          <div className="container about-inner">
            <div className="about-photo">
              <picture>
                <source srcSet="/img/profil-picture.webp" type="image/webp" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/img/profil-picture.jpg"
                  alt="Dominic Zander, Nachhilfelehrer für Mathematik, Naturwissenschaften und Latein in Essen"
                  className="profile-picture"
                  width={250}
                  height={250}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="about-text">
              <h2>Über mich</h2>
              <p>
                Hallo, ich bin <strong>Dominic Zander</strong> und gebe seit 13 Jahren
                professionelle Nachhilfe in Mathematik, Naturwissenschaften und Latein. Ich habe
                während meines Studiums der Mathematik und Informatik an der Universität
                Duisburg-Essen sowohl einen Bachelor of Education als auch einen Master of Science
                erworben. Während dieser Zeit habe ich angefangen, nebenberuflich Nachhilfe zu
                geben. Mein Ziel ist es, Schüler:innen individuell zu fördern, Verständnis
                aufzubauen und sie auf Prüfungen vorzubereiten. Ich arbeite mit Geduld, Struktur
                und praxisnahen Beispielen, um den Lernstoff verständlich zu vermitteln. Während
                der gesamten Zeit habe ich auch immer für renommierte Nachhilfeinstitute
                gearbeitet, wodurch ich viele Erfahrungen sammeln konnte. Ich freue mich darauf,
                auch dir beim Lernen zu helfen!
              </p>
              <ul className="qualifications">
                <li>Bachelor of Education / Master of Science in Mathematik und Informatik</li>
                <li>
                  13 Jahre Erfahrung in der professionellen Nachhilfe (Schülerhilfe, Happy School
                  Essen)
                </li>
                <li>Klassenstufen: 5–13</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="faecher" className="section section-alt">
          <div className="container">
            <h2>Fächer &amp; Zielgruppen</h2>
            <p className="section-intro">
              Ein Überblick über mein Nachhilfe-Angebot. Bei Fragen zu einem bestimmten Thema
              einfach melden.
            </p>
            <div className="card-grid">
              <div className="card">
                <div className="card-icon">📐</div>
                <h3>Mathematik</h3>
                <p>Von Grundlagen bis Abitur: Algebra, Analysis, Geometrie, Stochastik.</p>
                <p className="card-meta">Klasse 5–13</p>
                <p className="card-meta">auch LK</p>
              </div>
              <div className="card">
                <div className="card-icon">🔬</div>
                <h3>Naturwissenschaften / Informatik</h3>
                <p>
                  Physik, Chemie, Biologie und Informatik verständlich erklärt – mit Bezug zur
                  Praxis.
                </p>
                <p className="card-meta">Klasse 5–13</p>
                <p className="card-meta">auch LK</p>
              </div>
              <div className="card">
                <div className="card-icon">🏛️</div>
                <h3>Latein</h3>
                <p>Grammatik, Vokabeln und Übersetzungstechnik – strukturiert aufgebaut.</p>
                <p className="card-meta">Klasse 7–11</p>
              </div>
            </div>
          </div>
        </section>

        <section id="ort-format" className="section">
          <div className="container">
            <h2>Ort</h2>
            <p className="section-intro">
              Unterricht findet ausschließlich bei Ihnen vor Ort statt.
            </p>
            <div className="card-grid single-col">
              <div className="card">
                <div className="card-icon">📍</div>
                <h3>Vor Ort in Essen</h3>
                <p>
                  Unterricht in Essen und Umgebung, bei dir zu Hause oder an einem vereinbarten
                  Ort.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="preise" className="section section-alt">
          <div className="container">
            <h2>Preise</h2>
            <p className="section-intro">
              Transparente Preise ohne versteckte Kosten. Individuelle Pakete auf Anfrage.
            </p>
            <div className="card-grid two-col">
              <div className="card price-card">
                <h3>Einzelstunde</h3>
                <p className="price">
                  35 €<span>/ 60min</span>
                </p>
                <p className="price">
                  45 €<span>/ 90min</span>
                </p>
                <p>Ideal zum Reinschnuppern oder für gezielte Prüfungsvorbereitung.</p>
              </div>
              <div className="card price-card featured">
                <h3>5er-Karte</h3>
                <p className="price">
                  150 €<span> für 5x 60min</span>
                </p>
                <p className="price">
                  200 €<span> für 5x 90min</span>
                </p>
                <p>Regelmäßige Unterstützung über mehrere Wochen hinweg.</p>
              </div>
              <div className="card price-card seasonal">
                <h3>Ferienkurse (5 Termine)</h3>
                <p className="price">
                  120 €<span> für 5x 60min</span>
                </p>
                <p className="price">
                  150 €<span> für 5x 90min</span>
                </p>
                <p>Intensive Vorbereitung auf Nachprüfungen oder das neue Schuljahr.</p>
              </div>
            </div>
            <p className="price-note">
              Alle Preise verstehen sich inkl. Vorbereitung, Fahrtkosten (in Essen) und
              Materialien. Fahrtkosten außerhalb von Essen auf Anfrage.
            </p>
          </div>
        </section>

        <section id="kontakt" className="section">
          <div className="container contact-inner">
            <div className="contact-form-wrap">
              <h2>Kontakt aufnehmen</h2>
              <p className="section-intro">
                Schreib mir kurz, worum es geht – ich melde mich zeitnah zurück.
              </p>
              <ContactForm />
            </div>

            <div className="contact-direct">
              <h3>Direkt erreichbar</h3>
              <ul className="contact-list">
                <li>
                  <span className="contact-label">E-Mail</span>
                  <a href="mailto:kontakt@dominic-zander.de">kontakt@dominic-zander.de</a>
                </li>
                <li>
                  <span className="contact-label">Telefon</span>
                  <a href="tel:+4917640138531">0176 401 38 531</a>
                </li>
                <li>
                  <span className="contact-label">Region</span>
                  <span>Essen</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
