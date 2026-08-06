/**
 * Mandanten-Konfiguration.
 *
 * Die Python-Vorlage hatte project_type, measure, Dokumenttyp-IDs, Terminkategorien und
 * die partner_id für Company 100815 (Seehafer Elemente) fest im Code. Das funktioniert
 * genau bei einem Mandanten. Weil dieser Server jetzt mehrmandantenfähig ist (jeder bringt
 * seinen eigenen HERO-Key mit), werden diese IDs pro Zugang aus HERO abgeleitet und in KV
 * zwischengespeichert.
 */
import { Hero, HeroError } from "./hero";
import { sha256hex } from "./crypto";

export interface TenantConfig {
  companyId: number | null;
  companyName: string;
  /** Default-Projekttyp, unter dem neue Projekte angelegt werden. */
  projectTypeId: number | null;
  /** step-Name (normalisiert) -> step_id des Default-Projekttyps. */
  steps: Record<string, number>;
  /** Anzeigenamen der Stufen, nach step_id. */
  stepNames: Record<string, string>;
  /** Dokumenttyp-Name (normalisiert) -> id. */
  documentTypes: Record<string, number>;
  /** Original-Anzeigenamen der Dokumenttypen, für Fehlermeldungen. */
  documentTypeNames: string[];
  /** Terminkategorie (normalisiert) -> id. */
  calendarCategories: Record<string, number>;
  /** Default-Maßnahme für neue Projekte (oder null, wenn der Mandant keine hat). */
  measureId: number | null;
  measures: Record<string, number>;
  /** Partner-ID des Key-Inhabers — Default für Termine, Zeiten, Jobs. */
  partnerId: number | null;
  partnerName: string;
  fetchedAt: number;
}

/** Umlaute weg, Kleinschreibung, nur Buchstaben/Ziffern — macht Namensvergleiche robust. */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

const DISCOVERY = `query {
  company { id name measures { id name short } }
  user { id email partner { id full_name } }
  project_types(is_active: true) {
    id name is_default is_active
    project_status_steps { id name status_code sort_order is_active }
  }
  document_types(show_deleted: false) { id name base_type is_active }
  calendar_event_categories(show_deleted: false) { id name }
}`;

interface DiscoveryResult {
  company: { id: number; name: string; measures: Array<{ id: number; name: string; short: string }> } | null;
  user: { id: number; email: string; partner: { id: number; full_name: string } | null } | null;
  project_types: Array<{
    id: number;
    name: string;
    is_default: boolean | null;
    is_active: boolean | null;
    project_status_steps: Array<{
      id: number;
      name: string;
      status_code: number | null;
      sort_order: number | null;
      is_active: boolean | null;
    }> | null;
  }> | null;
  document_types: Array<{ id: number; name: string; base_type: string | null; is_active: boolean | null }> | null;
  calendar_event_categories: Array<{ id: number; name: string }> | null;
}

