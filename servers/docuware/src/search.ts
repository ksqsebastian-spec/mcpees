/**
 * Suchen in einem Aktenschrank.
 *
 * Gesucht wird bei DocuWare nicht über Query-Parameter, sondern mit einem POST auf den
 * „dialogExpression" eines Suchdialogs. Der Rumpf sieht so aus:
 *
 *   { "Condition": [{ "DBName": "DOCNO", "Value": ["4711"] }],
 *     "Operation": "And",
 *     "SortOrder": [{ "Field": "DOCDATE", "Direction": "Desc" }] }
 *
 * Drei Dinge daran können still schiefgehen:
 *
 *  1. **`DBName` ist der Datenbankname, nicht der Anzeigename.** Auf dem Bildschirm heißt
 *     das Feld „Belegdatum", die API kennt nur `DOCDATE`. Aufgelöst wird das vorher gegen
 *     die Feldliste des Schranks (structure.ts), damit hier beides erlaubt ist.
 *  2. **Klammern im Suchwert sind Syntax.** „Rechnung (Eingang)" sucht ohne Maskierung
 *     etwas anderes als das, was dasteht — und meldet keinen Fehler, sondern liefert die
 *     falsche Treffermenge. `quoteValue()` maskiert sie. `*` und `?` bleiben unmaskiert:
 *     die sind als Platzhalter gemeint, wenn jemand sie schreibt.
 *  3. **Die Sortierung gehört in den Rumpf.** Es gibt auch einen Query-Parameter
 *     `sortOrder`; der nimmt aber nur ein Feld und verwirft den Rest stillschweigend. Wer
 *     nach Datum und dann nach Nummer sortieren will, bekommt dort nur das Datum.
 */
import { Docuware, DocuwareError, dwDate, links } from "./client";
import type { CabinetDetail, FieldInfo } from "./structure";
import { findField } from "./structure";

/** Klammern maskieren. Idempotent: was schon maskiert ist, bleibt, wie es ist. */
export function quoteValue(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      out += ch + s[i + 1];
      i++;
    } else if (ch === "(" || ch === ")") {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Ein Wert für die Suche. null heißt „Feld ist leer" — DocuWare schreibt das EMPTY(). */
function searchValue(value: unknown, feld: FieldInfo): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  // Datumsfelder wollen ein Datum, keine deutsche Schreibweise.
  if (/^(date|datetime)$/i.test(feld.type) && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
    throw new DocuwareError(
      `'${s}' ist kein Datum für das Feld ${feld.id} (${feld.label}). Erwartet wird ` +
        `'YYYY-MM-DD'. Für „von–bis" eine Liste aus zwei Werten übergeben.`,
    );
  }
  return quoteValue(s);
}

export interface Condition {
  DBName: string;
  Value: Array<string | null>;
}

/**
 * Bedingungen aus `{ feld: wert }` bauen.
 *
 * Ein Wert kann sein: eine Zeichenkette, eine Zahl, `null` (Feld ist leer) oder eine Liste
 * aus genau zwei Werten — dann ist es ein Bereich von–bis, und eine offene Grenze ist
 * ebenfalls `null`.
 */
export function buildConditions(
  detail: CabinetDetail,
  bedingungen: Record<string, unknown>,
): { conditions: Condition[]; felder: FieldInfo[] } {
  const conditions: Condition[] = [];
  const felder: FieldInfo[] = [];

  for (const [name, roh] of Object.entries(bedingungen ?? {})) {
    const feld = findField(detail, name);
    const values = Array.isArray(roh)
      ? roh.map((v) => searchValue(v, feld))
      : [searchValue(roh, feld)];

    if (Array.isArray(roh) && roh.length !== 2 && roh.some((v) => v === null)) {
      throw new DocuwareError(
        `Für ${feld.id} steht null in einer Liste mit ${roh.length} Werten. null ist nur als ` +
          `offene Grenze eines Bereichs gedacht — dann müssen es genau zwei Werte sein.`,
      );
    }

    conditions.push({ DBName: feld.id, Value: values });
    felder.push(feld);
  }

  return { conditions, felder };
}

const DIRECTIONS: Record<string, string> = {
  auf: "Asc",
  asc: "Asc",
  aufsteigend: "Asc",
  ab: "Desc",
  desc: "Desc",
  absteigend: "Desc",
};

/** `["DOCDATE:desc", "DOCNO"]` -> `[{Field, Direction}]`. */
export function buildSortOrder(
  detail: CabinetDetail,
  sortierung: string[],
): Array<{ Field: string; Direction: string }> {
  return sortierung.map((eintrag) => {
    const [name, richtung = "asc"] = String(eintrag).split(":");
    const feld = findField(detail, name);
    const dir = DIRECTIONS[richtung.trim().toLowerCase()];
    if (!dir) {
      throw new DocuwareError(
        `'${richtung}' ist keine Sortierrichtung. Erlaubt: asc, desc (oder auf, ab).`,
      );
    }
    return { Field: feld.id, Direction: dir };
  });
}

