/**
 * Die Pflichtangaben, die sevdesk beim Anlegen verlangt, aber nirgends zum Nachschlagen
 * anbietet.
 *
 * Ein Beleg braucht `contactPerson` (ein SevUser), eine Position braucht `unity` (eine
 * Einheit), eine Rechnung braucht `addressCountry` (ein Land). Für keines dieser drei
 * Objekte gibt es einen dokumentierten Endpunkt — es existiert kein `/SevUser`, kein
 * `/Unity`, kein `/StaticCountry` in der API-Beschreibung. Wer trotzdem anlegen will, hat
 * zwei Möglichkeiten: undokumentierte Pfade raten oder die IDs aus etwas nehmen, das es
 * schon gibt.
 *
 * Hier wird das Zweite gemacht: aus dem neuesten vorhandenen Beleg des Kontos werden die
 * IDs mit `embed` mitgelesen. Das sind ausschließlich dokumentierte GETs, und die Werte
 * stammen aus genau dem Mandanten, in den geschrieben wird — nichts ist geraten.
 *
 * Gilt das Konto als frisch (kein einziger Beleg, kein Artikel), fehlt die Grundlage. Dann
 * wird das gesagt, statt eine ID zu erfinden.
 *
 * Zwischengespeichert wird pro Zugang für 12 Stunden, wie bei HERO die Mandanten-IDs.
 */
import { Sevdesk, SevdeskError } from "./client";
import { sha256hex } from "../../../shared/src/crypto";

const TTL_SECONDS = 12 * 60 * 60;

export interface AccountDefaults {
  /** Buchhaltungswelt: "2.0" kennt taxRule, "1.0" noch taxType. */
  version: string;
  contactPersonId: string | null;
  unityId: string | null;
  countryId: string | null;
  smallSettlement: boolean | null;
  currency: string;
  /** Woher die IDs stammen — gehört in jede Antwort, die darauf aufbaut. */
  quelle: string[];
}

function idOf(value: unknown): string | null {
  if (value && typeof value === "object" && "id" in (value as any)) {
    const id = (value as any).id;
    return id === undefined || id === null ? null : String(id);
  }
  return null;
}

async function learn(sev: Sevdesk): Promise<AccountDefaults> {
  const version = (await sev.call<any>("GET", "/Tools/bookkeepingSystemVersion"))?.version ?? "";
  const quelle: string[] = [];
  const out: AccountDefaults = {
    version: String(version),
    contactPersonId: null,
    unityId: null,
    countryId: null,
    smallSettlement: null,
    currency: "EUR",
    quelle,
  };

  // Neueste Rechnung: liefert contactPerson, addressCountry, currency, smallSettlement.
  const invoices = await sev.call<any[]>("GET", "/Invoice", {
    query: { limit: 1, embed: "contactPerson,addressCountry" },
  });
  const invoice = Array.isArray(invoices) ? invoices[0] : null;
  if (invoice) {
    out.contactPersonId = idOf(invoice.contactPerson);
    out.countryId = idOf(invoice.addressCountry);
    if (invoice.currency) out.currency = String(invoice.currency);
    if (invoice.smallSettlement !== undefined) {
      out.smallSettlement = invoice.smallSettlement === true || invoice.smallSettlement === "1";
    }
    quelle.push(`Rechnung ${invoice.invoiceNumber ?? invoice.id}`);
  }

  // Fehlt die Kontaktperson noch, hilft ein Auftrag — dieselben Pflichtfelder.
  if (!out.contactPersonId) {
    const orders = await sev.call<any[]>("GET", "/Order", {
      query: { limit: 1, embed: "contactPerson,addressCountry" },
    });
    const order = Array.isArray(orders) ? orders[0] : null;
    if (order) {
      out.contactPersonId = idOf(order.contactPerson);
      out.countryId ??= idOf(order.addressCountry);
      quelle.push(`Auftrag ${order.orderNumber ?? order.id}`);
    }
  }

  // Einheit: aus einem Artikel, sonst aus einer Rechnungsposition.
  const parts = await sev.call<any[]>("GET", "/Part", { query: { limit: 1, embed: "unity" } });
  const part = Array.isArray(parts) ? parts[0] : null;
  if (part && idOf(part.unity)) {
    out.unityId = idOf(part.unity);
    quelle.push(`Artikel ${part.partNumber ?? part.id}`);
  } else {
    const pos = await sev.call<any[]>("GET", "/InvoicePos", { query: { limit: 1, embed: "unity" } });
    const first = Array.isArray(pos) ? pos[0] : null;
    if (first && idOf(first.unity)) {
      out.unityId = idOf(first.unity);
      quelle.push("Rechnungsposition");
    }
  }

  return out;
}

/** Gelernte Vorgaben, 12 Stunden zwischengespeichert. */
export async function accountDefaults(
  sev: Sevdesk,
  kv: KVNamespace,
  salt: string,
): Promise<AccountDefaults> {
  const key = `sevdefaults:${await sha256hex(salt)}`;
  const cached = await kv.get<AccountDefaults>(key, "json");
  if (cached) return cached;
  const fresh = await learn(sev);
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: TTL_SECONDS });
  return fresh;
}

/**
 * Eine gelernte ID holen — oder sagen, was fehlt und warum. Ein `null` weiterzureichen
 * würde sevdesk mit 422 quittieren, und die Meldung von dort erklärt nichts.
 */
export function needId(
  defaults: AccountDefaults,
  field: "contactPersonId" | "unityId" | "countryId",
  override: string | number | undefined,
): string {
  if (override !== undefined && override !== null && override !== "") return String(override);
  const value = defaults[field];
  if (value) return value;

  const hinweis: Record<typeof field, string> = {
    contactPersonId:
      "Kontaktperson (SevUser). sevdesk hat keinen Endpunkt, der Benutzer auflistet — " +
      "die ID wird sonst aus der neuesten Rechnung oder dem neuesten Auftrag gelesen. " +
      "Dieses Konto hat weder das eine noch das andere.",
    unityId:
      "Einheit (Unity). sevdesk hat keinen Endpunkt, der Einheiten auflistet — die ID wird " +
      "sonst aus einem vorhandenen Artikel oder einer Rechnungsposition gelesen. " +
      "Dieses Konto hat weder das eine noch das andere.",
    countryId:
      "Land (StaticCountry). sevdesk hat keinen Endpunkt, der Länder auflistet — die ID wird " +
      "sonst aus der neuesten Rechnung gelesen. Dieses Konto hat keine.",
  };

  throw new SevdeskError(
    `Es fehlt die ${hinweis[field]} Entweder in sevdesk einmal von Hand einen solchen Beleg ` +
      `anlegen, oder die ID hier direkt mitgeben.`,
  );
}
