/**
 * Schreibende Tools. Alle nicht-destruktiv: sie legen an, sie ändern und löschen nichts.
 *
 * Jede Falle aus references/FACTS.md ist hier eingebaut, nicht dokumentiert-und-gehofft:
 *  - Mutations laufen ausnahmslos über Variablen (Mixed-Scalars verwerfen Inline-Literale still).
 *  - create_project_match braucht address_id (undokumentierte Pflicht).
 *  - Artikel ohne sales_prices + default_sales_price kalkulieren mit dem EINKAUFSpreis.
 *  - Checklisten-data wird bei falscher Form still geleert → Readback prüft die entries.
 *  - Job-type ist eine geschlossene Liste, die API schluckt aber jeden Wert still ('unknown').
 *  - Einheiten sind eine geschlossene Liste; 'Pauschal' gibt es nicht, das ist 'Satz'.
 */
import { HeroError, sleep } from "../hero";
import { resolveDocumentType, norm } from "../tenant";
import { type ToolDef, type ToolContext, str, int, num, req } from "./types";
import { resolveProject } from "./read";

/** Geschlossene Liste der Einheiten, die HERO im Dokument akzeptiert. */
const UNITS = [
  "Stk", "Std", "lfm", "m", "m²", "m³", "h", "kg", "g", "ml", "cm", "mm", "km",
  "Tag", "Woche", "Satz", "Paar", "Set", "Sack", "%",
];
const UNIT_ALIASES: Record<string, string> = {
  pauschal: "Satz", psch: "Satz", stück: "Stk", stueck: "Stk", stk: "Stk", st: "Stk",
  stunde: "Std", stunden: "Std", std: "Std", qm: "m²", m2: "m²", m3: "m³", cbm: "m³",
  lfdm: "lfm", laufmeter: "lfm", tage: "Tag", wochen: "Woche",
};

function unit(raw: string): string {
  const exact = UNITS.find((u) => u.toLowerCase() === String(raw).toLowerCase());
  if (exact) return exact;
  const alias = UNIT_ALIASES[norm(raw)];
  if (alias) return alias;
  throw new HeroError(
    `Einheit '${raw}' gibt es bei HERO nicht. Erlaubt: ${UNITS.join(" ")}. ` +
      `('Pauschal' heißt bei HERO 'Satz'.)`,
  );
}

const JOB_TYPES = ["maintenance", "repair", "emergency", "other"];
const CHECKLIST_TYPES = ["checkbox", "text", "image", "signature", "select"];

interface PositionArg {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  description?: string;
  vat_percent?: number;
}

const POSITION_SCHEMA = {
  type: "array",
  description:
    "Positionen als Objekte. Beträge sind Netto-Einzelpreise. " +
    "Für Abschlags-/Schlussrechnungen dürfen Beträge negativ sein.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Positionsbezeichnung." },
      unit: { type: "string", description: `Einheit — eine aus: ${UNITS.join(" ")}` },
      quantity: { type: "number", description: "Menge." },
      unit_price: { type: "number", description: "Netto-Einzelpreis." },
      description: { type: "string", description: "Optionaler Langtext." },
      vat_percent: { type: "number", description: "MwSt.-Satz, Default 19." },
    },
    required: ["name", "unit", "quantity", "unit_price"],
    additionalProperties: false,
  },
};

function buildPositions(positions: PositionArg[]): unknown[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new HeroError("positions darf nicht leer sein.");
  }
  return positions.map((p, i) => {
    if (!p || typeof p !== "object") throw new HeroError(`Position ${i + 1} ist kein Objekt.`);
    if (!p.name) throw new HeroError(`Position ${i + 1}: 'name' fehlt.`);
    if (typeof p.quantity !== "number") throw new HeroError(`Position ${i + 1}: 'quantity' muss eine Zahl sein.`);
    if (typeof p.unit_price !== "number") throw new HeroError(`Position ${i + 1}: 'unit_price' muss eine Zahl sein.`);
    return {
      add_product_position: {
        name: p.name,
        description: p.description ?? "",
        unit_type: unit(p.unit),
        quantity: p.quantity,
        net_price: p.unit_price,
        vat_percent: p.vat_percent ?? 19,
      },
    };
  });
}

/** Empfängerblock frisch aus HERO — nie aus dem Prompt geraten. */
async function recipientFor(ctx: ToolContext, projectMatchId: number) {
  const d = await ctx.hero.gql<any>(
    `query ($i: Int) { project_match(project_match_id: $i) {
       id customer { title first_name last_name company_name
         address { street zipcode city } } } }`,
    { i: projectMatchId },
  );
  const c = d.project_match?.customer;
  if (!c) throw new HeroError(`Projekt ${projectMatchId} hat keinen Kunden — Dokument nicht möglich.`);
  return {
    company_name: c.company_name ?? "",
    title: c.title ?? "",
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    street: c.address?.street ?? "",
    zipcode: c.address?.zipcode ?? "",
    city: c.address?.city ?? "",
  };
}