export interface ResultRow {
  id: string;
  titel: string | null;
  aktenschrank: string;
  felder: Record<string, unknown>;
  /** Beziehung `self` — der Einstieg für get_document und den Download. */
  self: string | null;
}

export interface SearchOutcome {
  treffer: ResultRow[];
  /** Was DocuWare als Gesamtzahl meldet, falls es eine nennt. */
  gesamt: number | null;
  abgeschnitten: boolean;
  seiten: number;
}

/** Einen Feldwert aus der Antwort lesbar machen. */
export function fieldValue(f: any): unknown {
  const art = String(f?.ItemElementName ?? "");
  const item = f?.Item;
  if (item === null || item === undefined) return null;
  if (art === "Date" || art === "DateTime") return dwDate(item, art === "DateTime");
  if (art === "Keywords") {
    const kw = (item as any)?.Keyword;
    return Array.isArray(kw) ? kw : kw ? [kw] : null;
  }
  return item;
}

/** Die Felder einer Ergebniszeile als `{ Feldname: Wert }`. Systemfelder bleiben drin. */
export function rowFields(item: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of Array.isArray(item?.Fields) ? item.Fields : []) {
    const name = String(f?.FieldName ?? "").trim();
    if (name) out[name] = fieldValue(f);
  }
  return out;
}

/**
 * Suchen und die Treffer einsammeln.
 *
 * `maxItems` begrenzt sichtbar: das Ergebnis sagt, ob abgeschnitten wurde. Eine gekappte
 * Liste, die wie eine vollständige aussieht, ist eine falsche Antwort.
 *
 * Über den Query-Parameter `fields` bestimmt DocuWare, welche Indexfelder in den Treffern
 * stehen. Wird nichts angegeben, werden hier alle Felder des Schranks angefordert — sonst
 * käme eine Trefferliste zurück, in der nur das steht, wonach ohnehin gesucht wurde.
 */
export async function runSearch(
  dw: Docuware,
  detail: CabinetDetail,
  opts: {
    bedingungen: Record<string, unknown>;
    verknuepfung: "und" | "oder";
    sortierung: string[];
    felder: string[];
    maxItems: number;
  },
): Promise<SearchOutcome> {
  if (!detail.searchDialog) {
    throw new DocuwareError(
      `'${detail.cabinet.name}' hat keinen Suchdialog. In DocuWare hängt die Suche an einem ` +
        `Dialog; ohne einen solchen lässt sich dieser Schrank nicht durchsuchen. Bei einem ` +
        `Briefkorb ist das normal.`,
    );
  }

  const { conditions } = buildConditions(detail, opts.bedingungen);
  const body: Record<string, unknown> = {
    Condition: conditions,
    Operation: opts.verknuepfung === "oder" ? "Or" : "And",
  };
  if (opts.sortierung.length > 0) {
    // In den Rumpf, nicht als Query-Parameter — siehe Kopfkommentar, Punkt 3.
    body.SortOrder = buildSortOrder(detail, opts.sortierung);
  }

  const gewuenscht =
    opts.felder.length > 0
      ? opts.felder.map((n) => findField(detail, n).id)
      : detail.fields.filter((f) => f.in.includes("suche")).map((f) => f.id);
  const rueckgabe = [...new Set([...gewuenscht, ...conditions.map((c) => c.DBName)])];

  const treffer: ResultRow[] = [];
  let gesamt: number | null = null;
  let seiten = 0;
  let href: string | null = detail.searchDialog.expression;
  let method = "POST";

  while (href && treffer.length < opts.maxItems && seiten < 20) {
    const page: any = await dw.json<any>(method, href, {
      query: method === "POST" ? { fields: rueckgabe.join(",") } : undefined,
      body: method === "POST" ? body : undefined,
    });
    seiten++;

    const anzahl = Number(page?.Count?.Value);
    if (Number.isFinite(anzahl)) gesamt = anzahl;

    for (const item of Array.isArray(page?.Items) ? page.Items : []) {
      treffer.push({
        id: String(item?.Id ?? ""),
        titel: item?.Title ? String(item.Title) : null,
        aktenschrank: detail.cabinet.name,
        felder: rowFields(item),
        self: links(item)["self"] ?? null,
      });
    }

    // Weitere Seiten holt man sich per GET über die Beziehung `next`.
    href = links(page)["next"] ?? null;
    method = "GET";
  }

  const behalten = treffer.slice(0, opts.maxItems);
  return {
    treffer: behalten,
    gesamt,
    abgeschnitten: gesamt !== null ? gesamt > behalten.length : treffer.length > behalten.length,
    seiten,
  };
}
