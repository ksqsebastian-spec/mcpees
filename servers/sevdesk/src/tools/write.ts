/**
 * Anlegende Tools. Kein Ändern, kein Löschen, kein Buchen, kein Versenden.
 *
 * Was bewusst NICHT hier steht, obwohl die API es könnte: bookAmount (Beleg als bezahlt
 * buchen), sendViaEmail und sendBy (verschicken), cancelInvoice (stornieren), enshrine
 * (festschreiben — laut sevdesk aus rechtlichen Gründen unwiderruflich), resetToDraft und
 * resetToOpen. Das sind alles Zustandsänderungen an bestehenden Belegen.
 *
 * Drei Dinge prägen die Umsetzung:
 *
 *  1. **Steuerregel oder Steuerart, je nach Konto.** Mit dem sevdesk-Update 2.0 ersetzt
 *     `taxRule` (ein Objekt mit id) das alte `taxType` (eine Zeichenkette). Welche Welt
 *     gilt, sagt /Tools/bookkeepingSystemVersion. Geschickt wird nur die passende — beides
 *     zugleich ist widersprüchlich.
 *  2. **Angelegt wird immer als Entwurf.** sevdesk-Update 2.0 lässt Rechnungen ohnehin nur
 *     mit Status 100 (Entwurf) entstehen; Belege nur mit 50 (Entwurf) oder 100 (offen).
 *     Ein Beleg, den ein Chatverlauf direkt auf „bezahlt" setzt, wäre auch fachlich falsch.
 *  3. **Nach dem Schreiben wird zurückgelesen.** Eine Position, die sevdesk verwirft,
 *     erzeugt keine Fehlermeldung — die Rechnung entsteht einfach mit weniger Zeilen.
 *     Deshalb meldet jede Antwort, was tatsächlich im Beleg gelandet ist.
 */
import { SevdeskError, ref } from "../client";
import { accountDefaults, needId } from "../defaults";
import { type SevTool, str, int, num, bool, req } from "../context";
import { money, unixDay, isoDay } from "./read";

/** Kontaktkategorien von sevdesk. Die Kategorie ist beim Anlegen Pflicht. */
const CATEGORIES: Record<string, number> = { kunde: 3, lieferant: 4, partner: 28 };

/** Voreinstellung für die Steuerregel, wenn keine mitgegeben wird (sevdesk-Update 2.0). */
const TAX_RULE_DEFAULT = { regel: 1, text: "Umsatzsteuer ausweisen" };
const TAX_RULE_KLEINUNTERNEHMER = { regel: 11, text: "Steuer nicht erhoben nach §19 UStG" };

/** Die alte Welt (sevdesk-Update 1.0) kennt statt Regeln nur diese Arten. */
const TAX_TYPES = ["default", "eu", "noteu", "ss"];

interface TaxChoice {
  /** Was in den Beleg-Body gehört. */
  body: Record<string, unknown>;
  /** Was in der Antwort stehen soll, damit die Wahl sichtbar ist. */
  gewaehlt: string;
  taxText: string;
}

/**
 * Steuerangabe für die Buchhaltungswelt des Kontos zusammenbauen.
 *
 * Wichtig: es wird nie geraten und stillschweigend eingesetzt. Was gewählt wurde, steht in
 * der Antwort — eine falsche Steuerregel merkt sonst niemand, bis der Steuerberater fragt.
 */
function taxFor(
  version: string,
  smallSettlement: boolean | null,
  args: Record<string, any>,
): TaxChoice {
  if (version === "1.0") {
    const type = String(args.steuerart ?? (smallSettlement ? "ss" : "default")).toLowerCase();
    if (!TAX_TYPES.includes(type)) {
      throw new SevdeskError(
        `steuerart '${type}' gibt es nicht. Erlaubt: ${TAX_TYPES.join(", ")}. ` +
          `Dieses Konto läuft noch auf sevdesk 1.0 und kennt deshalb taxType, nicht taxRule.`,
      );
    }
    return {
      body: { taxType: type },
      gewaehlt: `taxType '${type}' (sevdesk 1.0)`,
      taxText: String(args.steuertext ?? (type === "ss" ? TAX_RULE_KLEINUNTERNEHMER.text : TAX_RULE_DEFAULT.text)),
    };
  }

  const fallback = smallSettlement ? TAX_RULE_KLEINUNTERNEHMER : TAX_RULE_DEFAULT;
  const id = Number(args.steuerregel_id ?? fallback.regel);
  if (!Number.isInteger(id) || id <= 0) {
    throw new SevdeskError("steuerregel_id muss eine ganze Zahl sein — siehe booking_accounts.");
  }
  return {
    body: { taxRule: ref("TaxRule", id) },
    gewaehlt:
      args.steuerregel_id === undefined
        ? `taxRule ${id} — nicht mitgegeben, deshalb die Voreinstellung für ` +
          `${smallSettlement ? "Kleinunternehmer" : "Regelbesteuerung"}. Passende Regeln zeigt booking_accounts.`
        : `taxRule ${id}`,
    taxText: String(args.steuertext ?? fallback.text),
  };
}

