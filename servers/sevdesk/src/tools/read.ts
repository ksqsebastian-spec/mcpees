/**
 * Lesende Tools. Alle mit readOnlyHint — sie können nichts verändern.
 *
 * Die Feinheiten stammen aus der offiziellen sevdesk-Beschreibung (siehe
 * servers/sevdesk/schema/sevdesk-api.json) und sind hier eingebaut statt kommentiert:
 *
 *  - Filter auf Fremdobjekte brauchen id UND objectName, sonst filtern sie nicht — der
 *    Client setzt beides über refQuery().
 *  - Datumsfilter sind bei Rechnungen, Belegen und Aufträgen Unix-Zeitstempel, keine
 *    Datumszeichenketten. Ein 'YYYY-MM-DD' im Filter liefert Unsinn statt eines Fehlers.
 *  - Die Statusliste beim Filtern ist enger als die der Objekte: Rechnungen kennen als
 *    Objekt auch 50 und 750, filtern lässt sich nur nach 100, 200 und 1000.
 *  - Verschachtelte Objekte kommen ohne `embed` nur als { id, objectName } — der Name des
 *    Kunden an einer Rechnung ist ohne embed schlicht nicht da.
 */
import { SevdeskError, refQuery } from "../client";
import { createFileLink, PDF_PATHS } from "../files";
import { accountDefaults } from "../defaults";
import { type SevTool, str, int, bool, req } from "../context";

/* ── Kleinkram ────────────────────────────────────────────────────────────── */

/** sevdesk liefert Beträge oft als Zeichenkette ("1190.00"). */
export const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const sum = (rows: any[], field: string) =>
  Math.round(rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) * 100) / 100;

/**
 * 'YYYY-MM-DD' -> Unix-Sekunden (UTC-Mitternacht).
 *
 * Die Datumsfilter der API heißen startDate/endDate und sind Zeitstempel. Wer die
 * Zeichenkette durchreicht, bekommt keine Fehlermeldung, sondern eine unbrauchbare Liste.
 */
export function unixDay(value: unknown, name: string, endOfDay = false): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new SevdeskError(`${name} muss 'YYYY-MM-DD' sein, war '${s}'.`);
  }
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(ms)) throw new SevdeskError(`${name} ist kein gültiges Datum: '${s}'.`);
  return Math.floor(ms / 1000) + (endOfDay ? 86_399 : 0);
}

