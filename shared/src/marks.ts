/**
 * Offizielle Herstellerlogos.
 *
 * Die Pfade stammen unverändert von den Anbietern selbst:
 *   HERO     — hero-software.de/assets/img/static/logos/hero-logomark-dark.svg
 *   sevdesk  — my.sevdesk.de/images/logo.svg (nur das Zeichen, ohne Schriftzug)
 *   DocuWare — start.docuware.com, „DocuWare Icon.svg" (das Favicon des Anbieters)
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

/**
 * sevdesk liefert Zeichen und Schriftzug in einer Datei. Übernommen sind nur die drei
 * weißen Balken — sie stehen im Original auf einer abgerundeten Fläche in #FB523B, also
 * genau dem, was composeLogo hier ohnehin baut. Der Ausschnitt (viewBox ab 7.89/7.56) und
 * fill = 16.22/32 sind aus dem Original abgemessen, damit die Kachel dieselben Proportionen
 * hat wie das App-Icon von sevdesk und nicht nur so ähnlich aussieht.
 */
export const SEVDESK_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="7.8889 7.5556 16.2222 15.7778">' +
    '<path fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd" d="M22.4444 7.55556C21.524 ' +
    "7.55556 20.7778 8.30175 20.7778 9.22222V21.6667C20.7778 22.5871 21.524 23.3333 22.4444 " +
    "23.3333C23.3649 23.3333 24.1111 22.5871 24.1111 21.6667V9.22222C24.1111 8.30175 23.3649 " +
    "7.55556 22.4444 7.55556ZM14.3333 13.8889C14.3333 12.9684 15.0795 12.2222 16 12.2222C16.9205 " +
    "12.2222 17.6667 12.9684 17.6667 13.8889V21.6667C17.6667 22.5871 16.9205 23.3333 16 " +
    "23.3333C15.0795 23.3333 14.3333 22.5871 14.3333 21.6667V13.8889ZM7.88889 17.8889C7.88889 " +
    "16.9684 8.63508 16.2222 9.55556 16.2222C10.476 16.2222 11.2222 16.9684 11.2222 " +
    "17.8889V21.6667C11.2222 22.5871 10.476 23.3333 9.55556 23.3333C8.63508 23.3333 7.88889 " +
    '22.5871 7.88889 21.6667V17.8889Z"/></svg>',
  bg: "#FB523B",
  accent: "#FB523B",
  fill: 0.507,
};

/**
 * DocuWare liefert sein Zeichen selbst als SVG aus — es hängt als `shortcut icon` an
 * start.docuware.com (`__ Corporate Website/Logos/DocuWare Icon.svg`). Übernommen sind die
 * drei Formen unverändert: der weiße Kreis und darüber die beiden blauen Pfade, die
 * zusammen den gestuften Ring ergeben. Geändert ist nur die Schreibweise — im Original
 * hängen die Farben an CSS-Klassen (`.cls-1`, `.cls-2`) in einem `<style>`-Block; hier
 * stehen sie als `fill` am Pfad. Dieselben Pfade, dieselben Farben, nur ohne Klassen, die
 * sich mit anderen eingebetteten SVGs auf derselben Seite ins Gehege kämen.
 *
 * DocuWare zeigt das Zeichen blau auf Weiß, nicht weiß auf Blau. Deshalb ist die Kachel
 * hier weiß und bekommt die Haarlinie, die sie sonst auf der ebenfalls weißen Seite
 * verlöre — die Farben des Anbieters bleiben, wie sie sind.
 */
export const DOCUWARE_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 172.51 172.5">' +
    '<circle fill="#ffffff" cx="86.25" cy="86" r="58.21"/>' +
    '<path fill="#303ab2" d="M113.48,86a32.84,32.84,0,0,1-32.86,32.86h-.06V97H58.63V75.08H80.56V53.15h.06A32.89,32.89,0,0,1,113.48,86"/>' +
    '<path fill="#303ab2" d="M147.24,25a86.24,86.24,0,1,0,25.27,61,86,86,0,0,0-25.27-61M119.79,125.17a55.05,55.05,0,0,1-39.17,16.22h-.06V118.88H58.63V97H36.69V75.08H58.63V53.15H80.56V30.62h.06a55.39,55.39,0,0,1,39.17,94.55"/></svg>',
  bg: "#ffffff",
  border: true,
  accent: "#303AB2",
  /* Ein Kreis füllt seine Umschreibung ganz aus und wirkt auf der Kachel darum kleiner
     als ein Zeichen, das Ecken hat — deshalb hier deutlich über der Voreinstellung. */
  fill: 0.7,
};

/** Voreinstellung; einzelne Marken weichen ab (siehe Mark.fill). */
const FILL = 0.56;

/**
 * Setzt ein Zeichen mittig auf eine abgerundete Fläche und liefert ein eigenständiges,
 * quadratisches SVG — dasselbe Bild dient als Favicon und als Kachel auf den Seiten.
 */
export function composeLogo(mark: Mark, size = 512): string {
  const vb = /viewBox="([\d.\s-]+)"/.exec(mark.inner)?.[1]?.trim().split(/\s+/).map(Number);
  // minX/minY sind nicht immer 0: wer ein Zeichen aus einem größeren Logo herausschneidet,
  // verschiebt damit den Ausschnitt, statt die Pfadkoordinaten anzufassen.
  const [minX, minY, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 1, 1];

  const box = size * (mark.fill ?? FILL);
  const scale = Math.min(box / vw, box / vh);
  const tx = (size - vw * scale) / 2 - minX * scale;
  const ty = (size - vh * scale) / 2 - minY * scale;

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
