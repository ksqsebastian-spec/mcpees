/**
 * Indexfelder füllen — die Schreibrichtung.
 *
 * Beim Ablegen verlangt DocuWare je Feld ein Tripel:
 *
 *   { "FieldName": "BELEGNR", "Item": "4711", "ItemElementName": "String" }
 *
 * `ItemElementName` sagt, wie der Wert zu lesen ist. Die Wahl richtet sich hier nach der
 * Gestalt des Werts, nicht nach dem Feldtyp — genau so macht es die Python-Bibliothek, an
 * der sich dieser Server orientiert, und das ist die einzige Variante, für die es Belege
 * aus dem Betrieb gibt. Der Feldtyp aus dem Dialog wird trotzdem gelesen, aber nur zum
 * Prüfen: Text in ein Zahlenfeld und Buchstabensalat in ein Datumsfeld fliegen hier auf,
 * bevor ein Request rausgeht.
 *
 * Eine Unsicherheit bleibt und wird nicht wegdiskutiert: für Datumsfelder schickt die
 * Vorlage `DateTime` samt ISO-Wert, auch wenn das Feld nur ein Datum führt. Eine eigene
 * Kennung `Date` wäre naheliegend, ist aber nirgends belegt — deshalb bleibt es bei dem,
 * was nachweislich funktioniert.
 */
import { DocuwareError } from "./client";
import type { CabinetDetail, FieldInfo } from "./structure";
import { findField } from "./structure";

export interface FieldTriple {
  FieldName: string;
  Item: unknown;
  ItemElementName: string;
}

const IST_DATUM = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;

function pruefeTyp(feld: FieldInfo, value: unknown): void {
  const typ = feld.type.toLowerCase();
  const s = String(value);

  if (/^(date|datetime)$/.test(typ) && !(value instanceof Date) && !IST_DATUM.test(s)) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) ist ein Datumsfeld; '${s}' ist kein Datum. ` +
        `Erwartet wird 'YYYY-MM-DD' oder 'YYYY-MM-DD HH:MM'.`,
    );
  }
  if (/^(numeric|int|decimal|number)$/.test(typ) && !Number.isFinite(Number(value))) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) ist ein Zahlenfeld; '${s}' ist keine Zahl.`,
    );
  }
  if (
    feld.length !== null &&
    /^(text|memo|string)$/.test(typ) &&
    typeof value === "string" &&
    value.length > feld.length
  ) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) fasst ${feld.length} Zeichen, der Wert hat ${value.length}. ` +
        `DocuWare würde ihn abschneiden, statt das zu melden.`,
    );
  }
}

/** Ein einzelnes Feld in das Tripel übersetzen, das DocuWare erwartet. */
export function toTriple(feld: FieldInfo, value: unknown): FieldTriple {
  const typ = feld.type.toLowerCase();

  if (value === null || value === undefined) {
    // Ein leeres Feld ist ein leerer Text — eine eigene „nichts"-Kennung gibt es nicht.
    return { FieldName: feld.id, Item: null, ItemElementName: "String" };
  }

  if (Array.isArray(value)) {
    if (!/keyword/.test(typ)) {
      throw new DocuwareError(
        `${feld.id} (${feld.label}) ist kein Stichwortfeld (${feld.type}); eine Liste passt ` +
          `dort nicht hinein.`,
      );
    }
    return {
      FieldName: feld.id,
      Item: { Keyword: value.map((v) => String(v)) },
      ItemElementName: "Keywords",
    };
  }

  pruefeTyp(feld, value);

  if (value instanceof Date) {
    return { FieldName: feld.id, Item: value.toISOString(), ItemElementName: "DateTime" };
  }
  if (/^(date|datetime)$/.test(typ)) {
    return {
      FieldName: feld.id,
      Item: String(value).replace(" ", "T"),
      ItemElementName: "DateTime",
    };
  }
  if (typeof value === "number") {
    return {
      FieldName: feld.id,
      Item: value,
      ItemElementName: Number.isInteger(value) ? "Int" : "Decimal",
    };
  }
  if (/^(numeric|int|decimal|number)$/.test(typ)) {
    const n = Number(value);
    return {
      FieldName: feld.id,
      Item: n,
      ItemElementName: Number.isInteger(n) ? "Int" : "Decimal",
    };
  }
  return { FieldName: feld.id, Item: String(value), ItemElementName: "String" };
}

/**
 * `{ feld: wert }` in die Feldliste übersetzen.
 *
 * Ein Feld, das der Ablagedialog gar nicht führt, wird hier abgewiesen. DocuWare nimmt
 * solche Angaben zwar entgegen, legt aber ab, ohne sie zu schreiben — der Beleg landet im
 * Schrank und das Feld ist leer, ohne dass irgendwo ein Fehler steht.
 */
export function toFieldList(
  detail: CabinetDetail,
  werte: Record<string, unknown>,
): FieldTriple[] {
  const out: FieldTriple[] = [];
  for (const [name, value] of Object.entries(werte ?? {})) {
    const feld = findField(detail, name);
    if (detail.storeDialog && !feld.in.includes("ablage")) {
      const moeglich = detail.fields
        .filter((f) => f.in.includes("ablage"))
        .map((f) => `${f.id} (${f.label})`)
        .join(", ");
      throw new DocuwareError(
        `${feld.id} (${feld.label}) steht nicht im Ablagedialog von ` +
          `'${detail.cabinet.name}' und würde beim Ablegen stillschweigend verfallen. ` +
          `Füllbar sind: ${moeglich || "keine"}.`,
      );
    }
    out.push(toTriple(feld, value));
  }
  return out;
}
