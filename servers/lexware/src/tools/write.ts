/**
 * Schreibende Tools. Alle nicht-destruktiv: sie legen an, sie ändern und löschen nichts.
 *
 * Dieselbe Linie wie beim HERO-Server: kein PUT, kein DELETE. Lexware bietet beides an
 * (Kontakte, Artikel, Belege ändern; Artikel löschen), aber Änderungen laufen über
 * optimistisches Sperren mit einem `version`-Feld — wer es falsch mitschickt, überschreibt
 * fremde Änderungen. Das ist nichts, was ein Sprachmodell nebenbei richtig machen sollte.
 *
 * Fallen, die hier eingebaut sind:
 *  - Ein Kontakt braucht mindestens eine Rolle (customer oder vendor), sonst 400.
 *  - Firma braucht company.name, Person braucht person.lastName.
 *  - `finalize=true` macht den Beleg verbindlich und vergibt eine Belegnummer; ohne bleibt
 *    er Entwurf und hat kein PDF.
 *  - Eine Mahnung braucht zwingend die Rechnung als precedingSalesVoucherId.
 *  - Buchungsbelege brauchen eine categoryId aus /v1/posting-categories.
 */
import { LexwareError } from "../client";
import { type LexTool, str, int, num, bool, req } from "../context";
import { docPath } from "./read";

const TAX_TYPES = ["net", "gross", "vatfree"];
const LINE_TYPES = ["custom", "material", "service", "text"];

/** Belegarten, die dieser Server anlegen kann. */
const CREATABLE: Record<string, string> = {
  invoice: "invoices",
  quotation: "quotations",
  orderconfirmation: "order-confirmations",
  creditnote: "credit-notes",
  deliverynote: "delivery-notes",
};

const LINE_ITEMS_SCHEMA = {
  type: "array",
  description: "Die Positionen des Belegs, in Reihenfolge.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Bezeichnung der Position." },
      quantity: { type: "number", description: "Menge." },
      unit_name: { type: "string", description: "Einheit, z. B. 'Stück' oder 'Stunde'." },
      net_price: { type: "number", description: "Netto-Einzelpreis." },
      tax_rate: { type: "number", description: "Steuersatz in Prozent, z. B. 19. Default 19." },
      description: { type: "string", description: "Optionaler Langtext." },
      type: { type: "string", description: `Positionsart: ${LINE_TYPES.join(", ")}. Default custom.` },
    },
    required: ["name", "quantity", "unit_name", "net_price"],
    additionalProperties: false,
  },
};

function buildLineItems(items: any[]): unknown[] {
  if (!Array.isArray(items) || !items.length) {
    throw new LexwareError("line_items darf nicht leer sein.");
  }
  return items.map((li, i) => {
    const at = (msg: string) => new LexwareError(`Position ${i + 1}: ${msg}`);
    if (!li?.name) throw at("'name' fehlt.");
    const type = li.type ?? "custom";
    if (!LINE_TYPES.includes(type)) throw at(`type '${type}' ungültig. Erlaubt: ${LINE_TYPES.join(", ")}`);
    if (type === "text") return { type: "text", name: li.name, description: li.description ?? "" };
    if (typeof li.quantity !== "number") throw at("'quantity' muss eine Zahl sein.");
    if (typeof li.net_price !== "number") throw at("'net_price' muss eine Zahl sein.");
    if (!li.unit_name) throw at("'unit_name' fehlt.");
    return {
      type,
      name: li.name,
      description: li.description ?? "",
      quantity: li.quantity,
      unitName: li.unit_name,
      unitPrice: {
        currency: "EUR",
        netAmount: li.net_price,
        taxRatePercentage: li.tax_rate ?? 19,
      },
    };
  });
}

function taxType(value: unknown): string {
  const t = String(value ?? "net").toLowerCase();
  if (!TAX_TYPES.includes(t)) {
    throw new LexwareError(`tax_type '${t}' ungültig. Erlaubt: ${TAX_TYPES.join(", ")}`);
  }
  return t;
}

function isoDate(value: unknown, name: string, fallbackToday = false): string {
  if (!value) {
    if (fallbackToday) return new Date().toISOString().slice(0, 10);
    throw new LexwareError(`${name} fehlt.`);
  }
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new LexwareError(`${name} muss 'YYYY-MM-DD' sein.`);
  return s;
}

