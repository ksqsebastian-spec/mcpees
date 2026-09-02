/**
 * Offizielle Herstellerlogos.
 *
 * Die Pfade stammen unverändert von den Anbietern selbst:
 *   HERO    — hero-software.de/assets/img/static/logos/hero-logomark-dark.svg
 *   sevdesk — my.sevdesk.de/images/logo.svg (nur das Zeichen, ohne Schriftzug)
 *   Plausible — plausible.io/assets/images/icon/plausible_logo.svg (dito)
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
 * Plausible liefert Zeichen und Schriftzug in einer Datei
 * (plausible.io/assets/images/icon/plausible_logo.svg). Übernommen sind nur die beiden
 * Verlaufsflächen — der Schriftzug daneben fällt weg, er gehört nicht auf eine Kachel.
 *
 * Der Ausschnitt ist nicht geschätzt, sondern gemessen: die beiden Pfade füllen im
 * Original exakt 0/0 bis 45.36/60. Genau das ist die viewBox, und das ursprüngliche
 * Koordinatensystem bleibt damit erhalten — nötig, weil die beiden Verläufe
 * gradientUnits="userSpaceOnUse" benutzen. Wer hier auf 0 0 64 64 normalisieren würde,
 * behielte die Formen und verschöbe die Farben.
 *
 * Die Verlaufs-IDs heißen pl-a und pl-b statt wie im Original New_Gradient_Swatch_1.
 * Heute schadete der Originalname nicht — Übersichtsseite wie Anmeldeseite betten jede
 * Marke einzeln als data:-URI ein, und darin ist jede ihr eigenes Dokument. Sobald aber
 * zwei Marken nebeneinander in eine Seite geschrieben werden, gewinnt bei gleichem
 * Namen der zuerst geschriebene Verlauf für beide. Ein eindeutiger Name kostet nichts
 * und nimmt der Einbettung diese Bedingung ab.
 */
export const PLAUSIBLE_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.36 60"><defs><linearGradient ' +
    'id="pl-a" x1="14.8413403" y1="22.5436904" x2="27.4731407" y2="44.6493411" ' +
    'gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#909cf7"/><stop offset="1" ' +
    'stop-color="#4b38d8"/></linearGradient><linearGradient id="pl-b" x1="7.9837957" ' +
    'y1="-1.3582919" x2="21.0009873" y2="21.4217935" gradientUnits="userSpaceOnUse"><stop ' +
    'offset="0" stop-color="#909cf7"/><stop offset="1" ' +
    'stop-color="#4b38d8"/></linearGradient></defs><path fill="url(#pl-a)" d="M45.2456059,22.60' +
    '27536c-1.0911024,10.4557623-10.2327486,18.2272825-20.7452872,18.2272807h-4.047804v9.570007' +
    'c0,5.3019285-4.2980623,9.5999908-9.5999908,9.5999908H3.3599854c-1.8556687,0-3.3599854-1.50' +
    '43167-3.3599854-3.3599854v-19.7025146l5.0380685-7.0686343c.9118097-1.2793096,2.587965-1.75' +
    '66996,4.0369945-1.1497867l2.8657142,1.2002785c1.4444817.6050081,3.1153774.12945,4.0247968-' +
    '1.1455083l6.7172007-9.417163c.9071158-1.2717288,2.5743943-1.7450816,4.0144283-1.1397262l5.' +
    '5198678,2.3204187c1.4430268.6066135,3.1137697.1319561,4.0223175-1.1427389l6.4594145-9.0625' +
    '757c2.0248091,3.5597961,3.0145069,7.7887694,2.5468032,12.2706573Z"/><path ' +
    'fill="url(#pl-b)" d="M3.2920959,28.8726296c.82329-1.1551271,2.0209115-2.0434967,3.4138697-' +
    '2.3114381,1.0861554-.2089265,2.156905-.0992829,3.1472499.3155174l2.8649902,1.1999512c.1651' +
    '001.0691528.3388672.104187.5164795.104187.4365845,0,.8488159-.2124634,1.1026611-.5683594l6' +
    '.5942097-9.2447929c.8231505-1.154021,2.0204067-2.0410099,3.4124878-2.3083136,1.0821376-.20' +
    '77892,2.1463585-.0989034,3.1282512.3138487l5.5198364,2.3204346c.1665649.0700684.3417969.10' +
    '55298.5206909.1055298.4351807,0,.8456421-.2113647,1.0979614-.5653687l6.9192505-9.7077637C3' +
    '7.8272145,3.3644409,31.7802174,0,24.9450124,0H3.3599904C1.5043217,0,.000005,1.5043167.0000' +
    '05,3.3599854v30.1316528l3.2920909-4.6190085Z"/></svg>',
  /*
   * Weiße Kachel mit Haarlinie statt einer Farbfläche: das Zeichen ist selbst ein
   * Farbverlauf und steht bei Plausible auf Weiß. Auf eine eigene Farbe gesetzt wäre es
   * nicht mehr das Zeichen des Anbieters, sondern eine Auslegung davon.
   */
  bg: "#ffffff",
  border: true,
  accent: "#4b38d8",
  fill: 0.62,
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