const rounded = (n: number) => Math.round(n * 100) / 100;

export const writeTools: SevTool[] = [
  {
    name: "create_contact",
    title: "Kontakt anlegen",
    description:
      "Legt einen Kunden, Lieferanten oder Partner an. Entweder 'firma' (dann ist es eine " +
      "Organisation) oder 'vorname'/'nachname' (dann eine Person) — sevdesk entscheidet den " +
      "Typ genau daran. Die Kategorie ist Pflicht und lässt sich später nicht über diesen " +
      "Server ändern.",
    inputSchema: {
      type: "object",
      properties: {
        kategorie: str(`Eine aus: ${Object.keys(CATEGORIES).join(", ")}.`),
        firma: str("Firmenname. Gesetzt = Organisation."),
        vorname: str("Vorname. Nur für Personen."),
        nachname: str("Nachname. Nur für Personen."),
        kundennummer: str("Kunden-/Lieferantennummer. Ohne Angabe vergibt sevdesk selbst."),
        beschreibung: str("Freitext zum Kontakt."),
        ust_id: str("Umsatzsteuer-Identifikationsnummer."),
        steuernummer: str("Steuernummer."),
        iban: str("IBAN des Kontakts."),
        zahlungsziel_tage: int("Standard-Zahlungsziel in Tagen."),
      },
      required: ["kategorie"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const kategorie = String(req<string>(args, "kategorie")).toLowerCase();
      const categoryId = CATEGORIES[kategorie];
      if (!categoryId) {
        throw new SevdeskError(
          `kategorie '${kategorie}' gibt es nicht. Erlaubt: ${Object.keys(CATEGORIES).join(", ")}.`,
        );
      }
      if (!args.firma && !args.nachname) {
        throw new SevdeskError(
          "Entweder 'firma' (Organisation) oder 'nachname' (Person) muss gesetzt sein. " +
            "sevdesk leitet den Kontakttyp genau daraus ab; ohne beides entsteht ein Kontakt ohne Namen.",
        );
      }

      const created = await ctx.sev.call<any>("POST", "/Contact", {
        body: {
          name: args.firma,
          surename: args.vorname,
          familyname: args.nachname,
          customerNumber: args.kundennummer,
          description: args.beschreibung,
          vatNumber: args.ust_id,
          taxNumber: args.steuernummer,
          bankAccount: args.iban,
          defaultTimeToPay: args.zahlungsziel_tage,
          category: ref("Category", categoryId),
        },
      });

      return {
        angelegt: true,
        id: created?.id ?? null,
        kundennummer: created?.customerNumber ?? null,
        name: created?.name || [created?.surename, created?.familyname].filter(Boolean).join(" "),
        kategorie,
        typ: args.firma ? "Firma" : "Person",
      };
    },
  },

  {
    name: "create_part",
    title: "Artikel anlegen",
    description:
      "Legt einen Artikel oder eine Leistung im Stamm an. Die Einheit ist bei sevdesk ein " +
      "eigenes Objekt, für das es keinen Endpunkt zum Nachschlagen gibt — sie wird deshalb " +
      "aus einem vorhandenen Artikel übernommen, oder man gibt einheit_id mit. " +
      "Erlaubte Steuersätze sind 0, 7 und 19.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Artikelname."),
        artikelnummer: str("Artikelnummer. Pflicht bei sevdesk."),
        preis_netto: num("Verkaufspreis netto."),
        einkaufspreis: num("Einkaufspreis."),
        steuersatz: num("0, 7 oder 19."),
        text: str("Beschreibung."),
        lagerbestand: num("Anfangsbestand. Default 0."),
        lager_fuehren: bool("Bestandsführung einschalten."),
        einheit_id: int("ID der Einheit, falls die gelernte nicht passt."),
        interner_kommentar: str("Interner Kommentar — erscheint nicht auf Belegen."),
      },
      required: ["name", "artikelnummer", "steuersatz"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const taxRate = Number(req<number>(args, "steuersatz"));
      if (![0, 7, 19].includes(taxRate)) {
        throw new SevdeskError(
          `steuersatz ${taxRate} lässt sevdesk bei Artikeln nicht zu. Erlaubt sind 0, 7 und 19.`,
        );
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const unityId = needId(defaults, "unityId", args.einheit_id);

      const created = await ctx.sev.call<any>("POST", "/Part", {
        body: {
          name: req<string>(args, "name"),
          partNumber: String(req<string>(args, "artikelnummer")),
          text: args.text,
          taxRate,
          unity: ref("Unity", unityId),
          stock: Number(args.lagerbestand ?? 0),
          stockEnabled: args.lager_fuehren === true,
          priceNet: args.preis_netto,
          price: args.preis_netto,
          pricePurchase: args.einkaufspreis,
          internalComment: args.interner_kommentar,
          status: 100,
        },
      });

      return {
        angelegt: true,
        id: created?.id ?? null,
        nr: created?.partNumber ?? null,
        name: created?.name ?? null,
        preis_netto: money(created?.priceNet ?? created?.price),
        steuersatz: money(created?.taxRate),
        einheit_id: unityId,
        einheit_gelernt_aus: args.einheit_id ? "mitgegeben" : defaults.quelle.join(", "),
      };
    },
  },

  {
    name: "create_invoice",
    title: "Rechnung als Entwurf anlegen",
    description:
      "Legt eine Ausgangsrechnung als ENTWURF an (Status 100). Verschickt oder gebucht wird " +
      "nichts — das bleibt bewusst in sevdesk. sevdesk verlangt beim Anlegen mehrere IDs, " +
      "für die es keinen Endpunkt zum Nachschlagen gibt (Kontaktperson, Einheit, Land); die " +
      "werden aus vorhandenen Belegen des Kontos gelesen. Die Antwort sagt, was tatsächlich " +
      "in der Rechnung gelandet ist — eine verworfene Position meldet sevdesk sonst nicht.",
    inputSchema: {
      type: "object",
      properties: {
        kontakt_id: int("Kunde, an den die Rechnung geht."),
        positionen: {
          type: "array",
          description:
            "Die Rechnungszeilen. Je Zeile: name, menge, einzelpreis, steuersatz " +
            "(0, 7 oder 19), optional text und rabatt (Prozent).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              text: { type: "string" },
              menge: { type: "number" },
              einzelpreis: { type: "number" },
              steuersatz: { type: "number" },
              rabatt: { type: "number" },
            },
            required: ["name", "menge", "einzelpreis", "steuersatz"],
          },
        },
        datum: str("Rechnungsdatum 'YYYY-MM-DD'. Ohne Angabe heute."),
        anschrift: str("Vollständige Anschrift mit Zeilenumbrüchen. Ohne Angabe nimmt sevdesk die des Kontakts."),
        kopftext: str("Text über den Positionen."),
        fusstext: str("Text unter den Positionen."),
        zahlungsziel_tage: int("Zahlungsziel in Tagen."),
        preise_sind: str("'netto' (Default) oder 'brutto' — wie einzelpreis zu verstehen ist."),
        steuerregel_id: int("Steuerregel (sevdesk 2.0). Ohne Angabe die Voreinstellung des Kontos — siehe booking_accounts."),
        steuerart: str("Steuerart (nur sevdesk 1.0): default, eu, noteu, ss."),
        steuertext: str("Text zur Steuerregel, erscheint auf der Rechnung."),
        kontaktperson_id: int("SevUser-ID, falls die gelernte nicht passt."),
        einheit_id: int("Unity-ID, falls die gelernte nicht passt."),
        land_id: int("StaticCountry-ID, falls die gelernte nicht passt."),
        waehrung: str("ISO-4217, z. B. 'EUR'. Ohne Angabe die des Kontos."),
      },
      required: ["kontakt_id", "positionen"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const positionen = req<any[]>(args, "positionen");
      if (!Array.isArray(positionen) || positionen.length === 0) {
        throw new SevdeskError("Eine Rechnung ohne Positionen legt dieser Server nicht an.");
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const contactPersonId = needId(defaults, "contactPersonId", args.kontaktperson_id);
      const unityId = needId(defaults, "unityId", args.einheit_id);
      const countryId = needId(defaults, "countryId", args.land_id);
      const tax = taxFor(defaults.version, defaults.smallSettlement, args);
      const showNet = String(args.preise_sind ?? "netto").toLowerCase() !== "brutto";

      const heute = new Date().toISOString().slice(0, 10);
      const invoiceDate = unixDay(args.datum ?? heute, "datum")!;

      const invoicePosSave = positionen.map((p, i) => {
        const taxRate = Number(p.steuersatz);
        if (!Number.isFinite(taxRate)) {
          throw new SevdeskError(`Position ${i + 1}: steuersatz fehlt oder ist keine Zahl.`);
        }
        return {
          objectName: "InvoicePos",
          mapAll: true,
          name: String(p.name),
          text: p.text,
          quantity: Number(p.menge),
          price: Number(p.einzelpreis),
          taxRate,
          discount: p.rabatt === undefined ? undefined : Number(p.rabatt),
          unity: ref("Unity", unityId),
          positionNumber: i + 1,
        };
      });

      const created = await ctx.sev.call<any>("POST", "/Invoice/Factory/saveInvoice", {
        body: {
          invoice: {
            objectName: "Invoice",
            mapAll: true,
            // Entwurf. sevdesk-Update 2.0 lässt beim Anlegen ohnehin nichts anderes zu.
            status: "100",
            invoiceType: "RE",
            invoiceDate,
            contact: ref("Contact", req<number>(args, "kontakt_id")),
            contactPerson: ref("SevUser", contactPersonId),
            addressCountry: ref("StaticCountry", countryId),
            address: args.anschrift,
            headText: args.kopftext,
            footText: args.fusstext,
            timeToPay: args.zahlungsziel_tage,
            currency: String(args.waehrung ?? defaults.currency),
            discount: 0,
            // Nicht mehr benutzt, aber Pflichtfeld: der Steuersatz steht an den Positionen.
            taxRate: 0,
            taxText: tax.taxText,
            showNet,
            smallSettlement: defaults.smallSettlement ?? undefined,
            ...tax.body,
          },
          // Die Beschreibung nennt als Pflichtfeld "invoicePos", kennt aber nur
          // "invoicePosSave" als Eigenschaft. Gültig ist invoicePosSave.
          invoicePosSave,
        },
      });

      const id = created?.invoice?.id ?? created?.id;
      if (!id) {
        throw new SevdeskError("sevdesk hat auf das Anlegen keine Rechnungs-ID zurückgegeben.", created);
      }

      // Zurücklesen: eine verworfene Position meldet sevdesk nicht.
      const back = await ctx.sev.call<any[]>("GET", "/Invoice/{invoiceId}", {
        path: { invoiceId: id },
      });
      const inv = Array.isArray(back) ? back[0] : back;
      const gelandet = await ctx.sev.call<any[]>("GET", "/Invoice/{invoiceId}/getPositions", {
        path: { invoiceId: id },
        query: { limit: 500 },
      });
      const anzahl = Array.isArray(gelandet) ? gelandet.length : 0;

      return {
        angelegt: true,
        id,
        nr: inv?.invoiceNumber ?? null,
        status: "Entwurf (100) — nicht verschickt, nicht gebucht",
        datum: isoDay(inv?.invoiceDate),
        netto: money(inv?.sumNet),
        steuer: money(inv?.sumTax),
        brutto: money(inv?.sumGross),
        steuerangabe: tax.gewaehlt,
        preise_sind: showNet ? "netto" : "brutto",
        positionen_geschickt: invoicePosSave.length,
        positionen_gespeichert: anzahl,
        ...(anzahl === invoicePosSave.length
          ? {}
          : {
              warnung:
                `Von ${invoicePosSave.length} Positionen sind ${anzahl} in der Rechnung ` +
                `gelandet. sevdesk verwirft ungültige Positionen ohne Fehlermeldung — die ` +
                `Rechnung in sevdesk prüfen.`,
            }),
        ids_verwendet: {
          kontaktperson: contactPersonId,
          einheit: unityId,
          land: countryId,
          gelernt_aus: defaults.quelle,
        },
      };
    },
  },

  {
    name: "create_voucher",
    title: "Eingangsbeleg anlegen",
    description:
      "Legt einen Eingangsbeleg an (Lieferantenrechnung, Quittung, Kassenbon) — als Entwurf " +
      "oder als offen, nie als bezahlt. Jede Position braucht ein Buchungskonto; welche es " +
      "gibt und welche Steuerregeln und -sätze dazu passen, zeigt booking_accounts. Passt " +
      "die Kombination nicht, antwortet sevdesk mit 422. Eine bereits hochgeladene Datei " +
      "lässt sich über 'datei' anhängen.",
    inputSchema: {
      type: "object",
      properties: {
        beschreibung: str("Belegbezeichnung, üblicherweise die Belegnummer des Lieferanten."),
        positionen: {
          type: "array",
          description:
            "Die Buchungszeilen. Je Zeile: konto_id (aus booking_accounts), netto, " +
            "steuersatz, optional kommentar und anlagegut.",
          items: {
            type: "object",
            properties: {
              konto_id: { type: "integer" },
              netto: { type: "number" },
              steuersatz: { type: "number" },
              kommentar: { type: "string" },
              anlagegut: { type: "boolean" },
            },
            required: ["konto_id", "netto", "steuersatz"],
          },
        },
        lieferant_id: int("Kontakt-ID des Lieferanten."),
        lieferant_name: str("Name des Lieferanten, falls es keinen Kontakt gibt."),
        datum: str("Belegdatum 'YYYY-MM-DD'. Ohne Angabe heute."),
        faellig_am: str("Zahlungsziel 'YYYY-MM-DD'."),
        richtung: str("'ausgabe' (Default) oder 'einnahme'."),
        entwurf: bool("true = Status 50 (Entwurf), sonst 100 (offen). Bezahlt geht hier nicht."),
        steuerregel_id: int("Steuerregel (sevdesk 2.0) — aus booking_accounts."),
        steuerart: str("Steuerart (nur sevdesk 1.0): default, eu, noteu, ss."),
        datei: str("Dateiname aus upload_voucher_file, um den Scan anzuhängen."),
      },
      required: ["beschreibung", "positionen"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const positionen = req<any[]>(args, "positionen");
      if (!Array.isArray(positionen) || positionen.length === 0) {
        throw new SevdeskError("Ein Beleg ohne Positionen legt dieser Server nicht an.");
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const tax = taxFor(defaults.version, defaults.smallSettlement, args);
      const neu = defaults.version === "2.0";
      const heute = new Date().toISOString().slice(0, 10);

      const voucherPosSave = positionen.map((p, i) => {
        const netto = Number(p.netto);
        const taxRate = Number(p.steuersatz);
        if (!Number.isFinite(netto)) throw new SevdeskError(`Position ${i + 1}: netto fehlt.`);
        if (!Number.isFinite(taxRate)) throw new SevdeskError(`Position ${i + 1}: steuersatz fehlt.`);
        const kontoId = p.konto_id;
        if (kontoId === undefined || kontoId === null) {
          throw new SevdeskError(
            `Position ${i + 1}: konto_id fehlt. booking_accounts zeigt die erlaubten Konten.`,
          );
        }
        return {
          objectName: "VoucherPos",
          mapAll: true,
          // net = true heißt: sumNet gilt, sumGross wird von sevdesk nachgerechnet.
          net: true,
          taxRate,
          sumNet: rounded(netto),
          sumGross: rounded(netto * (1 + taxRate / 100)),
          comment: p.kommentar,
          isAsset: p.anlagegut === true,
          // Die neue Welt bucht auf accountDatev, die alte auf accountingType.
          ...(neu
            ? { accountDatev: ref("AccountDatev", kontoId) }
            : { accountingType: ref("AccountingType", kontoId) }),
        };
      });

      const created = await ctx.sev.call<any>("POST", "/Voucher/Factory/saveVoucher", {
        body: {
          voucher: {
            objectName: "Voucher",
            mapAll: true,
            voucherType: "VOU",
            // 1000 (bezahlt) ist beim Anlegen nicht vorgesehen — und wäre hier auch falsch.
            status: args.entwurf === true ? 50 : 100,
            creditDebit: String(args.richtung ?? "ausgabe").toLowerCase() === "einnahme" ? "C" : "D",
            description: req<string>(args, "beschreibung"),
            voucherDate: unixDay(args.datum ?? heute, "datum"),
            paymentDeadline: unixDay(args.faellig_am, "faellig_am"),
            supplier: args.lieferant_id ? ref("Contact", args.lieferant_id) : null,
            supplierName: args.lieferant_name,
            ...tax.body,
          },
          voucherPosSave,
          filename: args.datei,
        },
      });

      const id = created?.voucher?.id ?? created?.id;
      if (!id) {
        throw new SevdeskError("sevdesk hat auf das Anlegen keine Beleg-ID zurückgegeben.", created);
      }

      const back = await ctx.sev.call<any[]>("GET", "/Voucher/{voucherId}", {
        path: { voucherId: id },
      });
      const v = Array.isArray(back) ? back[0] : back;
      const gelandet = await ctx.sev.call<any[]>("GET", "/VoucherPos", {
        query: { "voucher[id]": id, "voucher[objectName]": "Voucher", limit: 200 },
      });
      const anzahl = Array.isArray(gelandet) ? gelandet.length : 0;

      return {
        angelegt: true,
        id,
        beschreibung: v?.description ?? null,
        status: args.entwurf === true ? "Entwurf (50)" : "offen (100)",
        art: String(args.richtung ?? "ausgabe").toLowerCase() === "einnahme" ? "Einnahme" : "Ausgabe",
        datum: isoDay(v?.voucherDate),
        netto: money(v?.sumNet),
        steuer: money(v?.sumTax),
        brutto: money(v?.sumGross),
        steuerangabe: tax.gewaehlt,
        datei_angehaengt: args.datei ? true : false,
        positionen_geschickt: voucherPosSave.length,
        positionen_gespeichert: anzahl,
        ...(anzahl === voucherPosSave.length
          ? {}
          : {
              warnung:
                `Von ${voucherPosSave.length} Positionen sind ${anzahl} im Beleg gelandet. ` +
                `Das passiert, wenn Konto, Steuerregel und Steuersatz nicht zusammenpassen — ` +
                `booking_accounts zeigt die erlaubten Kombinationen.`,
            }),
      };
    },
  },

  {
    name: "upload_voucher_file",
    title: "Belegdatei hochladen",
    description:
      "Lädt einen Scan oder ein PDF in den Zwischenspeicher von sevdesk. Der zurückgegebene " +
      "Dateiname gehört anschließend als 'datei' in create_voucher — erst dadurch hängt die " +
      "Datei am Beleg. Ohne diesen zweiten Schritt verfällt der Upload.",
    inputSchema: {
      type: "object",
      properties: {
        dateiname: str("Dateiname mit Endung, z. B. 'rechnung-4711.pdf'."),
        inhalt_base64: str("Der Dateiinhalt als base64."),
        mime_type: str("z. B. 'application/pdf' oder 'image/jpeg'. Default application/pdf."),
      },
      required: ["dateiname", "inhalt_base64"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const name = String(req<string>(args, "dateiname"));
      const b64 = String(req<string>(args, "inhalt_base64")).replace(/\s+/g, "");
      let bytes: Uint8Array;
      try {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        throw new SevdeskError("inhalt_base64 ist kein gültiges base64.");
      }

      const form = new FormData();
      form.append("file", new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }), name);
      const res = await ctx.sev.call<any>("POST", "/Voucher/Factory/uploadTempFile", { form });

      return {
        hochgeladen: true,
        datei: res?.filename ?? null,
        seiten: res?.pages ?? null,
        mime_type: res?.mimeType ?? null,
        naechster_schritt:
          "Diesen Dateinamen als 'datei' an create_voucher übergeben — sonst bleibt der " +
          "Upload im Zwischenspeicher liegen und verfällt.",
      };
    },
  },
];
