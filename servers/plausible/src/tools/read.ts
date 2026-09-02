/**
 * Die Tools. Alle lesend — die Stats API kann nichts verändern, es gibt hier also
 * bewusst kein Gegenstück zu tools/write.ts der anderen Server.
 *
 * Zwei Entscheidungen prägen den Zuschnitt:
 *
 *  - **Fünf Tools, nicht zwölf.** Plausible hat genau einen Endpunkt; „Top-Seiten",
 *    „Top-Quellen" und „Top-Länder" wären dreimal dasselbe Tool mit anderer Dimension.
 *    Sie sind deshalb ein Tool (`breakdown`) mit einer Dimension als Argument.
 *  - **Antworten werden benannt, nicht durchgereicht.** Plausible liefert Parallel-Arrays;
 *    was hier zurückgeht, hat Feldnamen (siehe `zip()` im Client) und einen Kopf, aus dem
 *    hervorgeht, welche Seite und welcher Zeitraum gemeint waren. Ohne diesen Kopf lässt
 *    sich später nicht mehr sagen, worauf sich eine Zahl bezog.
 */
import {
  type Filter,
  type FilterOperator,
  buildFilter,
  goalFilter,
  pageFilter,
  preferReadableGeo,
  DIMENSIONS,
  METRICS,
  PROPS_PREFIX,
  PlausibleError,
} from "../client";
import { type PlausibleTool, str, int, bool, req } from "../context";

/* ── Gemeinsame Argumente ─────────────────────────────────────────────────── */

const siteArg = str(
  "Domain der Plausible-Seite, z. B. 'example.com'. Weglassen = die beim Verbinden " +
    "hinterlegte Seite.",
);

const dateRangeArg = str(
  "Zeitraum: Kürzel wie '7d', '30d', '12mo', 'day' (heute), 'month' (laufender Monat), " +
    "'year', 'all' — oder absolut als 'YYYY-MM-DD,YYYY-MM-DD'.",
);

const pageArg = str(
  "Nur diese Seite, z. B. '/preise'. Ein '*' am Ende sucht mit Präfix: '/blog*'.",
);

const goalArg = str("Nur dieses Ziel, z. B. 'Signup'. Name genau wie in Plausible.");

const metricsArg = {
  type: "array",
  items: { type: "string", enum: [...METRICS] },
  description:
    "Kennzahlen. Voreinstellung: visitors, pageviews, bounce_rate, visit_duration. " +
    "conversion_rate braucht immer einen Ziel-Bezug.",
};

const filtersArg = {
  type: "array",
  description:
    "Zusätzliche Filter, mit UND verknüpft. Je Eintrag: property (Dimension wie " +
    "'visit:channel' oder der bloße Name einer eigenen Ereignis-Eigenschaft wie 'plan'), " +
    "operator (is | is_not | contains | contains_not, Vorgabe is) und values (Liste).",
  items: {
    type: "object",
    properties: {
      property: { type: "string" },
      operator: { type: "string", enum: ["is", "is_not", "contains", "contains_not"] },
      values: { type: "array", items: { type: "string" } },
    },
    required: ["property", "values"],
  },
};

const DEFAULT_METRICS = ["visitors", "pageviews", "bounce_rate", "visit_duration"];

/* ── Argumente auswerten ──────────────────────────────────────────────────── */

const metricsOf = (args: Record<string, any>, fallback = DEFAULT_METRICS): string[] => {
  const m = args.metrics;
  if (!m) return fallback;
  if (!Array.isArray(m) || m.some((x) => typeof x !== "string")) {
    throw new PlausibleError("'metrics' muss eine Liste von Kennzahlnamen sein.");
  }
  return m.length ? m : fallback;
};

/**
 * Die Kurzformen `page`/`goal` und ein gleichlautender Eintrag in `filters` würden mit UND
 * verknüpft und ergäben fast immer eine leere Antwort — zwei Bedingungen auf dieselbe
 * Dimension schließen sich in der Regel aus. Das ist kein Fehler, den Plausible meldet:
 * es kämen einfach null Zeilen zurück und sähen aus wie „kein Verkehr". Deshalb hier.
 */
