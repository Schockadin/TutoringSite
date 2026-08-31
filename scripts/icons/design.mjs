/**
 * Die Bildquellen für alle Icons.
 *
 * Drei Fassungen, weil ein Icon nicht einfach herunterskaliert werden darf:
 * bei 16 Pixeln verschwimmen Ringschrift, Atom und Schriftrolle zu einem
 * Fleck. Je kleiner die Darstellung, desto weniger Zeichnung und desto
 * kräftiger der Strich:
 *
 *   fullSvg   ab 256 px   Ring, Monogramm, Fächersymbole, Ringschrift
 *   mediumSvg 96-192 px   dasselbe ohne Schrift, kräftiger gezeichnet
 *   simpleSvg bis 48 px   nur Ring und Monogramm, sehr kräftig
 *
 * Farben nach Vorlage: Navy als Träger, Ocean Blue als Akzent.
 */
export const NAVY = "#1D3B5C";
export const OCEAN = "#2E86C1";
export const PAPER = "#FFFFFF";

/** Wurzel-Z-Monogramm als reine Pfade – ohne Schriftabhängigkeit. */
function monogram({ stroke = NAVY, width = 34, scale = 1, dx = 0, dy = 0 }) {
  const t = `translate(${256 + dx} ${256 + dy}) scale(${scale}) translate(-256 -256)`;
  return `
    <g transform="${t}" fill="none" stroke="${stroke}" stroke-width="${width}"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="M116 262 h34 l40 82 L246 150 H404" />
      <path d="M262 206 H372 L262 330 H382" />
    </g>`;
}

/** Atom: Kern plus drei gekippte Bahnen. */
function atom({ cx, cy, r, color = OCEAN, width = 9 }) {
  return `
    <g transform="translate(${cx} ${cy})" fill="none" stroke="${color}" stroke-width="${width}">
      <ellipse rx="${r}" ry="${r * 0.4}" />
      <ellipse rx="${r}" ry="${r * 0.4}" transform="rotate(60)" />
      <ellipse rx="${r}" ry="${r * 0.4}" transform="rotate(-60)" />
      <circle r="${r * 0.22}" fill="${color}" stroke="none" />
    </g>`;
}

/** Schriftrolle: Blatt mit eingerollten Enden und Textzeilen. */
function scroll({ x, y, w, h, color = OCEAN, width = 8 }) {
  const inset = w * 0.18;
  return `
    <g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"
       stroke-linejoin="round">
      <path d="M${x + inset} ${y} h${w - inset * 2}
               a${inset} ${inset} 0 0 1 ${inset} ${inset}
               v${h - inset * 2}
               a${inset} ${inset} 0 0 1 -${inset} ${inset}
               h-${w - inset * 2}
               a${inset} ${inset} 0 0 1 -${inset} -${inset}
               v-${h - inset * 2}
               a${inset} ${inset} 0 0 1 ${inset} -${inset} z" />
      <path d="M${x + w * 0.3} ${y + h * 0.36} h${w * 0.4}" />
      <path d="M${x + w * 0.3} ${y + h * 0.56} h${w * 0.4}" />
      <path d="M${x + w * 0.3} ${y + h * 0.74} h${w * 0.22}" />
    </g>`;
}

/**
 * Ungefähre Vorschubbreiten einer fetten Grotesk, in em.
 *
 * Nötig, weil die Buchstaben einzeln gesetzt werden und der Rasterizer uns
 * keine Textmaße zurückgibt. Die Werte müssen nur zueinander stimmen, nicht
 * absolut: sie verteilen den Text auf dem Bogen. Gleichmäßige Winkelschritte
 * wären falsch – ein W braucht dreimal so viel Bogen wie ein I, sonst kleben
 * die breiten Buchstaben aneinander und die schmalen stehen einzeln.
 */
const BREITEN = {
  A: 0.774, B: 0.762, C: 0.734, D: 0.830, E: 0.683, F: 0.683, G: 0.821,
  H: 0.837, I: 0.372, J: 0.372, K: 0.775, L: 0.637, M: 0.995, N: 0.837,
  O: 0.850, P: 0.733, Q: 0.850, R: 0.770, S: 0.720, T: 0.682, U: 0.812,
  V: 0.774, W: 1.103, X: 0.774, Y: 0.724, Z: 0.703,
  " ": 0.348, "·": 0.380,
};

/**
 * Text auf einem Kreisbogen – Buchstabe für Buchstabe.
 *
 * Nicht über <textPath>: die verbreiteten SVG-Rasterizer setzen einfachen Text
 * zwar, Text entlang eines Pfades aber nicht – der Ring bliebe leer. Jeder
 * Buchstabe wird deshalb selbst positioniert und gedreht.
 *
 * Der Bogen wird aus der Textbreite berechnet und um den tiefsten Punkt
 * (90 Grad) zentriert, nicht umgekehrt. So bleibt der Zeilenabstand richtig,
 * egal wie lang der Text ist.
 *
 * Die Drehung ist der Bogenwinkel minus 90 Grad: unten steht der Buchstabe
 * aufrecht, nach links und rechts kippt er mit der Tangente mit.
 */
