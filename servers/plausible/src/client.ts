/**
 * Client für die Plausible Stats API v2 (POST /api/v2/query).
 *
 * Die API ist klein — ein einziger Endpunkt — aber sie hat vier Eigenheiten, die alle
 * hier abgefangen werden und nicht erst beim Nutzer auffallen sollen:
 *
 *  1. **Ein absoluter Zeitraum ist ein Array, keine Zeichenkette.** `date_range` nimmt
 *     entweder ein Kürzel ("7d", "month") oder ["2026-01-01","2026-01-31"]. Wer
 *     "2026-01-01,2026-01-31" als Zeichenkette schickt, bekommt einen 400er, dessen Text
 *     das Problem nicht benennt. `encodeDateRange` macht daraus immer die richtige Form.
 *  2. **Ergebnisse sind Parallel-Arrays.** Plausible antwortet mit
 *     `{ dimensions: [...], metrics: [...] }` je Zeile — die Namen stehen nur in der
 *     Anfrage. Wer das roh weiterreicht, zwingt das Modell, Spalten zu zählen. `zip()`
 *     setzt die Namen wieder an die Werte.
 *  3. **`conversion_rate` braucht einen Ziel-Bezug.** Ohne Dimension `event:goal` oder
 *     einen Zielfilter lehnt Plausible ab. Das ist die häufigste Fehlbedienung und wird
 *     deshalb hier geprüft, mit einer Meldung, aus der hervorgeht, was fehlt.
 *  4. **Ziel-Filter kennen keine Verneinung.** `event:goal` erlaubt nur "is" und
 *     "contains"; "is_not" ergibt einen 400er.
 *
 * Kein Zeitlimit und keine Ratenbegrenzung: Plausible veröffentlicht für die Stats API
 * ein Limit von 600 Anfragen pro Stunde und Konto. Ein Gespräch kommt dort nicht hin —
 * eine künstliche Bremse wie beim sevdesk-Client wäre hier nur Ballast. 429 wird
 * trotzdem als solches gemeldet, damit die Ursache im Klartext dasteht.
 */

export const PLAUSIBLE_BASE = "https://plausible.io";

/**
 * Die Kennzahlen der Stats API v2. Die Liste ist bewusst eingefroren und nicht
 * durchgereicht: ein Tippfehler soll hier auffallen und nicht als 400 ohne Feldbezug
 * zurückkommen.
 */
export const METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "views_per_visit",
  "bounce_rate",
  "visit_duration",
  "events",
  "scroll_depth",
  "percentage",
  "conversion_rate",
  "group_conversion_rate",
  "average_revenue",
  "total_revenue",
  "time_on_page",
] as const;

export type Metric = (typeof METRICS)[number];

/**
 * Die Dimensionen der Stats API v2.
 *
 * Zu Land, Region und Stadt gibt es jeweils zwei: `visit:country` liefert den ISO-Code
 * ("DE"), `visit:country_name` den Namen ("Germany"). Für eine Antwort im Gespräch ist
 * fast immer die Namensfassung gemeint — `preferReadableGeo()` unten setzt sie deshalb
 * automatisch ein.
 */
export const DIMENSIONS = [
  "event:page",
  "event:goal",
  "event:hostname",
  "visit:entry_page",
  "visit:exit_page",
  "visit:source",
  "visit:referrer",
  "visit:channel",
  "visit:utm_medium",
  "visit:utm_source",
  "visit:utm_campaign",
  "visit:utm_content",
  "visit:utm_term",
  "visit:device",
  "visit:browser",
  "visit:browser_version",
  "visit:os",
  "visit:os_version",
  "visit:country",
  "visit:region",
  "visit:city",
  "visit:country_name",
  "visit:region_name",
  "visit:city_name",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

/** Zeitdimensionen für Verlaufsauswertungen. Sie stehen nicht in DIMENSIONS. */
export const TIME_DIMENSIONS = ["time:day", "time:week", "time:month", "time:hour"] as const;

/** Eigene Ereignis-Eigenschaften heißen `event:props:<name>` und sind nicht aufzählbar. */
export const PROPS_PREFIX = "event:props:";

export const FILTER_OPERATORS = ["is", "is_not", "contains", "contains_not"] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export class PlausibleError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PlausibleError";
  }
}