function collectFilters(args: Record<string, any>): Filter[] {
  const out: Filter[] = [];
  const extra = args.filters;

  if (extra !== undefined && !Array.isArray(extra)) {
    throw new PlausibleError("'filters' muss eine Liste sein.");
  }
  const entries: any[] = Array.isArray(extra) ? extra : [];

  for (const [name, dimension, value] of [
    ["page", "event:page", args.page],
    ["goal", "event:goal", args.goal],
  ] as const) {
    if (!value) continue;
    if (entries.some((e) => e?.property === dimension)) {
      throw new PlausibleError(
        `'${name}' und ein Eintrag in 'filters' zielen beide auf ${dimension}. Zusammen ` +
          `treffen sie fast nie etwas — die ganze Bedingung in 'filters' schreiben und ` +
          `'${name}' weglassen.`,
      );
    }
    out.push(name === "page" ? pageFilter(String(value)) : goalFilter(String(value)));
  }

  for (const e of entries) {
    if (!e || typeof e !== "object" || typeof e.property !== "string") {
      throw new PlausibleError("Jeder Filter braucht ein 'property'.");
    }
    if (!Array.isArray(e.values)) {
      throw new PlausibleError(`Filter auf '${e.property}' braucht 'values' als Liste.`);
    }
    out.push(
      buildFilter(
        e.property,
        (e.operator ?? "is") as FilterOperator,
        e.values.map((v: unknown) => String(v)),
      ),
    );
  }
  return out;
}

/** Kopfzeile jeder Antwort — ohne sie steht eine Zahl ohne Bezug im Gespräch. */
const head = (site: string, args: Record<string, any>, extra: Record<string, unknown> = {}) => ({
  site,
  zeitraum: String(args.date_range),
  ...extra,
});

/* ── Tools ────────────────────────────────────────────────────────────────── */

const overview: PlausibleTool = {
  name: "overview",
  title: "Überblick",
  description:
    "Die Eckwerte eines Zeitraums als eine Zeile: Besucher, Seitenaufrufe, Absprungrate, " +
    "Verweildauer. Der richtige Einstieg für „wie lief letzte Woche?\" und die Grundlage, " +
    "bevor man mit breakdown ins Detail geht.",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg,
    },
    required: ["date_range"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req<string>(args, "date_range");
    const metrics = metricsOf(args);
    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      filters: collectFilters(args),
      site: args.site,
    });
    // Ohne Dimension liefert Plausible genau eine Zeile — die ist das Ergebnis.
    return { ...head(args.site || pl.site, args), werte: rows[0] ?? null };
  },
};

const timeseries: PlausibleTool = {
  name: "timeseries",
  title: "Verlauf",
  description:
    "Kennzahlen über die Zeit, in Tagen, Wochen, Monaten oder Stunden. Dafür da, " +
    "Ausschläge zu finden — etwa ob ein Deploy am Dienstag den Verkehr auf /preise " +
    "verändert hat.",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      granularity: {
        type: "string",
        enum: ["hour", "day", "week", "month"],
        description: "Größe der Zeitschritte. Vorgabe: day.",
      },
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg,
    },
    required: ["date_range"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req<string>(args, "date_range");
    const granularity = String(args.granularity ?? "day");
    if (!["hour", "day", "week", "month"].includes(granularity)) {
      throw new PlausibleError(
        `granularity '${granularity}' gibt es nicht — möglich: hour, day, week, month.`,
      );
    }
    const metrics = metricsOf(args);
    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      dimensions: [`time:${granularity}`],
      filters: collectFilters(args),
      site: args.site,
    });
    return {
      ...head(args.site || pl.site, args, { schritt: granularity, punkte: rows.length }),
      verlauf: rows,
    };
  },
};

const breakdown: PlausibleTool = {
  name: "breakdown",
  title: "Aufschlüsselung",
  description:
    "Kennzahlen nach einer Dimension aufgeschlüsselt und absteigend sortiert: Top-Seiten, " +
    "Herkunft, Land, Gerät, Browser, UTM-Parameter oder eine eigene Ereignis-Eigenschaft. " +
    "Das Tool für „welche Seite läuft am besten?\" und „woher kommen die Leute?\".",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      dimension: {
        type: "string",
        description:
          "Wonach aufgeschlüsselt wird — z. B. event:page, visit:source, visit:channel, " +
          "visit:country, visit:device — oder eine eigene Eigenschaft als " +
          `'${PROPS_PREFIX}<name>'. Möglich: ${DIMENSIONS.join(", ")}.`,
      },
      limit: int("Höchstzahl Zeilen, 1–1000. Vorgabe: 20."),
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg,
    },
    required: ["date_range", "dimension"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req<string>(args, "date_range");
    const wanted = String(req<string>(args, "dimension"));
    // Land/Region/Stadt: die Namensfassung statt des ISO-Codes, siehe preferReadableGeo.
    const dimension = preferReadableGeo(wanted);
    const limit = Math.min(1000, Math.max(1, Number(args.limit) || 20));
    const metrics = metricsOf(args, ["visitors", "pageviews", "bounce_rate"]);

    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      dimensions: [dimension],
      filters: collectFilters(args),
      limit,
      site: args.site,
    });

    return {
      ...head(args.site || pl.site, args, {
        dimension,
        // Sichtbar machen, dass getauscht wurde — sonst wundert sich, wer 'visit:country'
        // gefragt hat, über den Feldnamen in der Antwort.
        ...(dimension !== wanted ? { statt: wanted, grund: "Klarnamen statt ISO-Codes" } : {}),
        zeilen: rows.length,
        ...(rows.length === limit ? { hinweis: `Bei ${limit} abgeschnitten.` } : {}),
      }),
      werte: rows,
    };
  },
};

