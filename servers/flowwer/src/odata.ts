/**
 * OData-Schicht für das FLOWWER-Reporting.
 *
 * FLOWWER dokumentiert öffentlich keine Feldliste — sie steht im `$metadata` des jeweiligen
 * Kontos. Genau deshalb wird sie hier zur Laufzeit gelesen und zwischengespeichert, wie bei
 * HERO die Mandanten-IDs. Zwei Dinge fallen damit ab:
 *
 *  - `felder_auflisten` kann sagen, was es bei DIESEM Konto wirklich gibt.
 *  - Ein Filter auf ein Feld, das es nicht gibt, wird abgefangen, bevor er rausgeht.
 *    OData beantwortet so etwas mit HTTP 400 und einer Meldung, die niemandem hilft.
 *
 * Der `$metadata`-Dienst liefert EDMX-XML. Auf Workers gibt es keinen XML-Parser; die
 * Struktur ist aber flach genug, dass ein gezielter Ausdruck reicht — und was er nicht
 * versteht, meldet er, statt es zu erfinden.
 */
import { Flowwer, FlowwerError } from "./client";
import { sha256hex } from "../../../shared/src/crypto";

export interface EntitySchema {
  /** Feldname -> EDM-Typ, z. B. "Edm.String". */
  fields: Record<string, string>;
}

export interface ReportingSchema {
  entities: Record<string, EntitySchema>;
  /** Die Namen der Collections, die im Servicekatalog stehen. */
  entitySets: string[];
  fetchedAt: number;
}

const TTL_SECONDS = 60 * 60 * 12;

/** EDMX zerlegen: EntityType-Blöcke, darin Property-Elemente. */
export function parseMetadata(xml: string): Record<string, EntitySchema> {
  const entities: Record<string, EntitySchema> = {};
  const typeRe = /<(?:\w+:)?EntityType\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?EntityType>/g;
  for (const m of xml.matchAll(typeRe)) {
    const [, name, inner] = m;
    const fields: Record<string, string> = {};
    const propRe = /<(?:\w+:)?Property\b[^>]*\bName="([^"]+)"[^>]*?\bType="([^"]+)"/g;
    for (const p of inner.matchAll(propRe)) fields[p[1]] = p[2];
    if (Object.keys(fields).length) entities[name] = { fields };
  }
  return entities;
}

export async function getSchema(
  kv: KVNamespace,
  flowwer: Flowwer,
  cacheSalt: string,
): Promise<ReportingSchema> {
  const key = `flw:${(await sha256hex(`${flowwer.account}:${cacheSalt}`)).slice(0, 32)}`;
  const cached = await kv.get<ReportingSchema>(key, "json");
  if (cached) return cached;

  const res = await flowwer.request("/odata/reporting/$metadata", { accept: "application/xml" });
  if (!res.ok) {
    throw new FlowwerError(
      `Die Feldbeschreibung (/odata/reporting/$metadata) ist nicht lesbar (HTTP ${res.status}). ` +
        `Ohne sie lassen sich Filter nicht prüfen.`,
    );
  }
  const xml = await res.text();
  const entities = parseMetadata(xml);
  if (!Object.keys(entities).length) {
    throw new FlowwerError(
      "Die Feldbeschreibung konnte nicht gelesen werden — sie sieht nicht wie erwartetes " +
        "EDMX-XML aus. Bitte melden, dann wird der Parser angepasst.",
      xml.slice(0, 300),
    );
  }

  let entitySets: string[] = [];
  try {
    const svc = await flowwer.json<any>("/odata/reporting/");
    entitySets = (svc?.value ?? []).map((v: any) => v.name ?? v.url).filter(Boolean);
  } catch {
    entitySets = Object.keys(entities);
  }

  const schema: ReportingSchema = { entities, entitySets, fetchedAt: Date.now() };
  await kv.put(key, JSON.stringify(schema), { expirationTtl: TTL_SECONDS });
  return schema;
}

/**
 * Die Collection, die zu einem Namen gehört — großzügig beim Vergleich, weil OData
 * zwischen Entitätstyp ("Document") und Collection ("Documents") unterscheidet.
 */
