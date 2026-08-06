/**
 * HERO-Client. Portiert aus scripts/hero.py des hero-api-Skills und erzwingt dieselben
 * drei Regeln, die dort teuer gelernt wurden:
 *
 *   1. Mutations IMMER über GraphQL-Variablen — `Mixed`/`JSON`-Scalars verwerfen
 *      Inline-Objektliterale stillschweigend (dem Custom Scalar fehlt parseLiteral).
 *   2. Nach jedem Write frisch nachlesen — die Mutation-Antwort ist keine Quittung.
 *      (Belegt bei create_document, create_supply_service, update_supply_service.)
 *   3. v9 benutzen, nicht v7 (v7 sendet X-Api-Deprecation).
 */

import { INPUT_FIELDS } from "./input-fields.generated";

export const HERO_BASE = "https://login.hero-software.de";
export const HERO_GQL = `${HERO_BASE}/api/external/v9/graphql`;
export const HERO_LEAD = `${HERO_BASE}/api/v1/Projects/create`;
export const COMPLEXITY_LIMIT = 50_000;

export class HeroError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "HeroError";
  }
}

export interface HeroResult<T> {
  data: T;
  complexity: number;
}

export class Hero {
  /** Summe der bisher in diesem Request verbrauchten Komplexität. */
  spent = 0;

  constructor(private readonly apiKey: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json", ...extra };
  }

  /**
   * Ein GraphQL-Request. `variables` ist Pflicht-Vehikel für alles Nicht-Skalare —
   * niemals Werte in den Query-String interpolieren.
   */
  async gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    checkVariables(query, variables);
    let res: Response;
    try {
      res = await fetch(HERO_GQL, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) {
      throw new HeroError(`HERO nicht erreichbar: ${(e as Error).message}`);
    }

    const complexity = Number(res.headers.get("X-Complexity") ?? 0);
    this.spent += complexity;

    const text = await res.text();
    if (!res.ok) {
      // HERO meldet Validierungsfehler teils als HTTP 500 mit validationErrors,
      // nicht als 422 — deshalb wird der Body immer mitgegeben.
      throw new HeroError(`HERO HTTP ${res.status}`, text.slice(0, 800));
    }

    let body: { data?: T; errors?: Array<{ message: string; extensions?: unknown }> };
    try {
      body = JSON.parse(text);
    } catch {
      throw new HeroError("HERO lieferte kein JSON", text.slice(0, 300));
    }
    if (body.errors?.length) {
      throw new HeroError(body.errors[0].message, body.errors);
    }
    if (complexity > COMPLEXITY_LIMIT) {
      throw new HeroError(
        `Query zu teuer: X-Complexity ${complexity} über dem Limit ${COMPLEXITY_LIMIT}. ` +
          `Kleineres 'limit' wählen.`,
      );
    }
    return body.data as T;
  }

  /** Prüft den Key gegen HERO und liefert Firmenname + angemeldeten Nutzer zurück. */
  async whoami(): Promise<{ company: string; user: string; companyId: number | null }> {
    // Der Name steht am Partner, nicht am User — User selbst hat nur email/role.
    const d = await this.gql<{
      company: { id: number; name: string } | null;
      user: { id: number; email: string; partner: { full_name: string } | null } | null;
    }>(`query { company { id name } user { id email partner { full_name } } }`);
    if (!d.company) throw new HeroError("Key gültig, aber keine Firma lesbar");
    const u = d.user;
    return {
      company: d.company.name,
      companyId: d.company.id ?? null,
      user: u?.partner?.full_name || u?.email || "unbekannt",
    };
  }

  /**
   * Lead API. Der einzige Weg, eine file_upload_uuid zu erzeugen (multipart).
   * ⚠ Jeder Aufruf legt ein Projekt an — Kunden werden dedupliziert, Projekte NICHT.
   */
  async lead(body: Record<string, unknown>): Promise<any> {
    const res = await fetch(HERO_LEAD, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    // Validierungsfehler kommen als 500 mit brauchbarem JSON-Body zurück.
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HeroError(`Lead API HTTP ${res.status}`, text.slice(0, 300));
    }
  }

  /** Lead API als multipart — für Datei-Uploads. */
  async leadMultipart(form: FormData): Promise<any> {
    const res = await fetch(HERO_LEAD, { method: "POST", headers: this.headers(), body: form });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HeroError(`Lead API HTTP ${res.status}`, text.slice(0, 300));
    }
  }
}

/** Kurze Pause — Publishing und Indexierung bei HERO sind teilweise asynchron. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lokale Feldnamenprüfung — Regel 3 aus dem hero-api-Skill, ohne einen Request zu verbrennen.
 *
 * HEROs Feldnamen sind uneinheitlich (`duration_in_seconds` nicht `duration`, `product_id`
 * nicht `productId`, `comment` nicht `description`). Ein falscher Name kostet sonst einen
 * Round-Trip — oder schlimmer: bei Mixed-Feldern wird er still verworfen. Die Variablen-
 * deklarationen der Query nennen den Input-Typ, dagegen wird hier geprüft.
 */
function checkVariables(query: string, variables: Record<string, unknown>): void {
  for (const m of query.matchAll(/\$(\w+)\s*:\s*\[?(\w+)/g)) {
    const [, varName, typeName] = m;
    const value = variables[varName];
    if (value === undefined || value === null) continue;
    checkValue(typeName, value, `$${varName}`);
  }
}

function checkValue(typeName: string, value: unknown, path: string): void {
  const fields = INPUT_FIELDS[typeName];
  if (!fields) return; // Skalar, Enum oder Mixed/JSON — nichts zu prüfen
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkValue(typeName, v, `${path}[${i}]`));
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (!(key in fields)) {
      const near = Object.keys(fields).filter((f) =>
        f.replace(/_/g, "").includes(key.replace(/_/g, "").slice(0, 5).toLowerCase()),
      );
      throw new HeroError(
        `${typeName} hat kein Feld '${key}' (bei ${path}).` +
          (near.length ? ` Gemeint: ${near.slice(0, 4).join(", ")}?` : ""),
      );
    }
    const nestedType = fields[key];
    if (nestedType && inner !== null && inner !== undefined) {
      checkValue(nestedType, inner, `${path}.${key}`);
    }
  }
}