/**
 * Dokument über den Document-Builder anlegen.
 * Die Mutation-Antwort ist unzuverlässig (value: 0 trotz korrektem Betrag), deshalb wird
 * kurz gepollt und das Ergebnis frisch gelesen. Publishing ist async (~5–8 s) — wir warten
 * bewusst nur kurz und verweisen dann auf download_document, statt den Client blockieren.
 */
async function createDocument(
  ctx: ToolContext,
  documentTypeId: number,
  projectMatchId: number,
  actions: unknown[],
  publish: boolean,
) {
  const r = await ctx.hero.gql<any>(
    `mutation ($i: Documents_CreateDocumentInput!, $a: [Documents_DocumentBuilderActionInput!]!) {
       create_document(input: $i, actions: $a) { customer_document_id } }`,
    {
      i: { document_type_id: documentTypeId, project_match_id: projectMatchId, publish },
      a: actions,
    },
  );
  const id = r.create_document?.customer_document_id;
  if (!id) throw new HeroError("create_document lieferte keine customer_document_id.", r);

  let doc: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt === 0 ? 1500 : 2500);
    const d = await ctx.hero.gql<any>(
      `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
         id nr type value vat date status_code status_name file_upload { uuid filename } } }`,
      { i: [id] },
    );
    doc = d.customer_documents?.[0] ?? doc;
    if (!publish || doc?.file_upload?.uuid) break;
  }

  return {
    document_id: id,
    nr: doc?.nr ?? null,
    wert: doc?.value ?? null,
    mwst: doc?.vat ?? null,
    status: doc?.status_name ?? null,
    pdf_bereit: Boolean(doc?.file_upload?.uuid),
    hinweis: doc?.file_upload?.uuid
      ? "PDF-Link über download_document."
      : "Publishing läuft noch (asynchron). In ein paar Sekunden download_document aufrufen.",
  };
}

