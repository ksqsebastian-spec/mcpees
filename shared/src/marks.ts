/**
 * Offizielle Herstellerlogos.
 *
 * Die Pfade stammen unverändert von den Anbietern selbst:
 *   HERO    — hero-software.de/assets/img/static/logos/hero-logomark-dark.svg
 *   Lexware — app.lexware.de/favicon.svg
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