/* ── Prüfungen ────────────────────────────────────────────────────────────── */

export const isProp = (d: string) => d.startsWith(PROPS_PREFIX) && d.length > PROPS_PREFIX.length;

export function checkMetric(m: string): Metric {
  if (!(METRICS as readonly string[]).includes(m)) {
    throw new PlausibleError(
      `'${m}' ist keine Kennzahl der Stats API. Möglich sind: ${METRICS.join(", ")}.`,
    );
  }
  return m as Metric;
}

export function checkDimension(d: string): string {
  if ((DIMENSIONS as readonly string[]).includes(d) || isProp(d)) return d;
  if ((TIME_DIMENSIONS as readonly string[]).includes(d)) return d;
  throw new PlausibleError(
    `'${d}' ist keine Dimension der Stats API. Möglich sind: ${DIMENSIONS.join(", ")} ` +
      `— oder eine eigene Ereignis-Eigenschaft als '${PROPS_PREFIX}<name>'.`,
  );
}

/**
 * 'YYYY-MM-DD' prüfen. Plausible nimmt auch offensichtlich falsche Daten entgegen und
 * antwortet mit einem leeren Ergebnis statt mit einem Fehler — '2026-13-01' sähe dann
 * aus wie „keine Besucher“.
 */
export function checkDay(value: string, name: string): string {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new PlausibleError(`${name} muss 'YYYY-MM-DD' sein, war '${s}'.`);
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new PlausibleError(`${name} ist kein gültiges Datum: '${s}'.`);
  }
  return s;
}

const RANGE_SHORTCUT = /^(\d+h|\d+d|\d+mo|day|month|year|all)$/;

/**
 * Zeitraum in die Form bringen, die Plausible erwartet.
 *
 * Kürzel bleiben Zeichenketten, ein absoluter Zeitraum wird zum Zwei-Elemente-Array.
 * Genau hier liegt Falle 1 aus dem Kopf dieser Datei: "2026-01-01,2026-01-31" als
 * Zeichenkette durchzureichen ist die naheliegende Variante — und die falsche.
 */
export function encodeDateRange(range: string): string | [string, string] {
  const s = String(range ?? "").trim();
  if (RANGE_SHORTCUT.test(s)) return s;

  const parts = s.split(",");
  if (parts.length === 2) {
    return [checkDay(parts[0].trim(), "Startdatum"), checkDay(parts[1].trim(), "Enddatum")];
  }
  throw new PlausibleError(
    `Zeitraum '${s}' ist unbekannt. Erlaubt sind Kürzel ('7d', '30d', '12mo', 'day', ` +
      `'month', 'year', 'all') oder ein absoluter Zeitraum 'YYYY-MM-DD,YYYY-MM-DD'.`,
  );
}

/**
 * ISO-Code oder Klarname? Im Gespräch ist der Name gemeint.
 *
 * Plausible führt Land, Region und Stadt doppelt: `visit:country` liefert "DE",
 * `visit:country_name` liefert "Germany". Beide sind gültig, und wer die Codefassung
 * erwischt, bekommt eine Antwort, die niemand vorlesen kann. Da die Namensfassung
 * dieselben Zahlen liefert, wird sie hier stillschweigend eingesetzt.
 */
export function preferReadableGeo(dimension: string): string {
  const map: Record<string, string> = {
    "visit:country": "visit:country_name",
    "visit:region": "visit:region_name",
    "visit:city": "visit:city_name",
  };
  return map[dimension] ?? dimension;
}

export type Filter = [FilterOperator, string, string[]];

/**
 * Einen Filter bauen und dabei prüfen, was Plausible sonst mit 400 quittiert.
 *
 * `event:goal` ist der Sonderfall (Falle 4): Verneinungen sind dort nicht erlaubt.
 * Bare Eigenschaftsnamen ("plan") werden zu `event:props:plan` ergänzt — ein Name mit
 * Doppelpunkt darin muss dagegen eine echte Dimension sein, sonst würde aus dem
 * Tippfehler 'visit:chanel' klaglos ein Filter auf `event:props:visit:chanel`.
 */