export function resolveEntity(schema: ReportingSchema, wanted: string): { set: string; fields: Record<string, string> } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(wanted);

  const setName =
    schema.entitySets.find((s) => norm(s) === n) ??
    schema.entitySets.find((s) => norm(s) === n + "s") ??
    schema.entitySets.find((s) => norm(s).startsWith(n)) ??
    null;

  const typeName =
    Object.keys(schema.entities).find((t) => norm(t) === n) ??
    Object.keys(schema.entities).find((t) => norm(t) + "s" === n) ??
    (setName ? Object.keys(schema.entities).find((t) => norm(setName).startsWith(norm(t))) : null) ??
    null;

  if (!setName && !typeName) {
    throw new FlowwerError(
      `'${wanted}' gibt es im Reporting dieses Kontos nicht. Verfügbar: ` +
        `${(schema.entitySets.length ? schema.entitySets : Object.keys(schema.entities)).join(", ")}`,
    );
  }
  return {
    set: setName ?? typeName!,
    fields: typeName ? schema.entities[typeName].fields : {},
  };
}

/** Feldnamen gegen das Schema prüfen — Groß-/Kleinschreibung tolerant, Rückgabe kanonisch. */
export function resolveField(fields: Record<string, string>, wanted: string): string {
  if (!Object.keys(fields).length) return wanted; // kein Schema gelesen: nicht im Weg stehen
  if (fields[wanted]) return wanted;
  const hit = Object.keys(fields).find((f) => f.toLowerCase() === wanted.toLowerCase());
  if (hit) return hit;
  const nah = Object.keys(fields).filter((f) =>
    f.toLowerCase().includes(wanted.toLowerCase().slice(0, 4)),
  );
  // Ohne Namensähnlichkeit hilft ein Vorschlag nicht — deutsche Feldnamen treffen
  // englische nie. Dann lieber gleich sagen, was es gibt, statt einen zweiten Aufruf
  // zu erzwingen.
  const alle = Object.keys(fields);
  const auswahl = alle.length > 20 ? `${alle.slice(0, 20).join(", ")} … (${alle.length} insgesamt)` : alle.join(", ");
  throw new FlowwerError(
    `Feld '${wanted}' gibt es nicht.` +
      (nah.length ? ` Gemeint: ${nah.slice(0, 6).join(", ")}?` : "") +
      ` Vorhanden: ${auswahl}`,
  );
}

/** Ein Wert als OData-Literal, passend zum EDM-Typ des Feldes. */
export function literal(type: string | undefined, value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  const t = (type ?? "").replace("Edm.", "");

  if (["Int16", "Int32", "Int64", "Decimal", "Double", "Single", "Byte"].includes(t)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new FlowwerError(`'${value}' ist keine Zahl.`);
    return String(n);
  }
  if (t === "Boolean") return String(value).toLowerCase() === "true" ? "true" : "false";
  if (t === "Guid") return `${String(value)}`;
  if (["Date", "DateTimeOffset"].includes(t)) {
    const s = String(value);
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
      throw new FlowwerError(`'${s}' ist kein Datum. Erwartet wird 'YYYY-MM-DD'.`);
    }
    // Edm.Date ohne Zeitanteil, DateTimeOffset mit Mitternacht in UTC.
    return t === "Date" ? s.slice(0, 10) : `${s.slice(0, 10)}T00:00:00Z`;
  }
  // Strings: einfache Anführungszeichen verdoppeln, sonst bricht der Filter auf.
  return `'${String(value).replace(/'/g, "''")}'`;
}

export type Comparison = "eq" | "ne" | "gt" | "ge" | "lt" | "le" | "contains" | "startswith";

/** Eine Filterbedingung bauen — Feld und Wert werden vorher gegen das Schema geprüft. */
export function condition(
  fields: Record<string, string>,
  field: string,
  op: Comparison,
  value: string | number | boolean,
): string {
  const name = resolveField(fields, field);
  const lit = literal(fields[name], value);
  if (op === "contains" || op === "startswith") {
    return `${op}(${name},${literal("Edm.String", String(value))})`;
  }
  return `${name} ${op} ${lit}`;
}