export async function discoverConfig(hero: Hero): Promise<TenantConfig> {
  const d = await hero.gql<DiscoveryResult>(DISCOVERY);

  const types = (d.project_types ?? []).filter((t) => t.is_active !== false);
  // Default-Projekttyp: der als default markierte, sonst der mit den meisten Stufen.
  const defType =
    types.find((t) => t.is_default) ??
    types.slice().sort(
      (a, b) => (b.project_status_steps?.length ?? 0) - (a.project_status_steps?.length ?? 0),
    )[0] ??
    null;

  const steps: Record<string, number> = {};
  const stepNames: Record<string, string> = {};
  for (const s of defType?.project_status_steps ?? []) {
    if (s.is_active === false) continue;
    steps[norm(s.name)] = s.id;
    stepNames[String(s.id)] = s.name;
  }

  const documentTypes: Record<string, number> = {};
  const documentTypeNames: string[] = [];
  for (const t of d.document_types ?? []) {
    if (t.is_active === false) continue;
    documentTypes[norm(t.name)] = t.id;
    if (t.base_type && !(norm(t.base_type) in documentTypes)) {
      documentTypes[norm(t.base_type)] = t.id;
    }
    documentTypeNames.push(t.name);
  }

  const calendarCategories: Record<string, number> = {};
  for (const c of d.calendar_event_categories ?? []) calendarCategories[norm(c.name)] = c.id;

  const measures: Record<string, number> = {};
  for (const m of d.company?.measures ?? []) {
    measures[norm(m.name)] = m.id;
    if (m.short) measures[norm(m.short)] = m.id;
  }
  // 'PRJ' ist HEROs generische Maßnahme "Projekt"; sonst die erste verfügbare.
  const measureId =
    measures[norm("PRJ")] ?? measures[norm("Projekt")] ?? d.company?.measures?.[0]?.id ?? null;

  return {
    companyId: d.company?.id ?? null,
    companyName: d.company?.name ?? "unbekannt",
    projectTypeId: defType?.id ?? null,
    steps,
    stepNames,
    documentTypes,
    documentTypeNames,
    calendarCategories,
    measureId,
    measures,
    partnerId: d.user?.partner?.id ?? null,
    partnerName: d.user?.partner?.full_name ?? d.user?.email ?? "unbekannt",
    fetchedAt: Date.now(),
  };
}

const TTL_SECONDS = 60 * 60 * 12;

/** Config aus KV oder frisch von HERO. Cache-Key ist der Hash des API-Keys, nicht der Key. */
export async function getConfig(kv: KVNamespace, hero: Hero, apiKey: string): Promise<TenantConfig> {
  const cacheKey = `cfg:${(await sha256hex(apiKey)).slice(0, 32)}`;
  const cached = await kv.get<TenantConfig>(cacheKey, "json");
  if (cached) return cached;
  const cfg = await discoverConfig(hero);
  await kv.put(cacheKey, JSON.stringify(cfg), { expirationTtl: TTL_SECONDS });
  return cfg;
}

/** Dokumenttyp auflösen — akzeptiert die kanonischen Kürzel und jeden Mandanten-Namen. */
export function resolveDocumentType(cfg: TenantConfig, wanted: string): number {
  const n = norm(wanted);
  if (cfg.documentTypes[n] !== undefined) return cfg.documentTypes[n];

  // Kanonische Kürzel auf die tatsächlichen Namen des Mandanten abbilden.
  const aliases: Record<string, (name: string) => boolean> = {
    rechnung13b: (x) => x.includes("13b"),
    rechnung: (x) => x.includes("rechnung") && !x.includes("13b") && !x.includes("gutschrift"),
    angebot: (x) => x.includes("angebot") && !x.includes("bestaetigung"),
    gutschrift: (x) => x.includes("gutschrift"),
    auftragsbestaetigung: (x) => x.includes("auftragsbest"),
    lieferschein: (x) => x.includes("lieferschein"),
    allgemein: (x) => x.includes("allgemein") || x.includes("sonstig"),
  };
  const match = aliases[n];
  if (match) {
    for (const key of Object.keys(cfg.documentTypes)) {
      if (match(key)) return cfg.documentTypes[key];
    }
  }
  throw new HeroError(
    `Dokumenttyp '${wanted}' gibt es bei ${cfg.companyName} nicht. ` +
      `Verfügbar: ${cfg.documentTypeNames.join(", ")}`,
  );
}

/** Pipeline-Stufe auflösen — Name oder rohe step_id. */
export function resolveStep(cfg: TenantConfig, wanted: string | number): number {
  if (typeof wanted === "number") return wanted;
  const n = norm(wanted);
  if (cfg.steps[n] !== undefined) return cfg.steps[n];
  for (const [k, v] of Object.entries(cfg.steps)) if (k.startsWith(n) || n.startsWith(k)) return v;
  throw new HeroError(
    `Stufe '${wanted}' unbekannt. Verfügbar: ${Object.values(cfg.stepNames).join(", ")}`,
  );
}