export function buildFilter(property: string, operator: FilterOperator, values: string[]): Filter {
  if (!values.length) {
    throw new PlausibleError(`Filter auf '${property}' braucht mindestens einen Wert.`);
  }
  if (!(FILTER_OPERATORS as readonly string[]).includes(operator)) {
    throw new PlausibleError(
      `Operator '${operator}' gibt es nicht. Möglich: ${FILTER_OPERATORS.join(", ")}.`,
    );
  }

  let target: string;
  if (property.includes(":")) {
    target = checkDimension(property);
  } else {
    target = `${PROPS_PREFIX}${property}`;
  }

  if (target === "event:goal" && operator !== "is" && operator !== "contains") {
    throw new PlausibleError(
      `Ziele lassen sich nicht ausschließen: '${operator}' ist auf event:goal nicht erlaubt, ` +
        `Plausible kennt dort nur 'is' und 'contains'.`,
    );
  }
  return [operator, target, values];
}

/** Kurzform für den häufigsten Filter: eine Seite, mit '*' am Ende als Präfixsuche. */
export function pageFilter(page: string): Filter {
  return page.endsWith("*")
    ? ["contains", "event:page", [page.slice(0, -1)]]
    : ["is", "event:page", [page]];
}

export function goalFilter(goal: string): Filter {
  return ["is", "event:goal", [goal]];
}

/**
 * Falle 3: `conversion_rate` ohne Ziel-Bezug.
 *
 * Plausible rechnet die Rate gegen ein Ziel. Fehlt sowohl die Dimension `event:goal` als
 * auch ein Zielfilter, kommt ein 400er zurück, dessen Text nicht sagt, welche Angabe
 * fehlt. Diese Prüfung sagt es.
 */
export function checkConversionRate(
  metrics: string[],
  dimensions: string[],
  filters: Filter[],
): void {
  const wantsRate = metrics.some((m) => m === "conversion_rate" || m === "group_conversion_rate");
  if (!wantsRate) return;
  const hasGoal =
    dimensions.includes("event:goal") || filters.some(([, target]) => target === "event:goal");
  if (!hasGoal) {
    throw new PlausibleError(
      "conversion_rate rechnet gegen ein Ziel. Entweder nach 'event:goal' aufschlüsseln " +
        "oder ein Ziel filtern — sonst weiß Plausible nicht, welche Rate gemeint ist.",
    );
  }
}

/* ── Anfrage und Antwort ──────────────────────────────────────────────────── */

export interface QueryInput {
  metrics: string[];
  dateRange: string;
  dimensions?: string[];
  filters?: Filter[];
  limit?: number;
  offset?: number;
  /** Andere Seite als die hinterlegte. Leer = die aus den Zugangsdaten. */
  site?: string;
}

interface RawResponse {
  results?: { dimensions: (string | number)[]; metrics: (number | null)[] }[];
  meta?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

/** Eine Ergebniszeile mit Namen statt Positionen. */
export type Row = Record<string, string | number | null>;

/**
 * Parallel-Arrays zu benannten Feldern zusammenführen (Falle 2).
 *
 * Aus `{ dimensions: ["/preise"], metrics: [42, 0.31] }` und den angefragten Namen wird
 * `{ "event:page": "/preise", visitors: 42, bounce_rate: 0.31 }`. Ohne diesen Schritt
 * müsste der Leser die Reihenfolge der Anfrage im Kopf behalten.
 */
export function zip(raw: RawResponse, metrics: string[], dimensions: string[]): Row[] {
  return (raw.results ?? []).map((r) => {
    const row: Row = {};
    dimensions.forEach((d, i) => {
      row[d] = r.dimensions?.[i] ?? null;
    });
    metrics.forEach((m, i) => {
      row[m] = r.metrics?.[i] ?? null;
    });
    return row;
  });
}

export class Plausible {
  constructor(
    private readonly apiKey: string,
    private readonly defaultSite: string,
    private readonly baseUrl: string = PLAUSIBLE_BASE,
  ) {}