function arcText({
  text,
  cx = 256,
  cy = 256,
  r = 204,
  size = 32,
  laufweite = 0.03,
  color = NAVY,
  accent = OCEAN,
}) {
  const zeichen = [...text];
  const breite = (z) => ((BREITEN[z] ?? 0.75) + laufweite) * size;
  // Bogenlänge in Grad: Strecke geteilt durch Radius, im Bogenmaß.
  const grad = (strecke) => (strecke / r) * (180 / Math.PI);
  const rad = (g) => (g * Math.PI) / 180;

  const spanne = grad(zeichen.reduce((s, z) => s + breite(z), 0));
  let winkel = 90 + spanne / 2; // links unten beginnen, Winkel läuft abwärts

  return zeichen
    .map((z) => {
      const schritt = grad(breite(z));
      const mitte = winkel - schritt / 2;
      winkel -= schritt;
      if (z === " ") return "";
      const x = cx + r * Math.cos(rad(mitte));
      const y = cy + r * Math.sin(rad(mitte));
      const fuellung = z === "·" ? accent : color;
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" transform="rotate(${(mitte - 90).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-weight="700" font-size="${size}" text-anchor="middle" fill="${fuellung}">${z}</text>`;
    })
    .filter(Boolean)
    .join("\n    ");
}

const rahmen = (inhalt, { background = null, radius = 0, padding = 0 } = {}) => {
  const bg = background
    ? `<rect width="512" height="512"${radius ? ` rx="${radius}"` : ""} fill="${background}"/>`
    : "";
  const s = 1 - padding;
  const g = padding
    ? `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${inhalt}</g>`
    : inhalt;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bg}
  ${g}
</svg>`;
};

/**
 * Vollständige Fassung: Ring, Monogramm, Fächersymbole, Ringschrift.
 * Nur für große Darstellungen (ab 256 px) und ausschließlich als PNG – der
 * Ringtext braucht eine Schrift und wird beim Rastern fest eingebacken.
 */
export function fullSvg(opts = {}) {
  return rahmen(
    `<circle cx="256" cy="256" r="236" fill="none" stroke="${NAVY}" stroke-width="17"/>
    ${monogram({ scale: 0.6, dx: -48, dy: -52 })}
    ${atom({ cx: 366, cy: 168, r: 40, width: 8 })}
    ${scroll({ x: 336, y: 232, w: 74, h: 90, width: 7 })}
    ${arcText({ text: "MATHE · NAWI · LATEIN" })}`,
    opts,
  );
}

/**
 * Mittlere Fassung für Startbildschirm-Icons (96–192 px): dieselbe
 * Komposition, aber ohne Ringschrift und mit kräftigerem Strich.
 *
 * Der Grund ist gemessen, nicht theoretisch: bei 180 px wäre die Ringschrift
 * knapp elf Pixel hoch und zerfällt beim Rastern zu einem grauen Saum. Ein
 * Icon auf dem Startbildschirm wird ohnehin nicht gelesen, sondern erkannt.
 */
export function mediumSvg(opts = {}) {
  return rahmen(
    `<circle cx="256" cy="256" r="234" fill="none" stroke="${NAVY}" stroke-width="24"/>
    ${monogram({ width: 38, scale: 0.68, dx: -46, dy: -40 })}
    ${atom({ cx: 382, cy: 166, r: 46, width: 11 })}
    ${scroll({ x: 338, y: 244, w: 84, h: 100, width: 9 })}`,
    opts,
  );
}

/**
 * Reduzierte Fassung für kleine Größen und für das ausgelieferte SVG.
 * Kein Text, keine Feinheiten, kräftigere Striche – und ein größeres
 * Monogramm, das den Ring besser ausfüllt.
 *
 * `scheibe` legt eine weiße Kreisfläche unter den Ring. Für das
 * ausgelieferte SVG ist das nötig: transparent wäre das Navy in einer
 * dunklen Browserleiste kaum noch zu sehen. Die PNG brauchen es nicht, die
 * stehen ohnehin auf weißem Grund.
 */
export function simpleSvg({ scheibe = false, ...opts } = {}) {
  return rahmen(
    `${scheibe ? `<circle cx="256" cy="256" r="246" fill="${PAPER}"/>` : ""}
    <circle cx="256" cy="256" r="222" fill="none" stroke="${NAVY}" stroke-width="34"/>
    ${monogram({ width: 46, scale: 1.02, dx: -8, dy: 6 })}`,
    opts,
  );
}

/**
 * Maskierbares Icon für Android: der Inhalt muss innerhalb von 80 % der
 * Fläche liegen, weil das System beliebig zuschneidet.
 */
export function maskableSvg() {
  return simpleSvg({ background: PAPER, padding: 0.28 });
}