const conversions: PlausibleTool = {
  name: "conversions",
  title: "Ziele",
  description:
    "Zielerreichungen mit Rate: wie oft wurde ein Ziel ausgelöst und von welchem Anteil " +
    "der Besucher. Wahlweise je Seite, um zu sehen, welche Seite die Abschlüsse bringt. " +
    "Setzt voraus, dass in Plausible Ziele eingerichtet sind.",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      goal: goalArg,
      per_page: bool("Zusätzlich nach Seite aufschlüsseln. Vorgabe: nein."),
      limit: int("Höchstzahl Zeilen, 1–1000. Vorgabe: 50."),
      site: siteArg,
      page: pageArg,
      filters: filtersArg,
    },
    required: ["date_range"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req<string>(args, "date_range");
    // event:goal ist immer dabei — das ist zugleich der Ziel-Bezug, den conversion_rate
    // braucht (siehe checkConversionRate im Client).
    const dimensions = args.per_page ? ["event:goal", "event:page"] : ["event:goal"];
    const { rows } = await pl.query({
      metrics: ["visitors", "events", "conversion_rate"],
      dateRange: String(args.date_range),
      dimensions,
      filters: collectFilters(args),
      limit: Math.min(1000, Math.max(1, Number(args.limit) || 50)),
      site: args.site,
    });

    return {
      ...head(args.site || pl.site, args, { ziele: rows.length }),
      ...(rows.length === 0
        ? { hinweis: "Keine Zielerreichungen. Sind in Plausible überhaupt Ziele angelegt?" }
        : {}),
      werte: rows,
    };
  },
};

/**
 * Zwei Zeiträume nebeneinander.
 *
 * Plausible kann in einer Anfrage vergleichen, aber nur gegen den unmittelbar
 * vorhergehenden Zeitraum oder das Vorjahr. „Diese Woche gegen die Woche vor drei
 * Monaten" geht damit nicht. Zwei Abfragen können jeden Vergleich, kosten aber auch
 * zwei Aufrufe — bei 600 pro Stunde ist das die günstigere Seite des Tauschs.
 */
const compare: PlausibleTool = {
  name: "compare",
  title: "Zeiträume vergleichen",
  description:
    "Zwei beliebige Zeiträume nebeneinander, mit Differenz absolut und in Prozent. " +
    "Für „wie war der Januar gegen den Dezember?\" oder „vor und nach der Umstellung\".",
  inputSchema: {
    type: "object",
    properties: {
      range_a: str("Erster Zeitraum (der Vergleichsmaßstab). Formate wie bei date_range."),
      range_b: str("Zweiter Zeitraum (der bewertete). Formate wie bei date_range."),
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg,
    },
    required: ["range_a", "range_b"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    const rangeA = String(req<string>(args, "range_a"));
    const rangeB = String(req<string>(args, "range_b"));
    const metrics = metricsOf(args);
    const filters = collectFilters(args);
    const site = args.site;

    const [a, b] = await Promise.all([
      pl.query({ metrics, dateRange: rangeA, filters, site }),
      pl.query({ metrics, dateRange: rangeB, filters, site }),
    ]);

    const rowA = a.rows[0] ?? {};
    const rowB = b.rows[0] ?? {};

    const delta: Record<string, { absolut: number | null; prozent: number | null }> = {};
    for (const m of metrics) {
      const va = rowA[m];
      const vb = rowB[m];
      if (typeof va !== "number" || typeof vb !== "number") {
        delta[m] = { absolut: null, prozent: null };
        continue;
      }
      const abs = vb - va;
      delta[m] = {
        absolut: Math.round(abs * 100) / 100,
        // Von null aus gibt es keine prozentuale Veränderung. Eine Zahl zu erfinden
        // (0 oder 100) wäre schlimmer als die Lücke einzugestehen.
        prozent: va !== 0 ? Math.round((abs / va) * 10000) / 100 : null,
      };
    }

    return {
      site: site || pl.site,
      a: { zeitraum: rangeA, werte: rowA },
      b: { zeitraum: rangeB, werte: rowB },
      veraenderung: delta,
    };
  },
};

export const readTools: PlausibleTool[] = [overview, timeseries, breakdown, conversions, compare];
