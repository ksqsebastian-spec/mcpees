/**
 * Lesende Tools. Können nichts kaputtmachen — alle mit readOnlyHint.
 *
 * Grundsatz für die Selections: nur Felder, die im Schema (references/schema_full.json)
 * wirklich existieren. `scripts/validate-queries.mjs` prüft das beim Build gegen das
 * eingefrorene Schema, damit ein Tippfehler nicht erst live auffällt.
 */
import { HeroError } from "../hero";
import { norm, type TenantConfig } from "../tenant";
import { type ToolDef, type ToolContext, str, int, bool, req } from "./types";

const MAX_LIMIT = 200;
const clamp = (n: unknown, def: number) =>
  Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : def));

/** status_code 1000 = gelöscht; aktive Dokumente sind alles andere. */
const DELETED_STATUS = 1000;

/** Alle Dokumenttyp-IDs des Mandanten, die Rechnungen sind. */
function invoiceTypeIds(cfg: TenantConfig): number[] {
  const ids = new Set<number>();
  for (const [name, id] of Object.entries(cfg.documentTypes)) {
    if (name.includes("rechnung") && !name.includes("gutschrift")) ids.add(id);
  }
  return [...ids];
}

/** project_match_id aus 'PRJ-153', '153' oder einer Zahl auflösen. */
export async function resolveProject(ctx: ToolContext, nrOrId: string | number): Promise<number> {
  if (typeof nrOrId === "number") return nrOrId;
  const raw = String(nrOrId).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const d = await ctx.hero.gql<{ project_matches: Array<{ id: number }> }>(
    `query ($r: String) { project_matches(relative_id: $r, first: 1) { id } }`,
    { r: raw },
  );
  const hit = d.project_matches?.[0];
  if (!hit) throw new HeroError(`Kein Projekt '${raw}' gefunden.`);
  return hit.id;
}

/** Job-Status auflösen. Verifiziert sind offen/zugewiesen/erledigt; alles andere
 *  wird aus den echten status_name-Werten des Mandanten nachgeschlagen, statt geraten. */
async function resolveJobStatus(ctx: ToolContext, wanted: string): Promise<number[]> {
  const verified: Record<string, number> = { offen: 0, zugewiesen: 100, erledigt: 500 };
  const n = norm(wanted);
  if (/^\d+$/.test(wanted)) return [Number(wanted)];
  if (verified[n] !== undefined) return [verified[n]];

  const d = await ctx.hero.gql<{
    field_service_jobs: Array<{ status_code: number; status_name: string }>;
  }>(`query { field_service_jobs(first: 200) { status_code status_name } }`);
  const seen = new Map<string, number>();
  for (const j of d.field_service_jobs ?? []) {
    if (j.status_name != null) seen.set(norm(j.status_name), j.status_code);
  }
  for (const [name, code] of seen) if (name === n || name.startsWith(n)) return [code];
  throw new HeroError(
    `Status '${wanted}' unbekannt. Verifiziert: offen, zugewiesen, erledigt. ` +
      `Bei diesem Mandanten kommen außerdem vor: ${[...seen.keys()].join(", ") || "(keine Aufträge)"}. ` +
      `Ein status_code als Zahl geht auch.`,
  );
}