export const writeTools: LexTool[] = [
  {
    name: "create_contact",
    title: "Kontakt anlegen",
    description:
      "Kontakt anlegen — entweder als Firma (company_name) oder als Person (last_name). " +
      "Mindestens eine Rolle ist Pflicht: Kunde und/oder Lieferant. Lexware dedupliziert " +
      "NICHT: derselbe Aufruf zweimal erzeugt zwei Kontakte.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: str("Firmenname. Entweder dieser oder last_name ist Pflicht."),
        first_name: str("Vorname (bei Personen)."),
        last_name: str("Nachname. Pflicht, wenn kein Firmenname gesetzt ist."),
        salutation: str("Anrede, z. B. 'Herr' oder 'Frau'."),
        email: str("Geschäftliche E-Mail."),
        phone: str("Geschäftliche Telefonnummer."),
        street: str("Straße und Hausnummer."),
        zip: str("PLZ."),
        city: str("Ort."),
        country_code: str("Ländercode nach ISO-3166-1 alpha-2, Default DE."),
        is_customer: bool("Als Kunde anlegen. Default true."),
        is_vendor: bool("Als Lieferant anlegen. Default false."),
        note: str("Notiz zum Kontakt."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const isVendor = args.is_vendor === true;
      const isCustomer = args.is_customer !== false || !isVendor;
      if (!args.company_name && !args.last_name) {
        throw new LexwareError(
          "Entweder company_name (Firma) oder last_name (Person) angeben — Lexware lehnt " +
            "einen Kontakt ohne beides ab.",
        );
      }

      const roles: Record<string, unknown> = {};
      if (isCustomer) roles.customer = {};
      if (isVendor) roles.vendor = {};

      const body: Record<string, unknown> = { version: 0, roles };
      if (args.company_name) {
        body.company = {
          name: args.company_name,
          ...(args.last_name
            ? {
                contactPersons: [
                  {
                    salutation: args.salutation ?? "",
                    firstName: args.first_name ?? "",
                    lastName: args.last_name,
                    primary: true,
                    emailAddress: args.email ?? "",
                    phoneNumber: args.phone ?? "",
                  },
                ],
              }
            : {}),
        };
      } else {
        body.person = {
          salutation: args.salutation ?? "",
          firstName: args.first_name ?? "",
          lastName: args.last_name,
        };
      }
      if (args.street || args.zip || args.city) {
        body.addresses = {
          billing: [
            {
              street: args.street ?? "",
              zip: args.zip ?? "",
              city: args.city ?? "",
              countryCode: args.country_code ?? "DE",
            },
          ],
        };
      }
      if (args.email) body.emailAddresses = { business: [args.email] };
      if (args.phone) body.phoneNumbers = { business: [args.phone] };
      if (args.note) body.note = args.note;

      const created = await ctx.lex.json<any>("/v1/contacts", { method: "POST", body });
      // Die Antwort ist schlank (id, resourceUri, version) — einmal frisch lesen,
      // damit im Gespräch steht, was wirklich gespeichert wurde.
      const full = await ctx.lex.json<any>(`/v1/contacts/${created.id}`);
      return {
        id: created.id,
        version: full.version,
        name: full.company?.name ?? [full.person?.firstName, full.person?.lastName].filter(Boolean).join(" "),
        nummer: full.roles?.customer?.number ?? full.roles?.vendor?.number ?? null,
        rollen: Object.keys(full.roles ?? {}),
      };
    },
  },

  {
    name: "create_article",
    title: "Artikel anlegen",
    description:
      "Artikel oder Leistung in den Stamm aufnehmen. leading_price bestimmt, ob der Netto- " +
      "oder der Bruttopreis führend ist; den jeweils anderen rechnet Lexware aus.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("Bezeichnung."),
        type: str("PRODUCT (Ware) oder SERVICE (Leistung). Default SERVICE."),
        unit_name: str("Einheit, z. B. 'Stück' oder 'Stunde'."),
        net_price: num("Nettopreis."),
        tax_rate: num("Steuersatz in Prozent, Default 19."),
        description: str("Beschreibung."),
        article_number: str("Eigene Artikelnummer."),
      },
      required: ["title", "unit_name", "net_price"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = String(args.type ?? "SERVICE").toUpperCase();
      if (!["PRODUCT", "SERVICE"].includes(type)) {
        throw new LexwareError("type muss PRODUCT oder SERVICE sein.");
      }
      const net = req<number>(args, "net_price");
      const rate = args.tax_rate ?? 19;
      const body: Record<string, unknown> = {
        title: req<string>(args, "title"),
        type,
        unitName: req<string>(args, "unit_name"),
        price: {
          netPrice: net,
          grossPrice: Math.round(net * (1 + rate / 100) * 100) / 100,
          leadingPrice: "NET",
          taxRate: rate,
        },
      };
      if (args.description) body.description = args.description;
      if (args.article_number) body.articleNumber = args.article_number;

      const created = await ctx.lex.json<any>("/v1/articles", { method: "POST", body });
      return { id: created.id, version: created.version, ...body };
    },
  },

  {
    name: "create_document",
    title: "Beleg anlegen",
    description:
      "Rechnung, Angebot, Auftragsbestätigung, Gutschrift oder Lieferschein anlegen. " +
      "⚠ finalize=true macht den Beleg verbindlich, vergibt die Belegnummer und erzeugt das " +
      "PDF — das lässt sich nicht zurücknehmen. Ohne finalize entsteht ein Entwurf, den man " +
      "in Lexware Office noch bearbeiten kann; ein Entwurf hat aber kein PDF.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart — eine aus: ${Object.keys(CREATABLE).join(", ")}`),
        contact_id: str("Kontakt-UUID des Empfängers aus search_contacts."),
        line_items: LINE_ITEMS_SCHEMA,
        voucher_date: str("Belegdatum 'YYYY-MM-DD'. Default heute."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        finalize: bool("true = verbindlich finalisieren. Default false (Entwurf)."),
        title: str("Titel des Belegs, z. B. 'Rechnung'."),
        intro: str("Einleitungstext."),
        remark: str("Schlussbemerkung."),
        payment_term_days: int("Zahlungsziel in Tagen (nur bei Rechnungen sinnvoll)."),
      },
      required: ["doc_type", "contact_id", "line_items"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = String(req<string>(args, "doc_type")).toLowerCase();
      const path = CREATABLE[type];
      if (!path) {
        throw new LexwareError(
          `doc_type '${type}' kann dieser Server nicht anlegen. Möglich: ${Object.keys(CREATABLE).join(", ")}. ` +
            `Mahnungen laufen über create_dunning.`,
        );
      }
      const body: Record<string, unknown> = {
        voucherDate: isoDate(args.voucher_date, "voucher_date", true),
        address: { contactId: req<string>(args, "contact_id") },
        lineItems: buildLineItems(req<any[]>(args, "line_items")),
        totalPrice: { currency: "EUR" },
        taxConditions: { taxType: taxType(args.tax_type) },
      };
      if (args.title) body.title = args.title;
      if (args.intro) body.introduction = args.intro;
      if (args.remark) body.remark = args.remark;
      if (args.payment_term_days) {
        body.paymentConditions = { paymentTermLabel: `Zahlbar innerhalb ${args.payment_term_days} Tagen`, paymentTermDuration: args.payment_term_days };
      }

      const finalize = args.finalize === true;
      const created = await ctx.lex.json<any>(`/v1/${path}`, {
        method: "POST",
        query: { finalize },
        body,
      });

      // Die Anlage-Antwort ist schlank; einmal frisch lesen zeigt Nummer und Summen.
      const full = await ctx.lex.json<any>(`/v1/${docPath(type)}/${created.id}`).catch(() => null);
      return {
        id: created.id,
        doc_type: type,
        finalisiert: finalize,
        nr: full?.voucherNumber ?? null,
        status: full?.voucherStatus ?? null,
        summe_netto: full?.totalPrice?.totalNetAmount ?? null,
        summe_brutto: full?.totalPrice?.totalGrossAmount ?? null,
        hinweis: finalize
          ? "PDF über download_document abrufbar."
          : "Entwurf — noch keine Belegnummer und kein PDF. Zum Finalisieren in Lexware Office öffnen oder erneut mit finalize=true anlegen.",
      };
    },
  },

  {
    name: "create_dunning",
    title: "Mahnung anlegen",
    description:
      "Mahnung zu einer bestehenden Rechnung anlegen. Die Rechnung ist Pflicht — eine Mahnung " +
      "ohne Bezugsrechnung lehnt Lexware ab. Hinweis: Lexware meldet für Mahnungen auch bei " +
      "finalize=true den Status 'draft' zurück, erzeugt das PDF aber trotzdem sofort.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: str("UUID der zu mahnenden Rechnung."),
        contact_id: str("Kontakt-UUID des Empfängers."),
        line_items: LINE_ITEMS_SCHEMA,
        voucher_date: str("Belegdatum 'YYYY-MM-DD'. Default heute."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        finalize: bool("true = finalisieren. Default true."),
        title: str("Titel, z. B. 'Zahlungserinnerung'."),
        intro: str("Einleitungstext."),
      },
      required: ["invoice_id", "contact_id", "line_items"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const body: Record<string, unknown> = {
        voucherDate: isoDate(args.voucher_date, "voucher_date", true),
        address: { contactId: req<string>(args, "contact_id") },
        lineItems: buildLineItems(req<any[]>(args, "line_items")),
        totalPrice: { currency: "EUR" },
        taxConditions: { taxType: taxType(args.tax_type) },
      };
      if (args.title) body.title = args.title;
      if (args.intro) body.introduction = args.intro;

      const created = await ctx.lex.json<any>("/v1/dunnings", {
        method: "POST",
        query: {
          precedingSalesVoucherId: req<string>(args, "invoice_id"),
          finalize: args.finalize !== false,
        },
        body,
      });
      return {
        id: created.id,
        hinweis:
          "Lexware kennt keine Liste für Mahnungen. Die id hier aufheben — sie ist sonst nur " +
          "über die relatedVouchers der Rechnung wiederzufinden. PDF über download_document " +
          "mit doc_type=dunning.",
      };
    },
  },

  {
    name: "create_voucher",
    title: "Buchungsbeleg anlegen",
    description:
      "Buchungsbeleg (z. B. Eingangsrechnung) für die Buchhaltung anlegen. Jede Position " +
      "braucht eine categoryId aus reference_data(kind='posting-categories') — ohne die " +
      "lehnt Lexware ab.",
    inputSchema: {
      type: "object",
      properties: {
        type: str("Belegart, z. B. purchaseinvoice (Eingangsrechnung) oder salesinvoice."),
        voucher_date: str("Belegdatum 'YYYY-MM-DD'."),
        total_gross: num("Bruttosumme."),
        total_tax: num("Steuersumme."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        items: {
          type: "array",
          description: "Belegpositionen.",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Nettobetrag der Position." },
              tax_amount: { type: "number", description: "Steuerbetrag der Position." },
              tax_rate: { type: "number", description: "Steuersatz in Prozent." },
              category_id: { type: "string", description: "UUID aus posting-categories." },
            },
            required: ["amount", "tax_amount", "tax_rate", "category_id"],
            additionalProperties: false,
          },
        },
        voucher_number: str("Belegnummer des Lieferanten."),
        contact_id: str("Kontakt-UUID des Lieferanten."),
      },
      required: ["type", "voucher_date", "total_gross", "total_tax", "items"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const items = req<any[]>(args, "items");
      if (!Array.isArray(items) || !items.length) throw new LexwareError("items darf nicht leer sein.");
      const body: Record<string, unknown> = {
        type: req<string>(args, "type"),
        voucherDate: isoDate(args.voucher_date, "voucher_date"),
        totalGrossAmount: req<number>(args, "total_gross"),
        totalTaxAmount: req<number>(args, "total_tax"),
        taxType: taxType(args.tax_type),
        voucherItems: items.map((it, i) => {
          if (!it?.category_id) {
            throw new LexwareError(
              `Position ${i + 1}: category_id fehlt. Gültige Werte liefert ` +
                `reference_data(kind='posting-categories').`,
            );
          }
          return {
            amount: it.amount,
            taxAmount: it.tax_amount,
            taxRatePercent: it.tax_rate,
            categoryId: it.category_id,
          };
        }),
      };
      if (args.voucher_number) body.voucherNumber = args.voucher_number;
      if (args.contact_id) body.contactId = args.contact_id;

      const created = await ctx.lex.json<any>("/v1/vouchers", { method: "POST", body });
      return { id: created.id, version: created.version, typ: body.type };
    },
  },

  {
    name: "upload_file",
    title: "Datei hochladen",
    description:
      "Datei nach Lexware hochladen (z. B. einen Beleg als PDF oder Foto) und optional " +
      "direkt an einen Buchungsbeleg hängen. Inhalt entweder als url (wird geladen) oder " +
      "als content_base64.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung."),
        url: str("Öffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url."),
        voucher_id: str("Optional: Buchungsbeleg, an den die Datei gehängt wird."),
      },
      required: ["filename"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const filename = req<string>(args, "filename");
      const hasUrl = Boolean(args.url);
      const hasB64 = Boolean(args.content_base64);
      if (hasUrl === hasB64) throw new LexwareError("Genau eins angeben: url ODER content_base64.");

      let bytes: Uint8Array;
      if (hasUrl) {
        const res = await fetch(String(args.url));
        if (!res.ok) throw new LexwareError(`Datei nicht ladbar: HTTP ${res.status} von ${args.url}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
        let bin: string;
        try {
          bin = atob(raw);
        } catch {
          throw new LexwareError("content_base64 ist kein gültiges Base64.");
        }
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (bytes.byteLength > 20_000_000) throw new LexwareError("Datei größer als 20 MB.");

      const form = new FormData();
      form.set("file", new Blob([bytes]), filename);
      // type ist ein Formularfeld, kein Query-Parameter — als Query wird es ignoriert.
      form.set("type", "voucher");

      const target = args.voucher_id
        ? `/v1/vouchers/${encodeURIComponent(String(args.voucher_id))}/files`
        : "/v1/files";
      const created = await ctx.lex.json<any>(target, { method: "POST", form });

      return {
        file_id: created?.id ?? null,
        filename,
        bytes: bytes.byteLength,
        angehaengt_an_beleg: args.voucher_id ?? null,
      };
    },
  },
];