  get site(): string {
    return this.defaultSite;
  }

  /**
   * Eine Abfrage stellen und benannte Zeilen zurückgeben.
   *
   * Geprüft wird vor dem Absenden: Kennzahlen, Dimensionen, Zeitraum und der
   * Ziel-Bezug von conversion_rate. Was hier durchgeht, scheitert nicht mehr an der
   * Form der Anfrage.
   */
  async query(input: QueryInput): Promise<{ rows: Row[]; metrics: string[]; dimensions: string[] }> {
    const metrics = input.metrics.map(checkMetric);
    const dimensions = (input.dimensions ?? []).map(checkDimension);
    const filters = input.filters ?? [];
    checkConversionRate(metrics, dimensions, filters);

    const body: Record<string, unknown> = {
      site_id: input.site?.trim() || this.defaultSite,
      metrics,
      date_range: encodeDateRange(input.dateRange),
    };
    if (dimensions.length) body.dimensions = dimensions;
    if (filters.length) body.filters = filters;
    if (input.limit !== undefined) {
      body.pagination = { limit: input.limit, ...(input.offset ? { offset: input.offset } : {}) };
    }

    const raw = await this.post(body);
    return { rows: zip(raw, metrics, dimensions), metrics, dimensions };
  }

  private async post(body: Record<string, unknown>): Promise<RawResponse> {
    const res = await fetch(`${this.baseUrl}/api/v2/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw await this.error(res);
    return (await res.json()) as RawResponse;
  }

  /**
   * Aus der Antwort einen brauchbaren Fehler machen.
   *
   * Plausible meldet Fehler als `{"error": "..."}`. Der Text ist meist präzise und
   * gehört deshalb weitergereicht — allerdings gekürzt, denn er kann die ganze Anfrage
   * zurückspiegeln. Die Statuscodes bekommen eine Erklärung dazu, weil 401 und 402 bei
   * Plausible verschiedene Ursachen haben, die man ohne Hinweis verwechselt.
   */
  private async error(res: Response): Promise<PlausibleError> {
    const text = await res.text().catch(() => "");
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) detail = parsed.error.slice(0, 400);
    } catch {
      /* Kein JSON — dann bleibt es beim Status. */
    }

    const hint: Record<number, string> = {
      400: "Die Anfrage passt nicht zur Stats API.",
      401: "Der API-Key gilt nicht (mehr). In Plausible unter Account Settings → API Keys prüfen.",
      402: "Die Stats API ist für dieses Plausible-Abo nicht freigeschaltet.",
      403: "Der Key darf diese Seite nicht lesen.",
      404: "Diese Seite gibt es in dem Plausible-Konto nicht — Domain genau wie dort schreiben.",
      429: "Zu viele Anfragen (Plausible erlaubt 600 pro Stunde). Später erneut versuchen.",
    };

    const parts = [`Plausible antwortet mit ${res.status}.`, hint[res.status], detail].filter(
      Boolean,
    );
    return new PlausibleError(parts.join(" "), detail);
  }

  /**
   * Zugangsdaten prüfen — ein echter, minimaler Aufruf.
   *
   * Plausible hat keinen Endpunkt, der nur „Key gültig?" beantwortet. Die Liste der
   * Seiten (Sites API) ist ein anderes Recht und mit einem reinen Stats-Key nicht
   * abrufbar; sie taugt hier also nicht. Eine Abfrage auf die hinterlegte Seite prüft
   * dagegen genau das, worauf es ankommt: dass der Key gilt UND diese Seite sieht.
   */
  async whoami(): Promise<{ site: string; visitorsToday: number }> {
    const { rows } = await this.query({ metrics: ["visitors"], dateRange: "day" });
    const value = rows[0]?.visitors;
    return { site: this.defaultSite, visitorsToday: typeof value === "number" ? value : 0 };
  }
}
