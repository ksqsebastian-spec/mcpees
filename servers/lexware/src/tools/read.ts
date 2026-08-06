/**
 * Lesende Tools. Alle mit readOnlyHint — sie können nichts verändern.
 *
 * Die fachlichen Feinheiten stammen aus dem kuratierten API-Katalog von
 * github.com/JannikWempe/mcp-lexware-office (MIT) und der offiziellen Doku:
 *
 *  - Rechnungen listet man NICHT über /v1/invoices, sondern über /v1/voucherlist.
 *  - voucherStatus ist je voucherType eine andere geschlossene Liste. Ein falscher Wert
 *    liefert keine Fehlermeldung, sondern eine leere Liste — also eine falsche Antwort.
 *  - Offene Rechnungen nach Fälligkeit kommen mit dem transienten Status `overdue` zurück,
 *    auch wenn man auf `open` filtert. Beim Aggregieren zählen sie als offen.
 *  - Voucherlist-Zeilen haben keine Netto-Beträge; für Netto/USt. braucht es die Detailsicht.
 */
import { LexwareError } from "../client";
import { createFileLink } from "../files";
import { type LexTool, type ToolContext, str, int, bool, req } from "../context";

/** voucherType -> erlaubte Statuswerte. Falscher Status = stille Leerliste, deshalb geprüft. */
const VOUCHER_STATUS: Record<string, string[]> = {
  invoice: ["draft", "open", "paid", "voided"],
  downpaymentinvoice: ["draft", "open", "paid", "voided"],
  quotation: ["draft", "open", "accepted", "rejected"],
  orderconfirmation: ["draft", "open"],
  creditnote: ["draft", "open", "paidoff", "voided"],
  deliverynote: ["draft", "open"],
  dunning: ["draft", "open"],
  invoicecorrection: ["draft", "open", "paidoff", "voided"],
};

/** Für Umsatz zählen bewusst weder Entwürfe noch Stornos. */
const DEFAULT_STATUS: Record<string, string[]> = {
  invoice: ["open", "paid"],
  downpaymentinvoice: ["open", "paid"],
  quotation: ["draft", "open", "accepted", "rejected"],
  orderconfirmation: ["open"],
  creditnote: ["open", "paidoff"],
  deliverynote: ["open"],
  dunning: ["open"],
};

export const VOUCHER_TYPES = Object.keys(VOUCHER_STATUS);

/** Belegarten mit eigener Detail- und Datei-Route. */
const DOC_PATHS: Record<string, string> = {
  invoice: "invoices",
  quotation: "quotations",
  orderconfirmation: "order-confirmations",
  creditnote: "credit-notes",
  deliverynote: "delivery-notes",
  dunning: "dunnings",
  downpaymentinvoice: "down-payment-invoices",
};

function checkStatus(voucherType: string, status: string | undefined): string {
  const allowed = VOUCHER_STATUS[voucherType];
  if (!allowed) {
    throw new LexwareError(
      `voucherType '${voucherType}' unbekannt. Erlaubt: ${VOUCHER_TYPES.join(", ")}`,
    );
  }
  if (!status) return (DEFAULT_STATUS[voucherType] ?? allowed).join(",");
  const wanted = String(status)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const w of wanted) {
    if (!allowed.includes(w)) {
      throw new LexwareError(
        `voucherStatus '${w}' gibt es für ${voucherType} nicht. Erlaubt: ${allowed.join(", ")}. ` +
          `Lexware meldet einen falschen Status nicht, es kommt einfach eine leere Liste zurück.`,
      );
    }
  }
  return wanted.join(",");
}

function docPath(docType: string): string {
  const p = DOC_PATHS[String(docType).toLowerCase()];
  if (!p) {
    throw new LexwareError(
      `doc_type '${docType}' unbekannt. Erlaubt: ${Object.keys(DOC_PATHS).join(", ")}`,
    );
  }
  return p;
}

