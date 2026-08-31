/**
 * Erzeugt alle Icons aus den Quellen in design.mjs.
 *
 *   npm run icons
 *
 * Bewusst ein Generator statt handgepflegter Binärdateien: so bleibt
 * nachvollziehbar, woraus jedes Icon entstanden ist, und eine Farbänderung ist
 * eine Zeile statt zehn Neuexporte.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PAPER, fullSvg, maskableSvg, mediumSvg, simpleSvg } from "./design.mjs";

const OUT = join(process.cwd(), "public");
mkdirSync(OUT, { recursive: true });

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer();

/**
 * ICO-Container von Hand. Das Format ist ein 6-Byte-Kopf, je Bild ein
 * 16-Byte-Verzeichniseintrag und danach die Bilddaten - seit Vista dürfen das
 * eingebettete PNGs sein. Dafür lohnt keine Abhängigkeit.
 */
function buildIco(bilder) {
  const kopf = Buffer.alloc(6);
  kopf.writeUInt16LE(0, 0); // reserviert
  kopf.writeUInt16LE(1, 2); // Typ 1 = Icon
  kopf.writeUInt16LE(bilder.length, 4);

  let offset = 6 + bilder.length * 16;
  const eintraege = [];
  for (const { size, data } of bilder) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 bedeutet 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // Farbpalette: keine
    e.writeUInt8(0, 3); // reserviert
    e.writeUInt16LE(1, 4); // Farbebenen
    e.writeUInt16LE(32, 6); // Bit pro Pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    eintraege.push(e);
    offset += data.length;
  }
  return Buffer.concat([kopf, ...eintraege, ...bilder.map((b) => b.data)]);
}

const schreiben = (name, daten) => {
  writeFileSync(join(OUT, name), daten);
  const kb = (daten.length / 1024).toFixed(1);
  console.log(`  ${name.padEnd(28)} ${kb.padStart(6)} kB`);
};

console.log("Icons werden erzeugt:\n");

// 1. Ausgeliefertes SVG: reduzierte Fassung, reine Pfade, kein Text.
//    Browser zeigen es im Tab bei 16-32 px - dort wäre die volle Zeichnung
//    unlesbar, und Text würde auf fremden Geräten mit fremden Schriften
//    rendern.
schreiben("favicon.svg", Buffer.from(simpleSvg({ scheibe: true })));

// 2. Kleine Rastergrößen aus der reduzierten Fassung, auf Weiß, damit sie auch
//    in dunklen Browserleisten nicht verschwinden.
const klein = simpleSvg({ background: PAPER });
const ico = [];
for (const size of [16, 32, 48]) {
  const data = await png(klein, size);
  ico.push({ size, data });
}
schreiben("favicon.ico", buildIco(ico));
for (const { size, data } of ico) schreiben(`favicon-${size}x${size}.png`, data);

// 3. Apple-Touch-Icon: iOS unterstützt KEIN SVG und rundet die Ecken selbst.
//    Deshalb PNG, deckend, ohne eigene Rundung, mit etwas Luft am Rand.
//    Mittlere Fassung: bei 180 px wäre die Ringschrift nur elf Pixel hoch.
schreiben("apple-touch-icon.png", await png(mediumSvg({ background: PAPER, padding: 0.1 }), 180));

// 4. Android und PWA. Erst ab 512 px trägt die Zeichnung die Ringschrift.
schreiben("icon-192.png", await png(mediumSvg({ background: PAPER, padding: 0.05 }), 192));
schreiben("icon-512.png", await png(fullSvg({ background: PAPER, padding: 0.04 }), 512));

// 5. Maskierbar: Android schneidet beliebig zu, der Inhalt muss innerhalb von
//    80 % der Fläche bleiben.
schreiben("icon-maskable-512.png", await png(maskableSvg(), 512));

console.log("\nFertig.");