export const writeTools: ToolDef[] = [
  {
    name: "create_customer",
    title: "Kontakt anlegen",
    description:
      "Kontakt mit Adresse anlegen. Wird über die Stammdaten dedupliziert — ein bereits " +
      "vorhandener Kontakt wird zurückgegeben statt doppelt angelegt. Liefert id UND address_id; " +
      "die address_id braucht create_project zwingend.",
    inputSchema: {
      type: "object",
      properties: {
        email: str("E-Mail — Grundlage der Deduplizierung."),
        first_name: str("Vorname."),
        last_name: str("Nachname. Bei HERO Pflicht (außer es gibt einen Firmennamen)."),
        street: str("Straße und Hausnummer."),
        zip_code: str("PLZ. Achtung: 4-stellige PLZ deutet HERO IMMER als Schweiz."),
        city: str("Ort."),
        salutation: str("Anrede, z. B. 'Herr' oder 'Frau'."),
        company: str("Firmenname."),
        phone: str("Mobilnummer."),
      },
      required: ["email", "first_name", "last_name", "street", "zip_code", "city"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async handler(args, ctx) {
      const contact: Record<string, unknown> = {
        email: req<string>(args, "email"),
        first_name: req<string>(args, "first_name"),
        last_name: req<string>(args, "last_name"),
        title: args.salutation ?? "Herr",
        category: "customer",
        address: {
          street: req<string>(args, "street"),
          zipcode: req<string>(args, "zip_code"),
          city: req<string>(args, "city"),
        },
      };
      if (args.company) contact.company_name = args.company;
      if (args.phone) contact.phone_mobile = args.phone;

      const d = await ctx.hero.gql<any>(
        `mutation ($c: CustomerInput) { create_contact(findExisting: true, contact: $c) {
           id nr email full_name company_name address_id } }`,
        { c: contact },
      );
      const c = d.create_contact;
      if (!c?.address_id) {
        throw new HeroError("Kontakt angelegt, aber ohne address_id — create_project würde scheitern.", c);
      }
      return c;
    },
  },

  {
    name: "create_project",
    title: "Projekt anlegen",
    description:
      "Projekt auf einen Kunden anlegen. Startet immer auf der ersten Stufe — eine beim Anlegen " +
      "mitgegebene Stufe ignoriert HERO. Projekte sind bei HERO NICHT löschbar.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: int("Kontakt-ID aus create_customer, get_customer oder search."),
        name: str("Projektname, z. B. 'Fenstertausch Musterstraße'."),
      },
      required: ["customer_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const customerId = req<number>(args, "customer_id");
      // address_id ist undokumentierte Pflicht — ohne sie: InvalidPrimaryKeyException.
      const c = await ctx.hero.gql<any>(
        `query ($i: [Int]) { contacts(ids: $i, first: 1) { id address_id full_name } }`,
        { i: [customerId] },
      );
      const kunde = c.contacts?.[0];
      if (!kunde) throw new HeroError(`Kontakt ${customerId} nicht gefunden.`);
      if (!kunde.address_id) {
        throw new HeroError(
          `Kontakt ${customerId} hat keine Adresse. HERO braucht address_id für ein Projekt — ` +
            `erst eine Adresse am Kontakt hinterlegen.`,
        );
      }
      const pm: Record<string, unknown> = {
        customer_id: customerId,
        address_id: kunde.address_id,
        name: args.name ?? "",
      };
      if (ctx.cfg.projectTypeId) pm.type_id = ctx.cfg.projectTypeId;
      if (ctx.cfg.measureId) pm.measure_id = ctx.cfg.measureId;

      const d = await ctx.hero.gql<any>(
        `mutation ($pm: ProjectMatchInput) { create_project_match(project_match: $pm) {
           id project_nr project_id name
           current_project_match_status { step_id name } } }`,
        { pm },
      );
      const p = d.create_project_match;
      return { ...p, stufe: p?.current_project_match_status?.name ?? null, kunde: kunde.full_name };
    },
  },

  {
    name: "create_offer",
    title: "Angebot anlegen",
    description:
      "Angebot über den Document-Builder anlegen. Der Empfänger wird frisch aus HERO gelesen. " +
      "⚠ Ein veröffentlichtes Angebot verschiebt das Projekt automatisch auf die Stufe " +
      "'Angebot verschickt'. Höchstens EIN Titel: ab zwei Titeln zeigt HEROs PDF je Titel 0,00 €.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        positions: POSITION_SCHEMA,
        title: str("Optionaler Titel über den Positionen (höchstens einer)."),
        intro: str("Optionaler Einleitungstext."),
        discount_percent: num("Nachlass in Prozent auf das Gesamtdokument."),
      },
      required: ["project_match_id", "positions"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req<number>(args, "project_match_id");
      const actions: unknown[] = [{ set_recipient: await recipientFor(ctx, pm) }];
      if (args.title) actions.push({ add_title: { text: args.title, tier: 0 } });
      if (args.intro) actions.push({ add_text: { text: args.intro } });
      actions.push(...buildPositions(args.positions));
      if (args.discount_percent) {
        actions.push({
          set_document_discount: {
            valueType: "PERCENT",
            value: args.discount_percent,
            label: "Nachlass",
          },
        });
      }
      return createDocument(ctx, resolveDocumentType(ctx.cfg, "angebot"), pm, actions, true);
    },
  },

  {
    name: "create_invoice_from_offer",
    title: "Rechnung aus Angebot",
    description:
      "Rechnung mit exakt den Positionen des Angebots — centgenau, inklusive Referenz auf das " +
      "Angebot. Positionen werden aus dem veröffentlichten Angebotsentwurf übernommen, nicht neu getippt.",
    inputSchema: {
      type: "object",
      properties: {
        offer_document_id: int("Dokument-ID des Angebots."),
        project_match_id: int("Die Projekt-ID."),
      },
      required: ["offer_document_id", "project_match_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const offerId = req<number>(args, "offer_document_id");
      const pm = req<number>(args, "project_match_id");
      const d = await ctx.hero.gql<any>(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr published_customer_document_draft { data } } }`,
        { i: [offerId] },
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Angebot ${offerId} nicht gefunden.`);
      const data = doc.published_customer_document_draft?.data;
      if (!data) {
        throw new HeroError(
          `Angebot ${doc.nr ?? offerId} ist nicht veröffentlicht — es gibt keine übernehmbaren Positionen.`,
        );
      }
      const uids: string[] = [];
      (function walk(o: any) {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === "object") {
          if (o.type === "product" && o.uid) uids.push(o.uid);
          Object.values(o).forEach(walk);
        }
      })(data);
      if (!uids.length) throw new HeroError(`Angebot ${doc.nr ?? offerId} enthält keine Positionen.`);

      const actions = [
        { set_recipient: await recipientFor(ctx, pm) },
        {
          add_positions_from_document: {
            documentId: offerId,
            selectedPositions: uids,
            flowType: "copy",
            fixedItemNumbers: true,
          },
        },
        {
          set_reference_documents: {
            referenceDocumentIds: [offerId],
            referenceDocuments: doc.nr,
          },
        },
      ];
      return createDocument(ctx, resolveDocumentType(ctx.cfg, "rechnung"), pm, actions, true);
    },
  },

  {
    name: "create_document",
    title: "Dokument anlegen",
    description:
      "Beliebiges Dokument anlegen: rechnung, angebot, gutschrift, auftragsbestaetigung, " +
      "lieferschein, allgemein, rechnung_13b — oder jeder Dokumenttyp-Name dieses Mandanten. " +
      "Abschlags- und Schlussrechnungen sind 'rechnung' mit passenden (auch negativen) Positionen.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        doc_type: str("Dokumenttyp — Kürzel oder der Name aus der HERO-Konfiguration."),
        positions: POSITION_SCHEMA,
        title: str("Optionaler Titel über den Positionen."),
        intro: str("Optionaler Einleitungstext."),
      },
      required: ["project_match_id", "doc_type", "positions"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req<number>(args, "project_match_id");
      const typeId = resolveDocumentType(ctx.cfg, req<string>(args, "doc_type"));
      const actions: unknown[] = [{ set_recipient: await recipientFor(ctx, pm) }];
      if (args.title) actions.push({ add_title: { text: args.title, tier: 0 } });
      if (args.intro) actions.push({ add_text: { text: args.intro } });
      actions.push(...buildPositions(args.positions));
      return createDocument(ctx, typeId, pm, actions, true);
    },
  },

  {
    name: "create_timesheet",
    title: "Stundenzettel",
    description:
      "Stundenzettel als PDF aus den bereits erfassten Zeiten eines Projekts. Baut ein Dokument " +
      "vom Typ 'allgemein' mit je einer Position pro Zeiteintrag (Menge = Stunden). " +
      "date_from/date_to als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        date_from: str("Von-Datum 'YYYY-MM-DD'."),
        date_to: str("Bis-Datum 'YYYY-MM-DD'."),
        title: str("Überschrift, Default 'Stundenzettel'."),
      },
      required: ["project_match_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req<number>(args, "project_match_id");
      const d = await ctx.hero.gql<any>(
        `query ($p: Int, $s: Date, $e: Date) {
           tracking_times(project_match_id: $p, start: $s, end: $e, first: 200,
                          show_all_partners: true, orderBy: "start asc") {
             id start end duration_in_seconds comment
             partner { full_name } } }`,
        { p: pm, s: args.date_from || null, e: args.date_to || null },
      );
      const zeiten = d.tracking_times ?? [];
      if (!zeiten.length) {
        throw new HeroError(
          `Für Projekt ${pm} sind im Zeitraum keine Zeiten erfasst — es gibt nichts zu drucken.`,
        );
      }
      const positions = zeiten.map((t: any) => {
        const stunden = Math.round(((t.duration_in_seconds ?? 0) / 3600) * 100) / 100;
        const tag = String(t.start ?? "").slice(0, 10);
        const wer = t.partner?.full_name ?? "";
        return {
          add_product_position: {
            name: `${tag}${wer ? ` · ${wer}` : ""}`,
            description: t.comment ?? "",
            unit_type: "Std",
            quantity: stunden,
            net_price: 0,
            vat_percent: 19,
          },
        };
      });
      const summe =
        Math.round((zeiten.reduce((s: number, t: any) => s + (t.duration_in_seconds ?? 0), 0) / 3600) * 100) / 100;

      const actions: unknown[] = [
        { set_recipient: await recipientFor(ctx, pm) },
        { add_title: { text: args.title ?? "Stundenzettel", tier: 0 } },
        {
          add_text: {
            text:
              `Erfasste Zeiten${args.date_from ? ` vom ${args.date_from}` : ""}` +
              `${args.date_to ? ` bis ${args.date_to}` : ""} — Summe ${summe} Stunden.`,
          },
        },
        ...positions,
      ];
      const res = await createDocument(ctx, resolveDocumentType(ctx.cfg, "allgemein"), pm, actions, true);
      return { ...res, eintraege: zeiten.length, summe_stunden: summe };
    },
  },

  {
    name: "create_job",
    title: "Auftrag anlegen",
    description:
      "Field-Service-Auftrag (Wartung, Reparatur, Notdienst) anlegen. job_type ist eine " +
      "geschlossene Liste — HERO speichert jeden anderen Wert still als 'unknown', deshalb wird " +
      "hier vorher geprüft. start/end als ISO MIT Offset. Aufträge sind nicht löschbar.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: int("Kontakt-ID des Auftraggebers."),
        title: str("Titel des Auftrags."),
        start: str("Beginn, ISO mit Offset ('2026-08-10T08:00:00+02:00')."),
        end: str("Ende, ISO mit Offset."),
        project_match_id: int("Optional: Projekt, zu dem der Auftrag gehört."),
        job_type: str(`Einer von: ${JOB_TYPES.join(", ")}. Default maintenance.`),
        description: str("Beschreibung / Arbeitsauftrag."),
      },
      required: ["customer_id", "title", "start", "end"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = args.job_type ?? "maintenance";
      if (!JOB_TYPES.includes(type)) {
        throw new HeroError(
          `job_type '${type}' ist ungültig. Erlaubt: ${JOB_TYPES.join(", ")}. ` +
            `HERO würde den Wert still als 'unknown' speichern.`,
        );
      }
      const job: Record<string, unknown> = {
        customer_id: req<number>(args, "customer_id"),
        title: req<string>(args, "title"),
        type,
        description: args.description ?? "",
        start: req<string>(args, "start"),
        end: req<string>(args, "end"),
      };
      if (args.project_match_id) job.project_match_id = args.project_match_id;
      if (ctx.cfg.partnerId) job.partners = [ctx.cfg.partnerId];

      const d = await ctx.hero.gql<any>(
        `mutation ($j: FieldService_JobInput) { create_field_service_job(job: $j) {
           id display_nr title type status_code status_name start end project_match_id } }`,
        { j: job },
      );
      return d.create_field_service_job;
    },
  },

  {
    name: "create_checklist",
    title: "Checkliste anlegen",
    description:
      "Checkliste an einen Auftrag ODER ein Projekt hängen (genau eins von beiden). Die Punkte " +
      "sind die Struktur — abgehakt wird in der Mobile-App, nicht über die API. Eine falsche " +
      "Form leert HERO beim Anlegen still, deshalb wird das Ergebnis zurückgelesen und geprüft.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name der Checkliste."),
        items: {
          type: "array",
          description: "Die Punkte der Checkliste, in Reihenfolge.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Beschriftung des Punkts." },
              type: { type: "string", description: `Einer von: ${CHECKLIST_TYPES.join(", ")}. Default checkbox.` },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Nur bei type 'select': die Auswahlmöglichkeiten.",
              },
              multiple: { type: "boolean", description: "Mehrfachauswahl (select) bzw. mehrere Bilder (image)." },
            },
            required: ["label"],
            additionalProperties: false,
          },
        },
        job_id: int("Auftrags-ID — entweder diese oder project_match_id."),
        project_match_id: int("Projekt-ID — entweder diese oder job_id."),
      },
      required: ["name", "items"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const jobId = args.job_id ?? null;
      const pmId = args.project_match_id ?? null;
      if (Boolean(jobId) === Boolean(pmId)) {
        throw new HeroError("Genau eins angeben: job_id ODER project_match_id.");
      }
      const items = req<any[]>(args, "items");
      if (!Array.isArray(items) || !items.length) throw new HeroError("items darf nicht leer sein.");

      const entries = items.map((it, i) => {
        const type = it.type ?? "checkbox";
        if (!CHECKLIST_TYPES.includes(type)) {
          throw new HeroError(
            `Punkt ${i + 1}: type '${type}' ungültig. Erlaubt: ${CHECKLIST_TYPES.join(", ")}.`,
          );
        }
        if (!it.label) throw new HeroError(`Punkt ${i + 1}: 'label' fehlt.`);
        const e: Record<string, unknown> = { type, label: it.label };
        if (type === "select") {
          e.options = (it.options ?? []).map(String);
          e.multiple = Boolean(it.multiple);
        }
        if (type === "image") e.multiple = Boolean(it.multiple);
        return e;
      });

      const d = await ctx.hero.gql<any>(
        `mutation ($jid: Int, $pm: Int, $c: FieldService_ChecklistInput) {
           create_field_service_checklist(job_id: $jid, project_match_id: $pm, checklist: $c) {
             id name data status created } }`,
        { jid: jobId, pm: pmId, c: { name: req<string>(args, "name"), data: { entries } } },
      );
      const cl = d.create_field_service_checklist;
      const saved = cl?.data?.entries?.length ?? 0;
      if (saved !== entries.length) {
        throw new HeroError(
          `Checkliste angelegt (id ${cl?.id}), aber HERO hat die Punkte verworfen: ` +
            `${saved} von ${entries.length} gespeichert. Die Checkliste ist damit leer und ` +
            `muss in der Web-App befüllt werden.`,
          cl?.data,
        );
      }
      return cl;
    },
  },

  {
    name: "create_article",
    title: "Artikel anlegen",
    description:
      "Artikel in den Stamm aufnehmen. Setzt sales_prices UND default_sales_price — ohne die " +
      "kalkuliert HERO jedes Angebot mit dem EINKAUFSpreis, und Angebote gehen zum " +
      "Selbstkostenpreis raus. Das ist die teuerste Falle der HERO-API und hier eingebaut.",
    inputSchema: {
      type: "object",
      properties: {
        nr: str("Artikelnummer (eindeutig)."),
        name: str("Artikelbezeichnung."),
        unit: str(`Einheit — eine aus: ${UNITS.join(" ")}`),
        purchase_price: num("Einkaufspreis netto."),
        sale_price: num("Verkaufspreis netto — landet korrekt im Angebot."),
        description: str("Beschreibung / Langtext."),
        manufacturer: str("Hersteller."),
        ean: str("EAN."),
      },
      required: ["nr", "name", "unit", "purchase_price", "sale_price"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const name = req<string>(args, "name");
      const vk = req<number>(args, "sale_price");
      const d = await ctx.hero.gql<any>(
        `mutation ($p: Documents_SupplyProductVersionInput!) {
           create_supply_product_version(supply_product_version: $p) {
             product_id nr base_price list_price vat_percent
             base_data { name unit_type } } }`,
        {
          p: {
            nr: req<string>(args, "nr"),
            base_price: req<number>(args, "purchase_price"),
            list_price: vk,
            vat_percent: 19,
            price_quantity: 1,
            default_sales_price: vk,
            sales_prices: [{ net_price_per_unit: vk, label: "VK" }],
            base_data: {
              name,
              description: args.description ?? "",
              ean: args.ean ?? "",
              unit_type: unit(req<string>(args, "unit")),
              manufacturer: args.manufacturer ?? "",
              matchcode: name.toUpperCase().slice(0, 40),
            },
          },
        },
      );
      return d.create_supply_product_version;
    },
  },

  {
    name: "schedule_appointment",
    title: "Termin anlegen",
    description:
      "Termin am Projekt anlegen. start/end als ISO MIT Offset — ohne Offset antwortet HERO " +
      "mit einem Serverfehler. category ist der Name einer Terminkategorie dieses Mandanten.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        title: str("Titel des Termins."),
        start: str("Beginn, ISO mit Offset ('2026-08-10T09:00:00+02:00')."),
        end: str("Ende, ISO mit Offset."),
        category: str("Name der Terminkategorie (siehe Fehlermeldung für die verfügbaren)."),
      },
      required: ["project_match_id", "title", "start", "end"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const cats = ctx.cfg.calendarCategories;
      let categoryId: number | null = null;
      if (args.category) {
        categoryId = cats[norm(String(args.category))] ?? null;
        if (categoryId === null) {
          throw new HeroError(
            `Terminkategorie '${args.category}' unbekannt. Verfügbar: ${Object.keys(cats).join(", ")}`,
          );
        }
      } else {
        categoryId = Object.values(cats)[0] ?? null;
      }
      const event: Record<string, unknown> = {
        project_match_id: req<number>(args, "project_match_id"),
        title: req<string>(args, "title"),
        start: req<string>(args, "start"),
        end: req<string>(args, "end"),
        all_day: false,
      };
      if (categoryId !== null) event.category_id = categoryId;
      if (ctx.cfg.partnerId) event.partner_ids = [ctx.cfg.partnerId];

      const d = await ctx.hero.gql<any>(
        `mutation ($e: CalendarEventInput) { create_calendar_event(calendar_event: $e) {
           id title start end all_day category { id name } } }`,
        { e: event },
      );
      return d.create_calendar_event;
    },
  },

  {
    name: "add_task",
    title: "Aufgabe anlegen",
    description:
      "Aufgabe an ein Projekt hängen. HERO hat kein create_task — update_task ohne id legt an " +
      "(Upsert). due als ISO mit Offset.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        title: str("Titel der Aufgabe."),
        due: str("Fällig am, ISO mit Offset."),
        comment: str("Kommentar / Details. (HERO nennt das Feld comment, nicht description.)"),
      },
      required: ["project_match_id", "title", "due"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `mutation ($t: TaskInput) { update_task(task: $t) {
           id title comment due_date target_project_match_id } }`,
        {
          t: {
            title: req<string>(args, "title"),
            comment: args.comment ?? "",
            due_date: req<string>(args, "due"),
            target_project_match_id: req<number>(args, "project_match_id"),
          },
        },
      );
      return d.update_task;
    },
  },

  {
    name: "log_time",
    title: "Arbeitszeit buchen",
    description:
      "Arbeitszeit auf ein Projekt buchen. Wie bei Aufgaben legt update_ ohne id an. " +
      "start/end als ISO MIT Offset. Die Dauer rechnet HERO selbst (duration_in_seconds).",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        start: str("Beginn, ISO mit Offset."),
        end: str("Ende, ISO mit Offset."),
        comment: str("Was wurde gemacht."),
      },
      required: ["project_match_id", "start", "end"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const t: Record<string, unknown> = {
        project_match_id: req<number>(args, "project_match_id"),
        start: req<string>(args, "start"),
        end: req<string>(args, "end"),
        comment: args.comment ?? "",
      };
      if (ctx.cfg.partnerId) t.partner_id = ctx.cfg.partnerId;
      const d = await ctx.hero.gql<any>(
        `mutation ($t: Employees_TrackingTimeInput) { update_tracking_time(tracking_time: $t) {
           id start end duration_in_seconds comment partner { id full_name } } }`,
        { t },
      );
      return d.update_tracking_time;
    },
  },

  {
    name: "add_logbook_note",
    title: "Logbucheintrag",
    description: "Logbucheintrag / Kommentar am Projekt. Erscheint als 'Kommentar von <Nutzer>'.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        text: str("Der Text des Eintrags."),
      },
      required: ["project_match_id", "text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const d = await ctx.hero.gql<any>(
        `mutation ($l: LogbookEntryInput!) { add_logbook_entry(logbook_entry: $l) {
           id created } }`,
        {
          l: {
            target: "project_match",
            target_id: req<number>(args, "project_match_id"),
            custom_text: req<string>(args, "text"),
          },
        },
      );
      return d.add_logbook_entry;
    },
  },

  {
    name: "record_payment",
    title: "Zahlung erfassen",
    description:
      "Zahlung auf eine Rechnung erfassen und anschließend zurücklesen, damit klar ist, " +
      "ob sie wirklich verbucht wurde. date als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        document_id: int("Dokument-ID der Rechnung."),
        amount: num("Betrag brutto."),
        date: str("Zahlungsdatum 'YYYY-MM-DD'."),
      },
      required: ["document_id", "amount", "date"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const id = req<number>(args, "document_id");
      const amount = req<number>(args, "amount");
      await ctx.hero.gql<any>(
        `mutation ($d: Int!, $p: PaymentInput!) { create_payment(document_id: $d, payment: $p) {
           id nr } }`,
        { d: id, p: { paid_date: req<string>(args, "date"), value: amount } },
      );
      await sleep(1000);
      const d = await ctx.hero.gql<any>(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr value
           customer_document_booking { is_open due_date paid_date balance
             payments { id value paid_date } } } }`,
        { i: [id] },
      );
      const doc = d.customer_documents?.[0];
      const b = doc?.customer_document_booking;
      const bezahlt = (b?.payments ?? []).reduce((s: number, p: any) => s + (p.value ?? 0), 0);
      return {
        document_id: id,
        nr: doc?.nr ?? null,
        erfasst: amount,
        bezahlt_gesamt: bezahlt,
        restbetrag: Math.round(((doc?.value ?? 0) - bezahlt) * 100) / 100,
        ist_offen: b?.is_open ?? null,
        zahlungen: b?.payments ?? [],
      };
    },
  },

  {
    name: "create_lead",
    title: "Lead einliefern",
    description:
      "Externen Lead über die Lead API einliefern. Erzeugt Kunde UND Projekt. " +
      "⚠ Nicht idempotent: der Kunde wird dedupliziert, das Projekt NICHT — zweimal aufrufen " +
      "heißt zwei Projekte, und Projekte sind bei HERO nicht löschbar.",
    inputSchema: {
      type: "object",
      properties: {
        email: str("E-Mail des Interessenten."),
        last_name: str("Nachname. Pflicht — fehlt er, antwortet HERO mit HTTP 500."),
        zip_code: str("PLZ. ⚠ 4-stellig deutet HERO IMMER als Schweiz."),
        measure: str("Maßnahme, z. B. 'PRJ'. Unbekannte Werte landen still auf 'Unbekannt'."),
        first_name: str("Vorname."),
        street: str("Straße und Hausnummer."),
        city: str("Ort."),
        comment: str("Freitext zum Anliegen."),
      },
      required: ["email", "last_name", "zip_code"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const body: Record<string, unknown> = {
        measure: args.measure ?? "PRJ",
        customer: {
          email: req<string>(args, "email"),
          last_name: req<string>(args, "last_name"),
          first_name: args.first_name ?? "",
        },
        address: {
          zipcode: req<string>(args, "zip_code"),
          street: args.street ?? "",
          city: args.city ?? "",
        },
        project_match: { comment: args.comment ?? "" },
      };
      const res = await ctx.hero.lead(body);
      if (res?.status && res.status !== "success") {
        throw new HeroError(`Lead abgelehnt: ${JSON.stringify(res).slice(0, 400)}`);
      }
      return {
        ...res,
        hinweis:
          "Die Lead API liefert die project_id, nicht die project_match_id. " +
          "Für project_match-Tools erst über search oder get_project auflösen.",
      };
    },
  },

  {
    name: "upload_file",
    title: "Datei hochladen",
    description:
      "Datei nach HERO hochladen und optional an ein Projekt hängen. Inhalt entweder als url " +
      "(wird geladen) oder als content_base64. Liefert die file_upload_uuid, die alle " +
      "Datei-Konsumenten von HERO brauchen. ⚠ HERO kennt nur einen Upload-Weg (die Lead API), " +
      "der dabei zwangsläufig ein Eingangs-Projekt anlegt; dieses Projekt ist nicht löschbar.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung, z. B. 'aufmass.pdf'."),
        url: str("Öffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url."),
        project_match_id: int("Optional: Projekt, an das die Datei gehängt wird."),
      },
      required: ["filename"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const { blob, filename } = await loadFile(args);
      const uuid = await leadUpload(ctx, blob, filename, "documents[]");
      if (args.project_match_id) {
        await ctx.hero.gql<any>(
          `mutation ($u: String!, $t: Int!) {
             upload_image(file_upload_uuid: $u, target: project_match, target_id: $t) {
               id uuid filename url } }`,
          { u: uuid, t: args.project_match_id },
        );
      }
      return {
        file_upload_uuid: uuid,
        filename,
        angehaengt_an_projekt: args.project_match_id ?? null,
        hinweis: "Der Upload hat systembedingt ein Eingangs-Projekt in HERO erzeugt.",
      };
    },
  },

  {
    name: "attach_pdf",
    title: "Fremd-PDF anhängen",
    description:
      "Ein fremdes PDF als eigenständiges Dokument an ein Projekt hängen (nicht über den " +
      "Document-Builder erzeugt, sondern hochgeladen). Inhalt als url oder content_base64.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive .pdf."),
        project_match_id: int("Die Projekt-ID."),
        url: str("Öffentlich erreichbare URL des PDFs. Alternative zu content_base64."),
        content_base64: str("PDF-Inhalt base64-kodiert. Alternative zu url."),
        doc_type: str("Dokumenttyp, Default 'allgemein'."),
      },
      required: ["filename", "project_match_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const pm = req<number>(args, "project_match_id");
      const typeId = resolveDocumentType(ctx.cfg, args.doc_type ?? "allgemein");
      const { blob, filename } = await loadFile(args);
      const uuid = await leadUpload(ctx, blob, filename, "documents[]");

      const d = await ctx.hero.gql<any>(
        `mutation ($doc: CustomerDocumentInput!, $u: String!, $t: LinkTargetEnum!, $id: Int!) {
           upload_document(document: $doc, file_upload_uuid: $u, target: $t, target_id: $id) {
             id nr type status_name file_upload { uuid filename } } }`,
        {
          doc: { document_type_id: typeId, project_match_id: pm, use_next_number: true },
          u: uuid,
          t: "project_match",
          id: pm,
        },
      );
      return { ...d.upload_document, file_upload_uuid: uuid };
    },
  },
];

/** Datei aus url oder base64 holen. Beides zusammen ist ein Fehler, keins auch. */
async function loadFile(args: Record<string, any>): Promise<{ blob: Blob; filename: string }> {
  const filename = req<string>(args, "filename");
  const hasUrl = Boolean(args.url);
  const hasB64 = Boolean(args.content_base64);
  if (hasUrl === hasB64) {
    throw new HeroError("Genau eins angeben: url ODER content_base64.");
  }
  if (hasUrl) {
    const res = await fetch(String(args.url));
    if (!res.ok) throw new HeroError(`Datei nicht ladbar: HTTP ${res.status} von ${args.url}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 20_000_000) throw new HeroError("Datei größer als 20 MB.");
    return { blob: new Blob([buf]), filename };
  }
  const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
  let bin: string;
  try {
    bin = atob(raw);
  } catch {
    throw new HeroError("content_base64 ist kein gültiges Base64.");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.byteLength > 20_000_000) throw new HeroError("Datei größer als 20 MB.");
  return { blob: new Blob([bytes]), filename };
}