/** Zeitstempel (Sekunden oder ISO) -> 'YYYY-MM-DD', damit Antworten lesbar sind. */
export function isoDay(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString().slice(0, 10);
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

const limitOf = (args: Record<string, any>, fallback: number, max = 500) =>
  Math.min(max, Math.max(1, Number(args.limit) || fallback));

/** Verschachteltes Objekt lesbar machen — mit embed steht der Name drin, ohne nur die ID. */
const nested = (o: any, ...names: string[]) => {
  if (!o || typeof o !== "object") return null;
  for (const n of names) if (o[n]) return String(o[n]);
  return o.id ? `#${o.id}` : null;
};

export const INVOICE_STATUS: Record<string, string> = {
  "50": "Entwurf (nicht verschickt)",
  "100": "Entwurf",
  "200": "offen / verschickt",
  "750": "teilweise bezahlt",
  "1000": "bezahlt",
};

export const VOUCHER_STATUS: Record<string, string> = {
  "50": "Entwurf",
  "100": "offen / fällig",
  "1000": "bezahlt",
};

export const ORDER_STATUS: Record<string, string> = {
  "100": "Entwurf",
  "200": "verschickt",
  "300": "abgelehnt",
  "500": "angenommen",
  "750": "teilweise berechnet",
  "1000": "berechnet",
};

const label = (map: Record<string, string>, status: unknown) =>
  map[String(status)] ?? `unbekannt (${status})`;

function invoiceRow(inv: any) {
  return {
    id: inv.id,
    nr: inv.invoiceNumber ?? null,
    typ: inv.invoiceType ?? null,
    status: label(INVOICE_STATUS, inv.status),
    status_code: inv.status ?? null,
    datum: isoDay(inv.invoiceDate),
    kunde: nested(inv.contact, "name", "familyname"),
    contactId: inv.contact?.id ?? null,
    netto: money(inv.sumNet),
    brutto: money(inv.sumGross),
    bezahlt: money(inv.paidAmount),
    offen: Math.round(((Number(inv.sumGross) || 0) - (Number(inv.paidAmount) || 0)) * 100) / 100,
    waehrung: inv.currency ?? null,
    zahlungsziel_tage: inv.timeToPay ?? null,
  };
}

/* ── Tools ────────────────────────────────────────────────────────────────── */

export const readTools: SevTool[] = [
  {
    name: "system_info",
    title: "Konto und Buchhaltungsversion",
    description:
      "Zeigt, mit welchem sevdesk-Konto gesprochen wird und in welcher Buchhaltungswelt es " +
      "lebt. Das ist kein Beiwerk: seit dem sevdesk-Update 2.0 heißt die Steuerregel " +
      "taxRule und nicht mehr taxType. Wer beim Anlegen die falsche schickt, bekommt 422 " +
      "oder einen Beleg mit falscher Steuerregel. Guter erster Aufruf. " +
      "Nennt außerdem die Bankkonten und die nächste freie Kundennummer.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      const version = (await ctx.sev.call<any>("GET", "/Tools/bookkeepingSystemVersion"))?.version;
      const accounts = await ctx.sev.call<any[]>("GET", "/CheckAccount", { query: { limit: 100 } });
      const next = await ctx.sev.call<any>("GET", "/Contact/Factory/getNextCustomerNumber");
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      return {
        buchhaltungsversion: String(version ?? "unbekannt"),
        steuerangabe:
          String(version) === "2.0"
            ? "taxRule (Objekt mit id) — taxType ist abgelöst"
            : "taxType (default/eu/noteu/ss) — taxRule gibt es hier noch nicht",
        naechste_kundennummer: typeof next === "string" || typeof next === "number" ? next : null,
        waehrung: defaults.currency,
        kleinunternehmer: defaults.smallSettlement,
        bankkonten: (accounts ?? []).map((a: any) => ({
          id: a.id,
          name: a.name ?? null,
          typ: a.type ?? null,
          iban: a.iban ?? null,
          waehrung: a.currency ?? null,
          status: a.status ?? null,
        })),
        vorgaben_fuers_anlegen: {
          kontaktperson_id: defaults.contactPersonId,
          einheit_id: defaults.unityId,
          land_id: defaults.countryId,
          gelernt_aus: defaults.quelle,
          hinweis:
            "sevdesk hat keine Endpunkte, die Benutzer, Einheiten oder Länder auflisten. " +
            "Diese IDs stammen aus vorhandenen Belegen des Kontos.",
        },
      };
    },
  },

  {
    name: "search_contacts",
    title: "Kontakte suchen",
    description:
      "Kontakte auflisten oder suchen. Wichtig zu wissen: sevdesk dokumentiert für die " +
      "Kontaktliste nur den Filter customerNumber. Eine Namenssuche gibt es dort nicht — " +
      "dieser Server holt deshalb Seiten und filtert den Namen selbst. Bei großen " +
      "Adressbeständen also lieber die Kundennummer nehmen oder limit erhöhen. " +
      "Das Ergebnis sagt, wie gefiltert wurde.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name, Firma oder Nachname — Teiltreffer, Groß-/Kleinschreibung egal. Wird lokal gefiltert."),
        customer_number: str("Kundennummer. Wird von sevdesk selbst gefiltert und ist damit exakt."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const needle = args.name ? String(args.name).toLowerCase() : null;
      // Lokal gefiltert wird nur, was auch geholt wurde — deshalb weiter greifen als limit.
      const fetchMax = needle ? Math.max(limit, 500) : limit;
      const res = await ctx.sev.paginate<any>(
        "/Contact",
        { customerNumber: args.customer_number, depth: "1" },
        fetchMax,
      );

      const all = res.items.map((c: any) => ({
        id: c.id,
        kundennummer: c.customerNumber ?? null,
        name:
          c.name ||
          [c.surename, c.familyname].filter(Boolean).join(" ") ||
          `#${c.id}`,
        typ: c.name ? "Firma" : "Person",
        kategorie: nested(c.category, "name"),
        status: c.status ?? null,
        ust_id: c.vatNumber ?? null,
        steuernummer: c.taxNumber ?? null,
        zahlungsziel_tage: c.defaultTimeToPay ?? null,
      }));
      const hits = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;

      return {
        gefiltert: needle ? "Name lokal, Kundennummer von sevdesk" : "von sevdesk",
        anzahl: Math.min(hits.length, limit),
        gesamt_im_konto: res.total,
        durchsucht: all.length,
        ...(needle && res.truncated
          ? {
              hinweis:
                `Es wurden ${all.length} von ${res.total ?? "?"} Kontakten durchsucht. ` +
                `Weiter hinten könnten weitere Treffer liegen.`,
            }
          : {}),
        kontakte: hits.slice(0, limit),
      };
    },
  },

  {
    name: "get_contact",
    title: "Kontakt im Detail",
    description:
      "Ein Kontakt mit Adressen und Kommunikationswegen. Adressen und Telefon/E-Mail sind " +
      "bei sevdesk eigene Objekte und stehen NICHT am Kontakt — dieser Aufruf holt sie mit.",
    inputSchema: {
      type: "object",
      properties: { contact_id: int("Die Kontakt-ID aus search_contacts.") },
      required: ["contact_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<number>(args, "contact_id");
      const list = await ctx.sev.call<any[]>("GET", "/Contact/{contactId}", {
        path: { contactId: id },
        query: { embed: "category,parent" },
      });
      const c = Array.isArray(list) ? list[0] : list;
      if (!c) throw new SevdeskError(`Kontakt ${id} gibt es nicht.`);

      // Der Filter auf /ContactAddress steht in keiner Beschreibung (siehe
      // UNDOCUMENTED_QUERY im Client). Deshalb wird das Ergebnis hier noch einmal geprüft:
      // würde sevdesk den Filter ignorieren, kämen fremde Adressen zurück — mit `embed`
      // steht der Kontakt an jeder Adresse und die Zuordnung ist nachprüfbar.
      const rawAddresses = await ctx.sev.call<any[]>("GET", "/ContactAddress", {
        query: { ...refQuery("contact", "Contact", id), limit: 50, embed: "country,contact" },
      });
      const addresses = (rawAddresses ?? []).filter(
        (a: any) => !a.contact?.id || String(a.contact.id) === String(id),
      );
      const ways = await ctx.sev.call<any[]>("GET", "/CommunicationWay", {
        query: { ...refQuery("contact", "Contact", id), limit: 50 },
      });

      return {
        id: c.id,
        kundennummer: c.customerNumber ?? null,
        name: c.name || [c.surename, c.familyname].filter(Boolean).join(" "),
        typ: c.name ? "Firma" : "Person",
        kategorie: nested(c.category, "name"),
        beschreibung: c.description ?? null,
        ust_id: c.vatNumber ?? null,
        steuernummer: c.taxNumber ?? null,
        iban: c.bankAccount ?? null,
        zahlungsziel_tage: c.defaultTimeToPay ?? null,
        skonto_prozent: c.defaultCashbackPercent ?? null,
        adressen: (addresses ?? []).map((a: any) => ({
          id: a.id,
          strasse: a.street ?? null,
          plz: a.zip ?? null,
          ort: a.city ?? null,
          land: nested(a.country, "name", "code"),
          name: a.name ?? null,
        })),
        kontaktwege: (ways ?? []).map((w: any) => ({
          typ: w.type ?? null,
          wert: w.value ?? null,
          haupt: w.main === "1" || w.main === true,
        })),
      };
    },
  },

  {
    name: "search_invoices",
    title: "Rechnungen suchen",
    description:
      "Ausgangsrechnungen suchen. Nach Status filtern geht nur mit 100 (Entwurf), " +
      "200 (offen/verschickt) und 1000 (bezahlt) — die Rechnungen selbst können auch 50 " +
      "und 750 (teilweise bezahlt) haben, danach lässt sich aber nicht filtern. " +
      "Die Kundennamen werden mitgeholt; ohne das stünde an jeder Rechnung nur eine ID.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("100 = Entwurf, 200 = offen/verschickt, 1000 = bezahlt."),
        contact_id: int("Nur Rechnungen dieses Kunden."),
        invoice_number: str("Nach Rechnungsnummer suchen."),
        date_from: str("Rechnungsdatum ab 'YYYY-MM-DD'."),
        date_to: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate<any>(
        "/Invoice",
        {
          status: args.status,
          invoiceNumber: args.invoice_number,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.contact_id),
          embed: "contact",
        },
        limit,
      );
      const rows = res.items.map(invoiceRow);
      return {
        anzahl: rows.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...(res.truncated
          ? { hinweis: `Es gibt mehr als ${limit} Treffer. Zeitraum eingrenzen oder limit erhöhen.` }
          : {}),
        summe_netto: sum(res.items, "sumNet"),
        summe_brutto: sum(res.items, "sumGross"),
        rechnungen: rows,
      };
    },
  },

  {
    name: "get_invoice",
    title: "Rechnung im Detail",
    description:
      "Eine Rechnung mit allen Positionen, Steuerangaben und Beträgen. Die Positionen sind " +
      "ein eigener Aufruf bei sevdesk und werden hier mitgeholt.",
    inputSchema: {
      type: "object",
      properties: { invoice_id: int("Die Rechnungs-ID aus search_invoices.") },
      required: ["invoice_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<number>(args, "invoice_id");
      const list = await ctx.sev.call<any[]>("GET", "/Invoice/{invoiceId}", {
        path: { invoiceId: id },
        query: { embed: "contact,contactPerson,addressCountry,taxRule" },
      });
      const inv = Array.isArray(list) ? list[0] : list;
      if (!inv) throw new SevdeskError(`Rechnung ${id} gibt es nicht.`);

      const positions = await ctx.sev.call<any[]>("GET", "/Invoice/{invoiceId}/getPositions", {
        path: { invoiceId: id },
        query: { limit: 500, embed: "unity,part" },
      });

      return {
        ...invoiceRow(inv),
        kopftext: inv.headText ?? null,
        fusstext: inv.footText ?? null,
        anschrift: inv.address ?? null,
        liefer_datum: isoDay(inv.deliveryDate),
        versendet_am: isoDay(inv.sendDate),
        bezahlt_am: isoDay(inv.payDate),
        steuerregel: nested(inv.taxRule, "name") ?? inv.taxType ?? null,
        steuertext: inv.taxText ?? null,
        festgeschrieben: Boolean(inv.enshrined),
        preise_sind: inv.showNet === true || inv.showNet === "1" ? "netto" : "brutto",
        positionen: (positions ?? []).map((p: any) => ({
          nr: p.positionNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          menge: money(p.quantity),
          einheit: nested(p.unity, "translationCode", "name"),
          einzelpreis: money(p.price),
          steuersatz: money(p.taxRate),
          rabatt: money(p.discount),
          summe_netto: money(p.sumNet),
          summe_brutto: money(p.sumGross),
          artikel_id: p.part?.id ?? null,
        })),
      };
    },
  },

  {
    name: "download_document",
    title: "Beleg als PDF",
    description:
      "Erzeugt einen zeitlich begrenzten Download-Link auf das PDF einer Rechnung, eines " +
      "Auftrags oder einer Gutschrift. sevdesk liefert PDFs nur als base64 gegen den Token, " +
      "deshalb stellt dieser Server die Datei über einen eigenen, nicht erratbaren Link " +
      "bereit. Der Abruf setzt bewusst preventSendBy — ein Download darf den Beleg nicht " +
      "als versendet markieren. Eingangsbelege (Voucher) haben kein PDF über die API.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart — eine aus: ${Object.keys(PDF_PATHS).join(", ")}`),
        document_id: int("Die ID des Belegs."),
        minutes: int("Gültigkeit des Links in Minuten (1–1440, Default 30)."),
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const docType = String(req<string>(args, "doc_type")).toLowerCase();
      if (!PDF_PATHS[docType]) {
        throw new SevdeskError(
          `doc_type '${docType}' kennt dieser Server nicht. Erlaubt: ${Object.keys(PDF_PATHS).join(", ")}.`,
        );
      }
      const id = req<number>(args, "document_id");
      const link = await createFileLink(
        ctx.kv,
        ctx.credential,
        { docType, id, filename: `${docType}-${id}.pdf` },
        Number(args.minutes) || 30,
      );
      return {
        url: `${ctx.origin}/f/${link.token}`,
        gueltig_minuten: link.expiresInMinutes,
        hinweis:
          "Der Link ist ein Geheimnis und funktioniert ohne Anmeldung. Entwürfe haben je " +
          "nach Konto noch kein PDF.",
      };
    },
  },

  {
    name: "search_vouchers",
    title: "Eingangsbelege suchen",
    description:
      "Belege (Voucher) sind bei sevdesk die Eingangsseite: Lieferantenrechnungen, Quittungen, " +
      "Kassenbons. creditDebit trennt Einnahme (C) von Ausgabe (D). Status: 50 Entwurf, " +
      "100 offen/fällig, 1000 bezahlt.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("50 = Entwurf, 100 = offen/fällig, 1000 = bezahlt."),
        credit_debit: str("'C' = Einnahme, 'D' = Ausgabe."),
        supplier_id: int("Nur Belege dieses Lieferanten (Kontakt-ID)."),
        description: str("Teilstring in der Belegbeschreibung (meist die Belegnummer)."),
        date_from: str("Belegdatum ab 'YYYY-MM-DD'."),
        date_to: str("Belegdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate<any>(
        "/Voucher",
        {
          status: args.status,
          creditDebit: args.credit_debit ? String(args.credit_debit).toUpperCase() : undefined,
          descriptionLike: args.description,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.supplier_id),
          embed: "supplier",
        },
        limit,
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe_netto: sum(res.items, "sumNet"),
        summe_brutto: sum(res.items, "sumGross"),
        belege: res.items.map((v: any) => ({
          id: v.id,
          beschreibung: v.description ?? null,
          status: label(VOUCHER_STATUS, v.status),
          status_code: v.status ?? null,
          art: v.creditDebit === "C" ? "Einnahme" : "Ausgabe",
          typ: v.voucherType ?? null,
          datum: isoDay(v.voucherDate),
          faellig_am: isoDay(v.paymentDeadline),
          bezahlt_am: isoDay(v.payDate),
          lieferant: nested(v.supplier, "name", "familyname") ?? v.supplierName ?? null,
          netto: money(v.sumNet),
          brutto: money(v.sumGross),
          bezahlt: money(v.paidAmount),
        })),
      };
    },
  },

  {
    name: "get_voucher",
    title: "Eingangsbeleg im Detail",
    description:
      "Ein Beleg mit seinen Positionen. Die Positionen tragen das Buchungskonto — die " +
      "eigentlich interessante Information an einem Eingangsbeleg.",
    inputSchema: {
      type: "object",
      properties: { voucher_id: int("Die Beleg-ID aus search_vouchers.") },
      required: ["voucher_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<number>(args, "voucher_id");
      const list = await ctx.sev.call<any[]>("GET", "/Voucher/{voucherId}", {
        path: { voucherId: id },
        query: { embed: "supplier,taxRule,document" },
      });
      const v = Array.isArray(list) ? list[0] : list;
      if (!v) throw new SevdeskError(`Beleg ${id} gibt es nicht.`);

      const positions = await ctx.sev.call<any[]>("GET", "/VoucherPos", {
        query: {
          ...refQuery("voucher", "Voucher", id),
          limit: 200,
          embed: "accountingType,accountDatev",
        },
      });

      return {
        id: v.id,
        beschreibung: v.description ?? null,
        status: label(VOUCHER_STATUS, v.status),
        art: v.creditDebit === "C" ? "Einnahme" : "Ausgabe",
        datum: isoDay(v.voucherDate),
        liefer_datum: isoDay(v.deliveryDate),
        faellig_am: isoDay(v.paymentDeadline),
        lieferant: nested(v.supplier, "name", "familyname") ?? v.supplierName ?? null,
        steuerregel: nested(v.taxRule, "name") ?? v.taxType ?? null,
        netto: money(v.sumNet),
        steuer: money(v.sumTax),
        brutto: money(v.sumGross),
        bezahlt: money(v.paidAmount),
        festgeschrieben: Boolean(v.enshrined),
        positionen: (positions ?? []).map((p: any) => ({
          konto:
            nested(p.accountDatev, "accountNumber", "name") ??
            nested(p.accountingType, "name") ??
            null,
          kommentar: p.comment ?? null,
          steuersatz: money(p.taxRate),
          netto: money(p.sumNet),
          steuer: money(p.sumTax),
          brutto: money(p.sumGross),
          anlagegut: p.isAsset === true || p.isAsset === "1",
        })),
      };
    },
  },

  {
    name: "search_orders",
    title: "Angebote und Aufträge suchen",
    description:
      "Aufträge sind bei sevdesk drei Dinge zugleich: Angebot (AN), Auftragsbestätigung (AB) " +
      "und Lieferschein (LI) — unterschieden über orderType. Status: 100 Entwurf, " +
      "200 verschickt, 300 abgelehnt, 500 angenommen, 750 teilweise berechnet, 1000 berechnet.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("100, 200, 300, 500, 750 oder 1000 — siehe Beschreibung."),
        contact_id: int("Nur Aufträge dieses Kunden."),
        order_number: str("Nach Auftragsnummer suchen."),
        date_from: str("Auftragsdatum ab 'YYYY-MM-DD'."),
        date_to: str("Auftragsdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate<any>(
        "/Order",
        {
          status: args.status,
          orderNumber: args.order_number,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.contact_id),
          embed: "contact",
        },
        limit,
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe_netto: sum(res.items, "sumNet"),
        auftraege: res.items.map((o: any) => ({
          id: o.id,
          nr: o.orderNumber ?? null,
          art:
            o.orderType === "AN"
              ? "Angebot"
              : o.orderType === "AB"
                ? "Auftragsbestätigung"
                : o.orderType === "LI"
                  ? "Lieferschein"
                  : (o.orderType ?? null),
          status: label(ORDER_STATUS, o.status),
          status_code: o.status ?? null,
          datum: isoDay(o.orderDate),
          kunde: nested(o.contact, "name", "familyname"),
          netto: money(o.sumNet),
          brutto: money(o.sumGross),
        })),
      };
    },
  },

  {
    name: "get_order",
    title: "Auftrag im Detail",
    description: "Ein Angebot, eine Auftragsbestätigung oder ein Lieferschein mit allen Positionen.",
    inputSchema: {
      type: "object",
      properties: { order_id: int("Die Auftrags-ID aus search_orders.") },
      required: ["order_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<number>(args, "order_id");
      const list = await ctx.sev.call<any[]>("GET", "/Order/{orderId}", {
        path: { orderId: id },
        query: { embed: "contact,contactPerson,taxRule" },
      });
      const o = Array.isArray(list) ? list[0] : list;
      if (!o) throw new SevdeskError(`Auftrag ${id} gibt es nicht.`);

      const positions = await ctx.sev.call<any[]>("GET", "/Order/{orderId}/getPositions", {
        path: { orderId: id },
        query: { limit: 500, embed: "unity,part" },
      });

      return {
        id: o.id,
        nr: o.orderNumber ?? null,
        art: o.orderType ?? null,
        status: label(ORDER_STATUS, o.status),
        datum: isoDay(o.orderDate),
        kunde: nested(o.contact, "name", "familyname"),
        kopftext: o.headText ?? null,
        fusstext: o.footText ?? null,
        netto: money(o.sumNet),
        brutto: money(o.sumGross),
        steuerregel: nested(o.taxRule, "name") ?? o.taxType ?? null,
        positionen: (positions ?? []).map((p: any) => ({
          nr: p.positionNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          menge: money(p.quantity),
          einheit: nested(p.unity, "translationCode", "name"),
          einzelpreis: money(p.price),
          steuersatz: money(p.taxRate),
          summe_netto: money(p.sumNet),
        })),
      };
    },
  },

  {
    name: "search_parts",
    title: "Artikel suchen",
    description:
      "Artikel und Leistungen aus dem Stamm. Name und Artikelnummer filtert sevdesk selbst. " +
      "Der Lagerbestand ist ein eigener Aufruf pro Artikel und wird nur auf Wunsch geholt.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Artikelname."),
        part_number: str("Artikelnummer."),
        with_stock: bool("Lagerbestand mitholen. Kostet einen Aufruf pro Artikel — nur bei wenigen Treffern sinnvoll."),
        limit: int("Maximale Trefferzahl (1–200, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50, 200);
      const res = await ctx.sev.paginate<any>(
        "/Part",
        { name: args.name, partNumber: args.part_number, embed: "unity" },
        limit,
      );
      const withStock = args.with_stock === true && res.items.length <= 25;
      const parts = [];
      for (const p of res.items) {
        let stock: number | null = money(p.stock);
        if (withStock) {
          const s = await ctx.sev.call<any>("GET", "/Part/{partId}/getStock", {
            path: { partId: p.id },
          });
          stock = money(s);
        }
        parts.push({
          id: p.id,
          nr: p.partNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          einheit: nested(p.unity, "translationCode", "name"),
          preis_netto: money(p.priceNet ?? p.price),
          preis_brutto: money(p.priceGross),
          einkaufspreis: money(p.pricePurchase),
          steuersatz: money(p.taxRate),
          lagerbestand: stock,
          lager_aktiv: p.stockEnabled === true || p.stockEnabled === "1",
          aktiv: String(p.status) === "100",
        });
      }
      return {
        anzahl: parts.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...(args.with_stock === true && !withStock
          ? { hinweis: "Lagerbestand nur bei bis zu 25 Treffern — sonst wären es zu viele Aufrufe." }
          : {}),
        artikel: parts,
      };
    },
  },

  {
    name: "check_accounts",
    title: "Bankkonten und Kontostände",
    description:
      "Die Bankkonten des Mandanten. Der Kontostand zu einem Stichtag ist ein eigener " +
      "Aufruf und wird nur geholt, wenn ein Datum mitgegeben wird.",
    inputSchema: {
      type: "object",
      properties: {
        balance_date: str("Stichtag 'YYYY-MM-DD' für den Kontostand. Ohne Angabe kein Saldo."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const accounts = (await ctx.sev.call<any[]>("GET", "/CheckAccount", { query: { limit: 100 } })) ?? [];
      const day = args.balance_date ? String(args.balance_date) : null;
      if (day) unixDay(day, "balance_date"); // nur zur Formatprüfung

      const rows = [];
      for (const a of accounts) {
        let saldo: number | null = money(a.balance);
        if (day) {
          const b = await ctx.sev.call<any>("GET", "/CheckAccount/{checkAccountId}/getBalanceAtDate", {
            path: { checkAccountId: a.id },
            query: { date: day },
          });
          saldo = money(b);
        }
        rows.push({
          id: a.id,
          name: a.name ?? null,
          typ: a.type ?? null,
          iban: a.iban ?? null,
          waehrung: a.currency ?? null,
          saldo,
          status: String(a.status) === "100" ? "aktiv" : (a.status ?? null),
        });
      }
      return { stichtag: day, anzahl: rows.length, konten: rows };
    },
  },

  {
    name: "search_transactions",
    title: "Bankumsätze suchen",
    description:
      "Umsätze auf den Bankkonten. isBooked=false zeigt genau das, was noch keinem Beleg " +
      "zugeordnet ist — der übliche Einstieg für „was ist noch offen in der Buchhaltung?\".",
    inputSchema: {
      type: "object",
      properties: {
        check_account_id: int("Nur Umsätze dieses Bankkontos."),
        is_booked: bool("true = bereits verbucht, false = noch nicht zugeordnet."),
        only_credit: bool("Nur Eingänge."),
        only_debit: bool("Nur Ausgänge."),
        payee: str("Name des Zahlungspartners."),
        purpose: str("Teilstring im Verwendungszweck."),
        date_from: str("Ab 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      // Anders als bei Rechnungen ist das Datum hier laut Beschreibung eine Zeichenkette.
      // sevdesk versteht überall Zeitstempel, also wird auch hier einer geschickt — nur eben
      // als String, damit der Typ der Beschreibung entspricht.
      const from = unixDay(args.date_from, "date_from");
      const to = unixDay(args.date_to, "date_to", true);
      const res = await ctx.sev.paginate<any>(
        "/CheckAccountTransaction",
        {
          isBooked: args.is_booked,
          onlyCredit: args.only_credit,
          onlyDebit: args.only_debit,
          payeePayerName: args.payee,
          paymtPurpose: args.purpose,
          startDate: from === undefined ? undefined : String(from),
          endDate: to === undefined ? undefined : String(to),
          ...refQuery("checkAccount", "CheckAccount", args.check_account_id),
          embed: "checkAccount",
        },
        limit,
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe: sum(res.items, "amount"),
        umsaetze: res.items.map((t: any) => ({
          id: t.id,
          datum: isoDay(t.valueDate ?? t.entryDate),
          betrag: money(t.amount),
          partner: t.payeePayerName ?? null,
          zweck: t.paymtPurpose ?? null,
          konto: nested(t.checkAccount, "name"),
          verbucht: String(t.status) === "200" || t.status === 200,
          status: t.status ?? null,
        })),
      };
    },
  },

  {
    name: "revenue",
    title: "Umsatz auswerten",
    description:
      "Umsatz über einen Zeitraum, aus den Rechnungen gerechnet und nach Monat aufgeteilt. " +
      "'gestellt' zählt alles, was verschickt oder bezahlt ist; 'bezahlt' nur Bezahltes. " +
      "Entwürfe zählen nie mit — sie sind kein Umsatz.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: str("Von 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        basis: str("'gestellt' (Default) oder 'bezahlt'."),
        limit: int("Wieviele Rechnungen höchstens einbezogen werden (Default 500)."),
      },
      required: ["date_from", "date_to"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const basis = String(args.basis ?? "gestellt").toLowerCase();
      if (basis !== "gestellt" && basis !== "bezahlt") {
        throw new SevdeskError("basis muss 'gestellt' oder 'bezahlt' sein.");
      }
      const limit = Math.min(2000, Math.max(1, Number(args.limit) || 500));
      const res = await ctx.sev.paginate<any>(
        "/Invoice",
        {
          startDate: unixDay(req<string>(args, "date_from"), "date_from"),
          endDate: unixDay(req<string>(args, "date_to"), "date_to", true),
          embed: "contact",
        },
        limit,
      );

      // Status 100/50 sind Entwürfe. Alles ab 200 gilt als gestellt.
      const relevant = res.items.filter((i: any) => Number(i.status) >= 200);
      const counted =
        basis === "bezahlt" ? relevant.filter((i: any) => Number(i.status) === 1000) : relevant;

      const months = new Map<string, { netto: number; brutto: number; anzahl: number }>();
      for (const inv of counted) {
        const month = (isoDay(inv.invoiceDate) ?? "?").slice(0, 7);
        const m = months.get(month) ?? { netto: 0, brutto: 0, anzahl: 0 };
        m.netto += Number(inv.sumNet) || 0;
        m.brutto += Number(inv.sumGross) || 0;
        m.anzahl++;
        months.set(month, m);
      }

      return {
        zeitraum: { von: args.date_from, bis: args.date_to },
        basis,
        anzahl_rechnungen: counted.length,
        entwuerfe_ausgelassen: res.items.length - relevant.length,
        abgeschnitten: res.truncated,
        ...(res.truncated
          ? { hinweis: `Nur die ersten ${limit} Rechnungen sind eingerechnet — die Summe ist zu niedrig.` }
          : {}),
        summe_netto: sum(counted, "sumNet"),
        summe_brutto: sum(counted, "sumGross"),
        monate: [...months.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([monat, m]) => ({
            monat,
            anzahl: m.anzahl,
            netto: Math.round(m.netto * 100) / 100,
            brutto: Math.round(m.brutto * 100) / 100,
          })),
      };
    },
  },

  {
    name: "open_items",
    title: "Offene Posten",
    description:
      "Rechnungen, die noch nicht vollständig bezahlt sind, nach Überfälligkeit sortiert. " +
      "Teilzahlungen zählen mit: offen ist Brutto minus paidAmount, nicht der ganze Betrag.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: int("Nur Rechnungen dieses Kunden."),
        overdue_only: bool("Nur überfällige."),
        limit: int("Maximale Trefferzahl (1–500, Default 200)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 200);
      const res = await ctx.sev.paginate<any>(
        "/Invoice",
        { status: 200, ...refQuery("contact", "Contact", args.contact_id), embed: "contact" },
        limit,
      );
      const today = Date.now();
      const rows = res.items
        .map((inv: any) => {
          const brutto = Number(inv.sumGross) || 0;
          const bezahlt = Number(inv.paidAmount) || 0;
          const offen = Math.round((brutto - bezahlt) * 100) / 100;
          const datum = isoDay(inv.invoiceDate);
          const frist = Number(inv.timeToPay) || 0;
          const faellig =
            datum && frist >= 0
              ? new Date(Date.parse(`${datum}T00:00:00Z`) + frist * 86_400_000)
                  .toISOString()
                  .slice(0, 10)
              : null;
          const tage = faellig
            ? Math.floor((today - Date.parse(`${faellig}T00:00:00Z`)) / 86_400_000)
            : null;
          return {
            ...invoiceRow(inv),
            offen,
            faellig_am: faellig,
            tage_ueberfaellig: tage !== null && tage > 0 ? tage : 0,
          };
        })
        .filter((r) => r.offen > 0)
        .filter((r) => args.overdue_only !== true || r.tage_ueberfaellig > 0)
        .sort((a, b) => b.tage_ueberfaellig - a.tage_ueberfaellig);

      return {
        anzahl: rows.length,
        abgeschnitten: res.truncated,
        summe_offen: Math.round(rows.reduce((s, r) => s + r.offen, 0) * 100) / 100,
        summe_ueberfaellig:
          Math.round(
            rows.filter((r) => r.tage_ueberfaellig > 0).reduce((s, r) => s + r.offen, 0) * 100,
          ) / 100,
        hinweis:
          "Gefiltert wird auf Status 200 (offen). Teilweise bezahlte Rechnungen tragen bei " +
          "sevdesk Status 750 und sind hier nicht dabei — sie lassen sich nicht filtern.",
        posten: rows,
      };
    },
  },

  {
    name: "booking_accounts",
    title: "Erlaubte Buchungskonten",
    description:
      "Welche Buchungskonten es gibt und welche Steuerregeln und Steuersätze dazu passen. " +
      "Vor jedem create_voucher der richtige Aufruf: sevdesk lehnt eine unpassende " +
      "Kombination aus Konto, Steuerregel und Steuersatz mit 422 ab, und die Meldung von " +
      "dort erklärt nicht, welche Kombination gegangen wäre. Der Wert hängt vom Mandanten " +
      "ab (Kleinunternehmer sehen andere Regeln).",
    inputSchema: {
      type: "object",
      properties: {
        richtung: str("'ausgabe' (Default), 'einnahme' oder 'alle'."),
        suche: str("Teilstring in Kontonummer, Kontoname oder Beschreibung."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const richtung = String(args.richtung ?? "ausgabe").toLowerCase();
      const path =
        richtung === "einnahme"
          ? "/ReceiptGuidance/forRevenue"
          : richtung === "alle"
            ? "/ReceiptGuidance/forAllAccounts"
            : richtung === "ausgabe"
              ? "/ReceiptGuidance/forExpense"
              : null;
      if (!path) throw new SevdeskError("richtung muss 'ausgabe', 'einnahme' oder 'alle' sein.");

      const all = (await ctx.sev.call<any[]>("GET", path)) ?? [];
      const needle = args.suche ? String(args.suche).toLowerCase() : null;
      const rows = (Array.isArray(all) ? all : [])
        .filter(
          (g: any) =>
            !needle ||
            `${g.accountNumber} ${g.accountName} ${g.description ?? ""}`.toLowerCase().includes(needle),
        )
        .map((g: any) => ({
          konto_id: g.accountDatevId,
          kontonummer: g.accountNumber,
          name: g.accountName,
          beschreibung: g.description ?? null,
          belegarten: g.allowedReceiptTypes ?? [],
          steuerregeln: (g.allowedTaxRules ?? []).map((r: any) => ({
            id: r.id,
            name: r.description ?? r.name,
            steuersaetze: r.taxRates ?? [],
          })),
        }));

      return {
        richtung,
        anzahl: rows.length,
        hinweis:
          "konto_id gehört in create_voucher als konto_id, die id aus steuerregeln als " +
          "steuerregel_id. Die Steuersätze stehen als Namen (ZERO, SEVEN, NINETEEN) — " +
          "in der Position wird die Zahl gebraucht (0, 7, 19).",
        konten: rows,
      };
    },
  },
];