export const readTools: ToolDef[] = [
  {
    name: "dashboard",
    title: "Geschäftsüberblick",
    description:
      "Geschäftsüberblick in EINEM Aufruf: offene Posten (Summe + Liste), Termine der nächsten " +
      "7 Tage, offene und zugewiesene Aufträge. Ideal als Einstieg ('was ist heute los?'). " +
      "stichtag optional 'YYYY-MM-DD' (Default: heute).",
    inputSchema: {
      type: "object",
      properties: { stichtag: str("Bezugstag 'YYYY-MM-DD'. Default: heute.") },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const today = args.stichtag ? new Date(`${args.stichtag}T00:00:00Z`) : new Date();
      if (Number.isNaN(today.getTime())) throw new Error("stichtag muss 'YYYY-MM-DD' sein.");
      const start = today.toISOString().slice(0, 10);
      const end = new Date(today.getTime() + 7 * 864e5).toISOString().slice(0, 10);

      const typeIds = invoiceTypeIds(ctx.cfg);
      const d = await ctx.hero.gql<any>(
        `query ($t: [Int], $s: DateTime, $e: DateTime) {
           rechnungen: customer_documents(document_type_ids: $t, first: 100, orderBy: "date desc") {
             id nr value date status_code status_name
             contact { full_name company_name }
             customer_document_booking { is_open due_date balance payments { value paid_date } } }
           termine: calendar_events(start: $s, end: $e, first: 50) {
             id title start end all_day category { name }
             project_match { id project_nr name } }
           auftraege: field_service_jobs(status: [0, 100], first: 50) {
             id display_nr title status_code status_name start end
             customer { full_name company_name } } }`,
        { t: typeIds.length ? typeIds : null, s: `${start}T00:00:00Z`, e: `${end}T23:59:59Z` },
      );

      const offen = (d.rechnungen ?? [])
        .filter((r: any) => r.status_code !== DELETED_STATUS)
        .map((r: any) => {
          const b = r.customer_document_booking;
          const bezahlt = (b?.payments ?? []).reduce((s: number, p: any) => s + (p.value ?? 0), 0);
          const rest = Math.round(((r.value ?? 0) - bezahlt) * 100) / 100;
          const faellig = b?.due_date ?? null;
          const tageUeberfaellig =
            faellig && rest > 0
              ? Math.floor((today.getTime() - new Date(faellig).getTime()) / 864e5)
              : null;
          return {
            document_id: r.id,
            nr: r.nr,
            kunde: r.contact?.company_name || r.contact?.full_name || null,
            betrag: r.value,
            bezahlt,
            restbetrag: rest,
            faellig_am: faellig,
            tage_ueberfaellig: tageUeberfaellig,
            ist_offen: b?.is_open ?? rest > 0,
          };
        })
        .filter((r: any) => r.ist_offen && r.restbetrag > 0.005);

      return {
        stichtag: start,
        offene_posten: {
          anzahl: offen.length,
          summe: Math.round(offen.reduce((s: number, r: any) => s + r.restbetrag, 0) * 100) / 100,
          davon_ueberfaellig: offen.filter((r: any) => (r.tage_ueberfaellig ?? -1) > 0).length,
          posten: offen.slice(0, 25),
        },
        termine_7_tage: (d.termine ?? []).map((t: any) => ({
          id: t.id,
          titel: t.title,
          start: t.start,
          ende: t.end,
          ganztags: t.all_day,
          kategorie: t.category?.name ?? null,
          projekt: t.project_match ? `${t.project_match.project_nr} ${t.project_match.name ?? ""}`.trim() : null,
        })),
        auftraege_offen: (d.auftraege ?? []).map((j: any) => ({
          id: j.id,
          nr: j.display_nr,
          titel: j.title,
          status: j.status_name,
          start: j.start,
          kunde: j.customer?.company_name || j.customer?.full_name || null,
        })),
      };
    },
  },

  {
    name: "search",
    title: "Universalsuche",
    description:
      "Universalsuche über Kontakte, Projekte, Dokumente und Aufträge in EINEM Request. " +
      "Erster Griff, wenn nur ein Name, eine Nummer oder ein Stichwort bekannt ist.",
    inputSchema: {
      type: "object",
      properties: { term: str("Suchbegriff — Name, Firma, Projektnummer, Dokumentnummer …") },
      required: ["term"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const term = req<string>(args, "term");
      const d = await ctx.hero.gql<any>(
        `query ($t: String) {
           kontakte: global_search(category: contacts, term: $t, first: 8)
             { ... on Customer { id full_name company_name email phone_mobile type } }
           projekte: global_search(category: project_matches, term: $t, first: 8)
             { ... on ProjectMatch { id project_nr name
                 current_project_match_status { step_id name } } }
           dokumente: global_search(category: documents, term: $t, first: 8)
             { ... on CustomerDocument { id nr type value date status_name } }
           auftraege: global_search(category: jobs, term: $t, first: 8)
             { ... on FieldService_Job { id display_nr title status_name start } } }`,
        { t: term },
      );
      return {
        kontakte: d.kontakte ?? [],
        projekte: (d.projekte ?? []).map((p: any) => ({
          id: p.id,
          project_nr: p.project_nr,
          name: p.name,
          stufe: p.current_project_match_status?.name ?? null,
        })),
        dokumente: d.dokumente ?? [],
        auftraege: d.auftraege ?? [],
      };
    },
  },

  {
    name: "get_project",
    title: "Projektakte",
    description:
      "Projektakte: Stufe, Kunde, Adresse, Dokumente und Dateien. " +
      "Akzeptiert Projektnummer ('PRJ-153') oder project_match_id.",
    inputSchema: {
      type: "object",
      properties: { nr_or_id: str("Projektnummer wie 'PRJ-153' oder die project_match_id.") },
      required: ["nr_or_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = await resolveProject(ctx, req<string>(args, "nr_or_id"));
      const d = await ctx.hero.gql<any>(
        `query ($i: Int) { project_match(project_match_id: $i) {
           id project_nr name project_id volume
           current_project_match_status { step_id name }
           customer { id full_name company_name email phone_mobile }
           address { street zipcode city }
           customer_documents(first: 30) { id nr type value vat date status_code status_name }
           file_uploads(first: 30) { uuid filename type created } } }`,
        { i: id },
      );
      const p = d.project_match;
      if (!p) throw new HeroError(`Projekt ${id} nicht gefunden.`);
      return {
        ...p,
        stufe: p.current_project_match_status?.name ?? null,
        dokumente_aktiv: (p.customer_documents ?? []).filter(
          (x: any) => x.status_code !== DELETED_STATUS,
        ),
      };
    },
  },

  {
    name: "list_customers",
    title: "Kontakte auflisten",
    description: "Kontakte suchen oder auflisten (Name, Firma, E-Mail, Telefon, Adresse).",
    inputSchema: {
      type: "object",
      properties: {
        search_term: str("Freitextsuche über Name, Firma, E-Mail. Leer = die neuesten."),
        limit: int("Maximale Trefferzahl (1–200, Default 25)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($s: String, $n: Int) {
           contacts(search: $s, first: $n) {
             id nr full_name first_name last_name company_name email
             phone_mobile phone_home category is_deleted
             address { street zipcode city } } }`,
        { s: args.search_term || null, n: clamp(args.limit, 25) },
      );
      return { kontakte: (d.contacts ?? []).filter((c: any) => !c.is_deleted) };
    },
  },

  {
    name: "get_customer",
    title: "Kontakt mit Projekten",
    description: "Ein Kontakt mit allen Adressen und seinen Projekten.",
    inputSchema: {
      type: "object",
      properties: { customer_id: int("Die Kontakt-ID aus list_customers oder search.") },
      required: ["customer_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($i: [Int]) {
           contacts(ids: $i, first: 1) {
             id nr full_name title first_name last_name company_name email
             phone_mobile phone_home category address_id
             address { id street zipcode city }
             customer_addresses { id title address_id address { street zipcode city } }
             project_matches { id project_nr name volume created
               current_project_match_status { step_id name } } } }`,
        { i: [req<number>(args, "customer_id")] },
      );
      const c = d.contacts?.[0];
      if (!c) throw new HeroError(`Kontakt ${args.customer_id} nicht gefunden.`);
      return c;
    },
  },

  {
    name: "list_documents",
    title: "Dokumente eines Projekts",
    description:
      "Dokumente eines Projekts (Angebote, Rechnungen, …) mit Status und Wert. " +
      "only_active=true blendet gelöschte aus.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID (nicht die Projektnummer)."),
        only_active: bool("Nur nicht-gelöschte Dokumente. Default true."),
      },
      required: ["project_match_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($p: [Int]) {
           customer_documents(project_match_ids: $p, first: 100, orderBy: "date desc") {
             id nr type value vat date status_code status_name
             document_type { id name base_type }
             file_upload { uuid filename } } }`,
        { p: [req<number>(args, "project_match_id")] },
      );
      const only = args.only_active !== false;
      const docs = (d.customer_documents ?? []).filter(
        (x: any) => !only || x.status_code !== DELETED_STATUS,
      );
      return { dokumente: docs, anzahl: docs.length };
    },
  },

  {
    name: "list_articles",
    title: "Artikelstamm",
    description:
      "Artikelstamm mit Preisen. Liefert product_id (String!), Nummer, Name, EK (base_price), " +
      "VK (list_price) und den Lagerbestand, falls der Artikel Lagermaterial ist.",
    inputSchema: {
      type: "object",
      properties: {
        search_term: str("Freitextsuche über Name, Nummer, Hersteller."),
        limit: int("Maximale Trefferzahl (1–200, Default 25)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($s: String, $n: Int) {
           supply_product_versions(search: $s, first: $n) {
             product_id nr base_price list_price vat_percent price_quantity is_deleted
             base_data { name description unit_type manufacturer ean category }
             stock_materials { id total_stock min_stock unit_type } } }`,
        { s: args.search_term || null, n: clamp(args.limit, 25) },
      );
      return {
        artikel: (d.supply_product_versions ?? [])
          .filter((a: any) => !a.is_deleted)
          .map((a: any) => ({
            product_id: a.product_id,
            nr: a.nr,
            name: a.base_data?.name ?? null,
            einheit: a.base_data?.unit_type ?? null,
            hersteller: a.base_data?.manufacturer ?? null,
            ek: a.base_price,
            vk: a.list_price,
            mwst: a.vat_percent,
            bestand: a.stock_materials?.[0]?.total_stock ?? null,
          })),
      };
    },
  },

  {
    name: "get_stock",
    title: "Lagerbestand",
    description:
      "Lagerbestand eines Artikels, gelesen über den Artikel. product_id ist ein String " +
      "(HERO nutzt hier keine Zahl) — aus list_articles übernehmen.",
    inputSchema: {
      type: "object",
      properties: { product_id: str("product_id aus list_articles (String, keine Zahl).") },
      required: ["product_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($p: [String]) {
           supply_product_versions(product_ids: $p, first: 1) {
             product_id nr base_data { name unit_type }
             stock_materials { id name item_number category unit_type
               total_stock min_stock target_stock
               open_order_items_amount open_consignment_items_amount } } }`,
        { p: [req<string>(args, "product_id")] },
      );
      const a = d.supply_product_versions?.[0];
      if (!a) throw new HeroError(`Artikel '${args.product_id}' nicht gefunden.`);
      if (!a.stock_materials?.length) {
        return { product_id: a.product_id, name: a.base_data?.name, hinweis: "Kein Lagerartikel." };
      }
      return { product_id: a.product_id, name: a.base_data?.name, lager: a.stock_materials };
    },
  },

  {
    name: "list_jobs",
    title: "Field-Service-Aufträge",
    description:
      "Field-Service-Aufträge (Wartung, Reparatur, Notdienst). status akzeptiert " +
      "offen/zugewiesen/erledigt (verifiziert) oder einen status_code als Zahl; " +
      "andere Namen werden gegen die tatsächlichen Statuswerte des Mandanten aufgelöst.",
    inputSchema: {
      type: "object",
      properties: {
        status: str("offen | zugewiesen | erledigt | <status_code als Zahl>"),
        project_match_id: int("Nur Aufträge zu diesem Projekt."),
        search_term: str("Freitext über den Auftragstitel."),
        limit: int("Maximale Trefferzahl (1–200, Default 25)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const status = args.status ? await resolveJobStatus(ctx, String(args.status)) : null;
      const d = await ctx.hero.gql<any>(
        `query ($st: [Int], $p: Int, $s: String, $n: Int) {
           field_service_jobs(status: $st, project_match_id: $p, search: $s, first: $n,
                              orderBy: "start desc") {
             id display_nr title description type localized_type status_code status_name
             start end project_match_id
             customer { id full_name company_name }
             address { street zipcode city }
             partners { id full_name } } }`,
        {
          st: status,
          p: args.project_match_id ?? null,
          s: args.search_term || null,
          n: clamp(args.limit, 25),
        },
      );
      return { auftraege: d.field_service_jobs ?? [] };
    },
  },

  {
    name: "get_checklists",
    title: "Checklisten eines Auftrags",
    description:
      "Checklisten eines Auftrags inklusive der vor Ort in der Mobile-App ausgefüllten Antworten " +
      "(Feld 'data').",
    inputSchema: {
      type: "object",
      properties: { job_id: int("Die Auftrags-ID aus list_jobs.") },
      required: ["job_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($j: Int) {
           job_checklists(job_id: $j, first: 50) {
             id name status data created modified
             partner { id full_name } } }`,
        { j: req<number>(args, "job_id") },
      );
      return { checklisten: d.job_checklists ?? [] };
    },
  },

  {
    name: "list_calendar",
    title: "Termine",
    description:
      "Termine im Zeitraum. start/end als ISO MIT Offset ('2026-07-20T00:00:00+02:00'); " +
      "ohne Offset antwortet HERO mit einem Serverfehler.",
    inputSchema: {
      type: "object",
      properties: {
        start: str("Beginn des Zeitraums, ISO mit Offset."),
        end: str("Ende des Zeitraums, ISO mit Offset."),
        project_match_id: int("Nur Termine zu diesem Projekt."),
        limit: int("Maximale Trefferzahl (1–200, Default 100)."),
      },
      required: ["start", "end"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($s: DateTime, $e: DateTime, $p: Int, $n: Int) {
           calendar_events(start: $s, end: $e, project_match_id: $p, first: $n, orderBy: "start asc") {
             id title description start end all_day is_done color
             category { id name }
             project_match { id project_nr name }
             partners { id full_name } } }`,
        {
          s: req<string>(args, "start"),
          e: req<string>(args, "end"),
          p: args.project_match_id ?? null,
          n: clamp(args.limit, 100),
        },
      );
      return { termine: d.calendar_events ?? [] };
    },
  },

  {
    name: "list_time",
    title: "Erfasste Zeiten",
    description:
      "Erfasste Arbeitszeiten eines Projekts (Datum, Dauer, Kommentar, Mitarbeiter). " +
      "start/end als 'YYYY-MM-DD'. Dauer steht in duration_in_seconds.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        start: str("Von-Datum 'YYYY-MM-DD'."),
        end: str("Bis-Datum 'YYYY-MM-DD'."),
      },
      required: ["project_match_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($p: Int, $s: Date, $e: Date) {
           tracking_times(project_match_id: $p, start: $s, end: $e, first: 200,
                          show_all_partners: true, orderBy: "start asc") {
             id start end duration_in_seconds comment status_code
             partner { id full_name }
             tracking_times_category { id name } } }`,
        {
          p: req<number>(args, "project_match_id"),
          s: args.start || null,
          e: args.end || null,
        },
      );
      const zeiten = d.tracking_times ?? [];
      const sekunden = zeiten.reduce((s: number, t: any) => s + (t.duration_in_seconds ?? 0), 0);
      return {
        zeiten,
        summe_sekunden: sekunden,
        summe_stunden: Math.round((sekunden / 3600) * 100) / 100,
      };
    },
  },

  {
    name: "list_open_invoices",
    title: "Offene Posten",
    description:
      "Debitoren-Offene-Posten: wer schuldet was und hängt wie weit hinterher. " +
      "Restbetrag wird aus Rechnungswert minus erfassten Zahlungen gerechnet.",
    inputSchema: {
      type: "object",
      properties: { overdue_only: bool("Nur überfällige Rechnungen. Default false.") },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const typeIds = invoiceTypeIds(ctx.cfg);
      const d = await ctx.hero.gql<any>(
        `query ($t: [Int]) {
           customer_documents(document_type_ids: $t, first: 200, orderBy: "date desc") {
             id nr value vat date status_code status_name
             project_match_id
             contact { id full_name company_name email }
             customer_document_booking { is_open status_name due_date paid_date balance
               payments { id value paid_date } } } }`,
        { t: typeIds.length ? typeIds : null },
      );
      const now = Date.now();
      const posten = (d.customer_documents ?? [])
        .filter((r: any) => r.status_code !== DELETED_STATUS)
        .map((r: any) => {
          const b = r.customer_document_booking;
          const bezahlt = (b?.payments ?? []).reduce((s: number, p: any) => s + (p.value ?? 0), 0);
          const rest = Math.round(((r.value ?? 0) - bezahlt) * 100) / 100;
          const tage = b?.due_date
            ? Math.floor((now - new Date(b.due_date).getTime()) / 864e5)
            : null;
          return {
            document_id: r.id,
            nr: r.nr,
            project_match_id: r.project_match_id,
            kunde: r.contact?.company_name || r.contact?.full_name || null,
            email: r.contact?.email ?? null,
            datum: r.date,
            betrag: r.value,
            bezahlt,
            restbetrag: rest,
            faellig_am: b?.due_date ?? null,
            tage_ueberfaellig: tage,
            status: b?.status_name ?? r.status_name,
          };
        })
        .filter((r: any) => r.restbetrag > 0.005)
        .filter((r: any) => !args.overdue_only || (r.tage_ueberfaellig ?? -1) > 0);

      return {
        anzahl: posten.length,
        summe: Math.round(posten.reduce((s: number, r: any) => s + r.restbetrag, 0) * 100) / 100,
        posten,
      };
    },
  },

  {
    name: "get_payment_status",
    title: "Zahlungsstatus",
    description:
      "Zahlungsstatus einer Rechnung: offen oder bezahlt, Restbetrag, Fälligkeit und die " +
      "erfassten Zahlungen. Das ist der Rücklesepfad für record_payment.",
    inputSchema: {
      type: "object",
      properties: { document_id: int("Die Dokument-ID der Rechnung.") },
      required: ["document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($i: [Int]) {
           customer_documents(ids: $i, first: 1) {
             id nr type value vat date status_code status_name
             contact { id full_name company_name }
             customer_document_booking { id is_open status status_name due_date paid_date
               discount_rate discount_date balance
               payments { id value paid_date created } } } }`,
        { i: [req<number>(args, "document_id")] },
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Dokument ${args.document_id} nicht gefunden.`);
      const b = doc.customer_document_booking;
      const bezahlt = (b?.payments ?? []).reduce((s: number, p: any) => s + (p.value ?? 0), 0);
      return {
        document_id: doc.id,
        nr: doc.nr,
        kunde: doc.contact?.company_name || doc.contact?.full_name || null,
        betrag: doc.value,
        bezahlt,
        restbetrag: Math.round(((doc.value ?? 0) - bezahlt) * 100) / 100,
        ist_offen: b?.is_open ?? null,
        faellig_am: b?.due_date ?? null,
        bezahlt_am: b?.paid_date ?? null,
        status: b?.status_name ?? doc.status_name,
        zahlungen: b?.payments ?? [],
        hinweis: b ? undefined : "Für dieses Dokument existiert kein Buchungssatz (nicht zahlungsrelevant).",
      };
    },
  },

  {
    name: "list_receipts",
    title: "Belege (Eingangsseite)",
    description:
      "Eingangsbelege inklusive Zahlungsstand. offen = Wert minus paid_sum. " +
      "Hinweis: Belege lassen sich über die HERO-API nur lesen, nicht anlegen.",
    inputSchema: {
      type: "object",
      properties: { limit: int("Maximale Trefferzahl (1–200, Default 50).") },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `query ($n: Int) {
           receipts(first: $n, orderBy: "receipt_date desc") {
             id number type status_code receipt_date due_date paid_date paid_sum value
             customer { id full_name company_name } } }`,
        { n: clamp(args.limit, 50) },
      );
      return {
        belege: (d.receipts ?? []).map((r: any) => ({
          ...r,
          offen: Math.round(((r.value ?? 0) - (r.paid_sum ?? 0)) * 100) / 100,
        })),
      };
    },
  },

  {
    name: "download_document",
    title: "PDF-Link eines Dokuments",
    description:
      "Vorsignierter, zeitbegrenzter PDF-Link eines Dokuments — der Empfänger braucht keinen " +
      "Token. Existiert kein PDF, ist das Dokument noch Entwurf oder im Publishing (~5–8 s).",
    inputSchema: {
      type: "object",
      properties: {
        document_id: int("Die Dokument-ID."),
        minutes: int("Gültigkeit des Links in Minuten (Default 5)."),
      },
      required: ["document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<number>(args, "document_id");
      const seconds = Math.max(60, Math.min(60 * 60 * 24, (Number(args.minutes) || 5) * 60));
      const d = await ctx.hero.gql<any>(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr status_name file_upload { uuid filename } } }`,
        { i: [id] },
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Dokument ${id} nicht gefunden.`);
      if (!doc.file_upload?.uuid) {
        throw new HeroError(
          `Dokument ${doc.nr ?? id} hat kein PDF (Status: ${doc.status_name}). ` +
            `Entwürfe und noch laufendes Publishing haben keine Datei.`,
        );
      }
      const u = await ctx.hero.gql<any>(
        `query ($u: [String!], $s: Int) { file_uploads(uuids: $u, first: 1) {
           uuid filename temporary_url(expires: $s) } }`,
        { u: [doc.file_upload.uuid], s: seconds },
      );
      return {
        nr: doc.nr,
        filename: u.file_uploads?.[0]?.filename ?? doc.file_upload.filename,
        url: u.file_uploads?.[0]?.temporary_url,
        gueltig_bis_minuten: seconds / 60,
      };
    },
  },

  {
    name: "download_file",
    title: "Link für eine Datei",
    description: "Vorsignierter, zeitbegrenzter Link für eine beliebige Datei per uuid.",
    inputSchema: {
      type: "object",
      properties: {
        file_upload_uuid: str("Die uuid aus get_project oder upload_file."),
        minutes: int("Gültigkeit des Links in Minuten (Default 5)."),
      },
      required: ["file_upload_uuid"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const seconds = Math.max(60, Math.min(60 * 60 * 24, (Number(args.minutes) || 5) * 60));
      const d = await ctx.hero.gql<any>(
        `query ($u: [String!], $s: Int) { file_uploads(uuids: $u, first: 1) {
           uuid filename type size temporary_url(expires: $s) } }`,
        { u: [req<string>(args, "file_upload_uuid")], s: seconds },
      );
      const f = d.file_uploads?.[0];
      if (!f) throw new HeroError(`Datei ${args.file_upload_uuid} nicht gefunden.`);
      return { ...f, url: f.temporary_url, gueltig_bis_minuten: seconds / 60 };
    },
  },
];