/**
 * Der einzige Erzeuger einer file_upload_uuid ist die Lead API als multipart.
 * Sie legt dabei zwangsläufig ein Projekt an — deshalb geht alles an einen festen
 * Eingangs-Kontakt, damit nicht bei jedem Upload ein neuer Kunde entsteht.
 */
async function leadUpload(
  ctx: ToolContext,
  blob: Blob,
  filename: string,
  field: string,
): Promise<string> {
  const form = new FormData();
  form.set("measure", "PRJ");
  form.set("customer[email]", "upload-inbox@example.com");
  form.set("customer[last_name]", "Upload-Eingang");
  form.set("address[zipcode]", "20095");
  form.set("project_match[comment]", `Datei-Upload: ${filename}`);
  form.set(field, blob, filename);

  const res = await ctx.hero.leadMultipart(form);
  if (res?.status !== "success") {
    throw new HeroError(`Upload fehlgeschlagen: ${JSON.stringify(res).slice(0, 300)}`);
  }
  await sleep(2000);

  const d = await ctx.hero.gql<any>(
    `query { contacts(search: "upload-inbox@example.com", first: 1) {
       project_matches { project_id file_uploads(first: 50) { uuid filename created } } } }`,
  );
  const uploads = (d.contacts?.[0]?.project_matches ?? []).flatMap(
    (pm: any) => pm.file_uploads ?? [],
  );
  if (!uploads.length) throw new HeroError("Upload gemeldet, aber keine Datei auffindbar.");
  uploads.sort((a: any, b: any) => String(b.created).localeCompare(String(a.created)));
  return uploads[0].uuid;
}
