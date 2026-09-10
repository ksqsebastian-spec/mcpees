#!/usr/bin/env node
/**
 * Erzeugt shared/src/icons.generated.ts — jede Marke als PNG und ICO.
 *
 * Warum überhaupt: `logoSvg` deckt nur `/favicon.svg` ab. Wer ein Icon abholt —
 * Connector-Listen, Lesezeichenleisten, Startbildschirme — fragt nach favicon.ico
 * oder einem PNG und kann mit SVG nichts anfangen. Ohne diese Dateien bleibt die
 * Stelle leer, wo das Zeichen stehen sollte.
 *
 * Gerastert wird mit Chromium, weil die Herstellerzeichen echte Pfade sind und kein
 * Pixelraster — von Hand geht das nicht. Deshalb läuft das Skript NICHT im normalen
 * Build: das Ergebnis wird eingecheckt und nur neu erzeugt, wenn sich eine Marke
 * ändert. `npm run gen:icons` braucht Playwright, `npm run build` nicht.
 *
 *   npm run gen:icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HERO_MARK, SEVDESK_MARK, DOCUWARE_MARK, composeLogo } from "../shared/src/marks.ts";

/* Playwright steht bewusst nicht in package.json: gebraucht wird es nur hier, und das
   Ergebnis ist eingecheckt. Wer eine Marke ändert, installiert es einmal. */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright fehlt. Einmalig: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MARKS = [
  { konstante: "HERO_ICON", mark: HERO_MARK },
  { konstante: "SEVDESK_ICON", mark: SEVDESK_MARK },
  { konstante: "DOCUWARE_ICON", mark: DOCUWARE_MARK },
];

/* --------------------------------------------------------------- PNG-Kodierung */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Rohe RGBA-Pixel zu PNG. Chromiums PNG ist größer als nötig, deshalb neu gepackt. */
function png(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bit je Kanal
  ihdr[9] = 6; // RGBA

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // Filter „keiner"
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO mit PNG im Rumpf. Breite/Höhe 0 steht laut Format für 256. */
function ico(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(1, 4); // ein Bild
  const entry = Buffer.alloc(16);
  entry.writeUInt16LE(1, 4); // Ebenen
  entry.writeUInt16LE(32, 6); // Bit je Pixel
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // Offset hinter Header und Eintrag
  return Buffer.concat([header, entry, pngBuf]);
}

/* ------------------------------------------------------------------- Rastern */

const browser = await chromium.launch();

/** Liefert rohe RGBA-Pixel, damit die Kanten nicht zweimal durch einen Kodierer laufen. */
async function raster(svg, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  const shot = await page.screenshot({ omitBackground: true, type: "png" });
  const pixels = await page.evaluate(
    async ([dataUrl, s]) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, s, s);
      return Array.from(ctx.getImageData(0, 0, s, s).data);
    },
    [`data:image/png;base64,${shot.toString("base64")}`, size],
  );
  await page.close();
  return Buffer.from(pixels);
}

const teile = [];
for (const { konstante, mark } of MARKS) {
  const svg = composeLogo(mark, 512);
  const p512 = png(await raster(svg, 512), 512);
  const p180 = png(await raster(svg, 180), 180);
  const i256 = ico(png(await raster(svg, 256), 256));

  teile.push(
    `export const ${konstante}: RasterIcon = {\n` +
      `  png512: "${p512.toString("base64")}",\n` +
      `  png180: "${p180.toString("base64")}",\n` +
      `  ico: "${i256.toString("base64")}",\n` +
      `};`,
  );
  const kb = (b) => (b.length / 1024).toFixed(1) + " kB";
  console.log(`${konstante.padEnd(14)} PNG 512 ${kb(p512)}, PNG 180 ${kb(p180)}, ICO ${kb(i256)}`);
}

await browser.close();

writeFileSync(
  resolve(root, "shared/src/icons.generated.ts"),
  `/* Erzeugt von scripts/gen-icons.mjs — nicht von Hand ändern.\n` +
    `   Die Marken als PNG und ICO, base64. Siehe den Kopf des Skripts, warum es das\n` +
    `   neben logoSvg noch braucht. */\n\n` +
    `import type { RasterIcon } from "./types";\n\n` +
    teile.join("\n\n") +
    "\n",
);

console.log("shared/src/icons.generated.ts geschrieben");
