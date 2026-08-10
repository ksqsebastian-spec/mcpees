/**
 * Offizielle Herstellerlogos.
 *
 * Die Pfade stammen unverändert von den Anbietern selbst:
 *   HERO    — hero-software.de/assets/img/static/logos/hero-logomark-dark.svg
 *   Lexware — app.lexware.de/favicon.svg
 *   FLOWWER — www.flowwer.de/…/Flowwer-Logo.svg (nur das Zeichen, ohne Schriftzug)
 *
 * Bewusst unverändert: Farben und Formen bleiben, wie der Anbieter sie ausliefert.
 * Ein nachgezeichnetes Logo ist die schlechteste Variante — es sieht aus wie die Marke,
 * ist aber keine. Entweder das echte Zeichen oder ein neutrales.
 *
 * Verwendet werden sie hier nur, um das jeweilige System zu benennen. Das sind fremde
 * Marken, und diese Server sind keine offiziellen Integrationen der Anbieter — das steht
 * im Fuß jeder Seite.
 */

export interface Mark {
  /** Das Logo als eigenständiges SVG, in den Originalfarben. */
  inner: string;
  /** Hintergrund der Kachel — die Fläche, auf der der Anbieter sein Zeichen zeigt. */
  bg: string;
  /** Haarlinie, wenn der Hintergrund hell ist und sonst mit der Seite verschwimmt. */
  border?: boolean;
  /** Markenfarbe für kleine Akzente. */
  accent: string;
  /**
   * Anteil der Kachel, den das Zeichen einnimmt. Quadratische Zeichen wirken bei
   * gleichem Wert kleiner als breite — deshalb pro Marke einstellbar.
   */
  fill?: number;
}

export const HERO_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70.95 64">' +
    '<path fill="#1a1a1a" d="M66.38,0h-21.58l-1.46,20.75h-13.9L30.9,0h-11.43L0,36.57l4.57,27.43h21.58' +
    'l1.65-22.22h13.9l-1.65,22.22h11.43l19.47-36.57L66.38,0Z"/></svg>',
  bg: "#FFC400",
  accent: "#FFC400",
};

export const LEXWARE_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g fill="#ff4554">' +
    '<polygon points="11.1 8.8 8.7 11.8 10.7 14.3 12 14.3 13.8 14.3 15.5 14.3 11.1 8.8"/>' +
    '<polygon points="15.4 1.7 13.8 1.7 12 1.7 10.7 1.7 8.7 4.2 11.1 7.2 15.5 1.7 15.4 1.7"/>' +
    '<polygon points="7.8 4.8 5.3 1.7 .5 1.7 3 4.8 5.6 8 3 11.2 .5 14.3 5.2 14.3 5.3 14.3 7.8 11.2 10.4 8 7.8 4.8"/>' +
    "</g></svg>",
  bg: "#ffffff",
  border: true,
  accent: "#FF4554",
  fill: 0.64,
};

/**
 * FLOWWER zeigt sein Zeichen als App-Icon weiß auf Markenblau. Im Logo liegen die Formen
 * umgekehrt — blau auf weiß — mit anderen Deckkraftwerten. Die hier gesetzten Werte sind
 * aus dem offiziellen Favicon ausgemessen, damit die Kachel dem entspricht, was FLOWWER
 * selbst zeigt, statt aus dem Logo geraten zu sein.
 */
export const FLOWWER_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 1.9 18.1 27.4">' +
    '<path fill="#fff" fill-opacity="0.70" d="M4.55 11.07C2.03 11.07 0.00 13.10 0.00 15.61L0.00 6.52C0.00 4.00 2.03 1.97 4.55 1.97L13.67 1.97V1.98H28.05V5.00C28.05 8.35 25.33 11.07 21.98 11.07L4.55 11.07Z"/>' +
    '<path fill="#fff" fill-opacity="0.41" d="M0.00 24.71C0.00 22.20 2.04 20.16 4.55 20.16L13.53 20.16C16.05 20.16 18.08 18.13 18.08 15.62C18.08 13.10 16.05 11.07 13.53 11.07L4.55 11.07C2.04 11.07 0.00 13.10 0.00 15.62L0.00 24.71Z"/>' +
    '<path fill="#fff" fill-opacity="0.32" d="M-0.00 24.72C-0.00 22.20 2.03 20.17 4.54 20.17C7.06 20.17 9.09 22.20 9.09 24.72C9.09 27.23 7.06 29.27 4.54 29.27C2.03 29.27 -0.00 27.23 -0.00 24.72Z"/>' +
    "</svg>",
  bg: "#155EEF",
  accent: "#155EEF",
  fill: 0.6,
};

/** Voreinstellung; einzelne Marken weichen ab (siehe Mark.fill). */
const FILL = 0.56;

/**
 * Setzt ein Zeichen mittig auf eine abgerundete Fläche und liefert ein eigenständiges,
 * quadratisches SVG — dasselbe Bild dient als Favicon und als Kachel auf den Seiten.
 */
export function composeLogo(mark: Mark, size = 512): string {
  const vb = /viewBox="([\d.\s-]+)"/.exec(mark.inner)?.[1]?.trim().split(/\s+/).map(Number);
  const [, , vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 1, 1];

  const box = size * (mark.fill ?? FILL);
  const scale = Math.min(box / vw, box / vh);
  const tx = (size - vw * scale) / 2;
  const ty = (size - vh * scale) / 2;

  // Nur den Inhalt des inneren SVG übernehmen, nicht das <svg>-Element selbst.
  const body = mark.inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const radius = Math.round(size * 0.219);
  const stroke = mark.border
    ? `<rect x=".5" y=".5" width="${size - 1}" height="${size - 1}" rx="${radius}" ` +
      `fill="none" stroke="#dcdce2" stroke-width="${Math.max(1, size / 170)}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${mark.bg}"/>${stroke}` +
    `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(4)})">${body}</g>` +
    `</svg>`
  );
}