const money = (n: unknown) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);
const sum = (rows: any[], field: string) =>
  Math.round(rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) * 100) / 100;

/** Eine Voucherlist-Zeile in etwas verwandeln, das man lesen kann. */
function row(v: any) {
  return {
    id: v.id,
    typ: v.voucherType,
    nr: v.voucherNumber ?? null,
    status: v.voucherStatus,
    datum: v.voucherDate ?? null,
    faellig_am: v.dueDate ?? null,
    kunde: v.contactName ?? null,
    contactId: v.contactId ?? null,
    betrag_brutto: money(v.totalAmount),
    offen: money(v.openAmount),
    waehrung: v.currency ?? null,
    archiviert: v.archived ?? null,
  };
}

/** Datum auf YYYY-MM-DD prüfen — Lexware quittiert Unsinn sonst mit 400. */
function date(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new LexwareError(`${name} muss 'YYYY-MM-DD' sein.`);
  return s;
}

export const readTools: LexTool[] = [
  {
    name: "profile",
    title: "Firmenprofil",
    description:
      "Firmenprofil des verbundenen Lexware-Office-Accounts: Firmenname, Steuernummern, " +
      "Kleinunternehmer-Status, angemeldeter Nutzer. Guter erster Aufruf, um zu sehen, " +
      "mit welchem Mandanten man spricht.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      return ctx.lex.json("/v1/profile");
    },
  },

  {
    name: "search_contacts",
    title: "Kontakte suchen",
    description:
      "Kontakte suchen oder auflisten. Filter lassen sich kombinieren; ohne Filter kommen " +
      "die ersten Kontakte. customer/vendor grenzen auf Kunden bzw. Lieferanten ein.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name oder Firmenname, auch Teilstring."),
        email: str("E-Mail-Adresse."),
        number: int("Kunden- oder Lieferantennummer."),
        customer: bool("Nur Kunden."),
        vendor: bool("Nur Lieferanten."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = Math.min(500, Math.max(1, Number(args.limit) || 50));
      const res = await ctx.lex.paginate<any>(
        "/v1/contacts",
        {
          name: args.name,
          email: args.email,
          number: args.number,
          customer: args.customer,
          vendor: args.vendor,
        },
        limit,
      );
      return {
        anzahl: res.items.length,
        gesamt: res.total,
        abgeschnitten: res.truncated,
        kontakte: res.items.map((c) => ({
          id: c.id,
          nummer: c.roles?.customer?.number ?? c.roles?.vendor?.number ?? null,
          name: c.company?.name ?? [c.person?.firstName, c.person?.lastName].filter(Boolean).join(" "),
          typ: c.company ? "Firma" : "Person",
          rollen: Object.keys(c.roles ?? {}),
          email: c.emailAddresses?.business?.[0] ?? c.emailAddresses?.private?.[0] ?? null,
          telefon: c.phoneNumbers?.business?.[0] ?? c.phoneNumbers?.mobile?.[0] ?? null,
          version: c.version,
        })),
      };
    },
  },

  {
    name: "get_contact",
    title: "Kontakt im Detail",
    description:
      "Ein Kontakt mit allen Adressen, Rollen und Bankdaten. Das Feld version braucht man, " +
      "falls der Kontakt später geändert werden soll (Lexware sperrt optimistisch).",
    inputSchema: {
      type: "object",
      properties: { contact_id: str("Die Kontakt-UUID aus search_contacts.") },
      required: ["contact_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      return ctx.lex.json(`/v1/contacts/${encodeURIComponent(req<string>(args, "contact_id"))}`);
    },
  },

  {
    name: "list_vouchers",
    title: "Belege auflisten",
    description:
      "Der Arbeitspferd-Aufruf für alles Kaufmännische: listet Rechnungen, Angebote, " +
      "Auftragsbestätigungen, Gutschriften, Lieferscheine und Mahnungen als Übersichtszeilen. " +
      "Rechnungen haben KEINE eigene Listen-Route — sie laufen über diesen Aufruf. " +
      "Ohne voucher_status wird ein sinnvoller Default gewählt (bei Rechnungen open,paid — " +
      "Entwürfe und Stornos zählen nicht als Umsatz).",
    inputSchema: {
      type: "object",
      properties: {
        voucher_type: str(`Belegart — eine aus: ${VOUCHER_TYPES.join(", ")}`),
        voucher_status: str(
          "Komma-Liste von Statuswerten. Erlaubte Werte hängen von der Belegart ab; " +
            "ein ungültiger Wert wird abgelehnt statt still ignoriert.",
        ),
        date_from: str("Belegdatum ab 'YYYY-MM-DD'."),
        date_to: str("Belegdatum bis 'YYYY-MM-DD'."),
        contact_id: str("Nur Belege zu diesem Kontakt."),
        voucher_number: str("Nach Belegnummer suchen."),
        archived: bool("true = nur archivierte, false = nur nicht archivierte."),
        limit: int("Maximale Trefferzahl (1–500, Default 100). Bei 2 Requests/Sekunde kosten große Werte Zeit."),
      },
      required: ["voucher_type"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const type = String(req<string>(args, "voucher_type")).toLowerCase();
      const status = checkStatus(type, args.voucher_status);
      const limit = Math.min(500, Math.max(1, Number(args.limit) || 100));

      const res = await ctx.lex.paginate<any>(
        "/v1/voucherlist",
        {
          voucherType: type,
          voucherStatus: status,
          voucherDateFrom: date(args.date_from, "date_from"),
          voucherDateTo: date(args.date_to, "date_to"),
          contactId: args.contact_id,
          voucherNumber: args.voucher_number,
          archived: args.archived,
          sort: "voucherDate,DESC",
        },
        limit,
      );

      return {
        voucher_type: type,
        voucher_status: status,
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...(res.truncated
          ? { hinweis: `Es gibt mehr Treffer als ${limit}. Zeitraum eingrenzen oder limit erhöhen.` }
          : {}),
        summe_brutto: sum(res.items, "totalAmount"),
        summe_offen: sum(res.items, "openAmount"),
        belege: res.items.map(row),
      };
    },
  },

  {
    name: "get_document",
    title: "Beleg im Detail",
    description:
      "Ein Beleg mit allen Positionen, Steuerangaben und Beträgen. Nur hier stehen " +
      "Netto-Beträge — die Übersichtszeilen aus list_vouchers haben nur Bruttowerte.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart — eine aus: ${Object.keys(DOC_PATHS).join(", ")}`),
        document_id: str("Die Beleg-UUID aus list_vouchers."),
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const p = docPath(req<string>(args, "doc_type"));
      return ctx.lex.json(`/v1/${p}/${encodeURIComponent(req<string>(args, "document_id"))}`);
    },
  },

  {
    name: "download_document",
    title: "Beleg als PDF",
    description:
      "Erzeugt einen zeitlich begrenzten Download-Link auf das PDF eines Belegs. " +
      "Lexware selbst kennt keine öffentlichen Links, deshalb liefert dieser Server die Datei " +
      "über einen eigenen, nicht erratbaren Link aus. Funktioniert nur bei finalisierten " +
      "Belegen — Entwürfe haben kein PDF.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart — eine aus: ${Object.keys(DOC_PATHS).join(", ")}`),
        document_id: str("Die Beleg-UUID."),
        minutes: int("Gültigkeit des Links in Minuten (1–1440, Default 30)."),
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const type = String(req<string>(args, "doc_type")).toLowerCase();
      const p = docPath(type);
      const id = req<string>(args, "document_id");

      const file = await ctx.lex.json<any>(`/v1/${p}/${encodeURIComponent(id)}/file`);
      const fileId = file?.documentFileId ?? file?.id;
      if (!fileId) {
        throw new LexwareError(
          `Für diesen Beleg gibt es kein PDF. Entwürfe werden erst beim Finalisieren gerendert.`,
          file,
        );
      }
      const link = await createFileLink(
        ctx.kv,
        ctx.credential,
        { id: fileId, filename: `${type}-${id}.pdf`, contentType: "application/pdf" },
        Number(args.minutes) || 30,
      );
      return {
        url: `${ctx.origin}/f/${link.token}`,
        gueltig_bis_minuten: link.expiresInMinutes,
        hinweis: "Der Link ist ein Geheimnis — wer ihn hat, sieht das PDF.",
      };
    },
  },

  {
    name: "list_articles",
    title: "Artikel",
    description: "Artikel- und Leistungsstamm mit Preisen und Einheiten.",
    inputSchema: {
      type: "object",
      properties: { limit: int("Maximale Trefferzahl (1–500, Default 50).") },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const res = await ctx.lex.paginate<any>(
        "/v1/articles",
        {},
        Math.min(500, Math.max(1, Number(args.limit) || 50)),
      );
      return {
        anzahl: res.items.length,
        gesamt: res.total,
        abgeschnitten: res.truncated,
        artikel: res.items.map((a) => ({
          id: a.id,
          nummer: a.articleNumber ?? null,
          titel: a.title,
          typ: a.type,
          einheit: a.unitName,
          netto: money(a.price?.netPrice),
          brutto: money(a.price?.grossPrice),
          steuersatz: a.price?.taxRate ?? null,
          version: a.version,
        })),
      };
    },
  },

  {
    name: "get_payments",
    title: "Zahlungen zu einem Beleg",
    description:
      "Zahlungsinformationen zu einer Rechnung oder einem Beleg: offener Betrag, " +
      "Zahlungsstatus und erfasste Zahlungen.",
    inputSchema: {
      type: "object",
      properties: { voucher_id: str("Die Beleg-UUID.") },
      required: ["voucher_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      return ctx.lex.json(`/v1/payments/${encodeURIComponent(req<string>(args, "voucher_id"))}`);
    },
  },

  {
    name: "open_items",
    title: "Offene Posten",
    description:
      "Debitoren-Offene-Posten: welche Rechnungen sind noch nicht bezahlt, wer hängt wie weit " +
      "hinterher. Rechnet aus der Belegliste und sortiert nach Überfälligkeit. " +
      "Hinweis: Rechnungen mit überschrittener Fälligkeit meldet Lexware als 'overdue' — " +
      "sie zählen hier als offen.",
    inputSchema: {
      type: "object",
      properties: {
        overdue_only: bool("Nur überfällige Rechnungen. Default false."),
        limit: int("Maximal zu prüfende Rechnungen (1–500, Default 250)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const res = await ctx.lex.paginate<any>(
        "/v1/voucherlist",
        { voucherType: "invoice", voucherStatus: "open", sort: "dueDate,ASC" },
        Math.min(500, Math.max(1, Number(args.limit) || 250)),
      );
      const today = new Date().toISOString().slice(0, 10);
      const posten = res.items
        .map((v) => {
          const faellig = v.dueDate ? String(v.dueDate).slice(0, 10) : null;
          const tage = faellig
            ? Math.floor((Date.parse(today) - Date.parse(faellig)) / 864e5)
            : null;
          return { ...row(v), tage_ueberfaellig: tage };
        })
        .filter((p) => (p.offen ?? 0) > 0.005)
        .filter((p) => !args.overdue_only || (p.tage_ueberfaellig ?? -1) > 0)
        .sort((a, b) => (b.tage_ueberfaellig ?? -1e9) - (a.tage_ueberfaellig ?? -1e9));

      return {
        anzahl: posten.length,
        summe_offen: sum(posten, "offen"),
        davon_ueberfaellig: posten.filter((p) => (p.tage_ueberfaellig ?? -1) > 0).length,
        abgeschnitten: res.truncated,
        posten,
      };
    },
  },

  {
    name: "revenue",
    title: "Umsatz im Zeitraum",
    description:
      "Umsatz über einen Zeitraum, aus der Belegliste gerechnet. basis='gestellt' zählt alle " +
      "gestellten Rechnungen (open,paid — periodengerecht), basis='bezahlt' nur die bezahlten " +
      "(Zufluss). Entwürfe und Stornos zählen nie mit. Die Beträge sind BRUTTO — die " +
      "Belegliste führt keine Nettowerte; für Netto die Belege einzeln über get_document holen.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: str("Von 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        basis: str("'gestellt' (Default) oder 'bezahlt'."),
        limit: int("Maximal zu berücksichtigende Rechnungen (1–500, Default 500)."),
      },
      required: ["date_from", "date_to"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const basis = String(args.basis ?? "gestellt").toLowerCase();
      if (!["gestellt", "bezahlt"].includes(basis)) {
        throw new LexwareError("basis muss 'gestellt' oder 'bezahlt' sein.");
      }
      const status = basis === "bezahlt" ? "paid" : "open,paid";
      const res = await ctx.lex.paginate<any>(
        "/v1/voucherlist",
        {
          voucherType: "invoice",
          voucherStatus: status,
          voucherDateFrom: date(args.date_from, "date_from"),
          voucherDateTo: date(args.date_to, "date_to"),
          sort: "voucherDate,ASC",
        },
        Math.min(500, Math.max(1, Number(args.limit) || 500)),
      );

      const proMonat: Record<string, number> = {};
      for (const v of res.items) {
        const m = String(v.voucherDate ?? "").slice(0, 7);
        if (m) proMonat[m] = Math.round(((proMonat[m] ?? 0) + (Number(v.totalAmount) || 0)) * 100) / 100;
      }

      return {
        zeitraum: { von: args.date_from, bis: args.date_to },
        basis,
        beruecksichtigte_status: status,
        anzahl_rechnungen: res.items.length,
        summe_brutto: sum(res.items, "totalAmount"),
        noch_offen: sum(res.items, "openAmount"),
        pro_monat: proMonat,
        abgeschnitten: res.truncated,
        ...(res.truncated
          ? { warnung: "Nicht alle Rechnungen im Zeitraum wurden geladen — die Summe ist unvollständig. Zeitraum verkleinern." }
          : {}),
        hinweis: "Beträge sind brutto. Die Lexware-Belegliste liefert keine Nettowerte.",
      };
    },
  },

  {
    name: "reference_data",
    title: "Stammdaten",
    description:
      "Nachschlagelisten von Lexware: Buchungskategorien (für create_voucher nötig), " +
      "Zahlungsbedingungen, Länder, Drucklayouts und wiederkehrende Rechnungen.",
    inputSchema: {
      type: "object",
      properties: {
        kind: str(
          "Eine aus: posting-categories, payment-conditions, countries, print-layouts, recurring-templates",
        ),
      },
      required: ["kind"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const kind = String(req<string>(args, "kind")).toLowerCase();
      const simple: Record<string, string> = {
        "posting-categories": "/v1/posting-categories",
        "payment-conditions": "/v1/payment-conditions",
        countries: "/v1/countries",
        "print-layouts": "/v1/print-layouts",
      };
      if (simple[kind]) return { kind, daten: await ctx.lex.json(simple[kind]) };
      if (kind === "recurring-templates") {
        const res = await ctx.lex.paginate<any>("/v1/recurring-templates", {}, 100);
        return { kind, anzahl: res.items.length, abgeschnitten: res.truncated, daten: res.items };
      }
      throw new LexwareError(
        `kind '${kind}' unbekannt. Erlaubt: ${[...Object.keys(simple), "recurring-templates"].join(", ")}`,
      );
    },
  },
];

export { docPath, checkStatus, date, DOC_PATHS };
export type { ToolContext };
