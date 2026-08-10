/**
 * Die FLOWWER-Tools.
 *
 * Was verifiziert ist (aus hilfe.flowwer.de): der Auth-Header, `POST /api/v1/upload`,
 * `GET|PUT /api/v1/documents/{id}/receiptsplits` und das OData-Reporting mit den
 * Collections `Documents` und `DocumentsWithReceiptSplits`.
 *
 * Was NICHT öffentlich dokumentiert ist: die Pfade der Find-API und des Archiv-Imports.
 * Sie stehen nur im Swagger des jeweiligen Kontos. Dieser Server rät sie deshalb nicht,
 * sondern liest die Spezifikation des Mandanten und sagt, was dort angeboten wird
 * ('api_erkunden'). Ein geratener Pfad, der still 404t, wäre schlimmer als kein Tool.
 *
 * Geschrieben wird nur, was neu ist: Hochladen. `PUT receiptsplits` ersetzt bestehende
 * Aufteilungen und bleibt deshalb draußen — dieselbe Linie wie bei HERO und Lexware.
 */
import { FlowwerError } from "./client";
import { getSchema, resolveEntity, resolveField, condition, type Comparison } from "./odata";
import { type FlowwerTool, type ToolContext, str, int, req } from "./context";

const MAX_ROWS = 500;
const clamp = (n: unknown, def: number) =>
  Math.min(MAX_ROWS, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : def));

/** Die Collection, in der die Dokumente stehen. */
const DOCS = "Documents";
const SPLITS = "DocumentsWithReceiptSplits";

const FILTER_SCHEMA = {
  type: "array",
  description:
    "Zusätzliche Bedingungen. Feldnamen kommen aus felder_auflisten; ein unbekanntes Feld " +
    "wird abgelehnt, statt einen unverständlichen 400er zu erzeugen.",
  items: {
    type: "object",
    properties: {
      feld: { type: "string", description: "Feldname aus felder_auflisten." },
      operator: {
        type: "string",
        description: "eq, ne, gt, ge, lt, le, contains oder startswith. Default eq.",
      },
      wert: { type: "string", description: "Vergleichswert." },
    },
    required: ["feld", "wert"],
    additionalProperties: false,
  },
};

const OPS: Comparison[] = ["eq", "ne", "gt", "ge", "lt", "le", "contains", "startswith"];

/** Baut den $filter-Ausdruck aus den bequemen Argumenten plus freien Bedingungen. */
function buildFilter(
  fields: Record<string, string>,
  args: Record<string, any>,
  extra: Array<[string, Comparison, string | number]> = [],
): string | undefined {
  const parts: string[] = [];
  for (const [feld, op, wert] of extra) parts.push(condition(fields, feld, op, wert));

  for (const f of (args.filter ?? []) as any[]) {
    if (!f?.feld || f.wert === undefined) {
      throw new FlowwerError("Jede Bedingung braucht 'feld' und 'wert'.");
    }
    const op = (f.operator ?? "eq") as Comparison;
    if (!OPS.includes(op)) {
      throw new FlowwerError(`Operator '${op}' gibt es nicht. Erlaubt: ${OPS.join(", ")}`);
    }
    parts.push(condition(fields, f.feld, op, f.wert));
  }
  return parts.length ? parts.join(" and ") : undefined;
}

/** Eine OData-Abfrage ausführen und das Ergebnis vereinheitlichen. */
async function query(
  ctx: ToolContext,
  set: string,
  params: { filter?: string; select?: string; orderby?: string; top: number },
) {
  const data = await ctx.flw.json<any>(`/odata/reporting/${set}`, {
    query: {
      $filter: params.filter,
      $select: params.select,
      $orderby: params.orderby,
      $top: params.top,
      $count: "true",
    },
  });
  const rows: any[] = data?.value ?? (Array.isArray(data) ? data : []);
  const gesamt = data?.["@odata.count"] ?? null;
  return {
    zeilen: rows,
    anzahl: rows.length,
    gesamt_treffer: gesamt,
    abgeschnitten: rows.length >= params.top,
    abfrage: { collection: set, ...params },
  };
}

export const tools: FlowwerTool[] = [
  {
    name: "felder_auflisten",
    title: "Verfügbare Felder",
    description:
      "Zeigt, welche Collections und Felder das Reporting DIESES Kontos hat, samt Typ. " +
      "FLOWWER dokumentiert das nicht öffentlich — die Liste kommt aus dem $metadata des " +
      "Kontos. Erster Aufruf, bevor gefiltert oder ausgewertet wird.",
    inputSchema: {
      type: "object",
      properties: {
        collection: str("Nur diese Collection zeigen, z. B. 'Documents'. Leer = alle."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      if (args.collection) {
        const e = resolveEntity(schema, String(args.collection));
        return { collection: e.set, anzahl_felder: Object.keys(e.fields).length, felder: e.fields };
      }
      return {
        collections: schema.entitySets,
        entitaeten: Object.fromEntries(
          Object.entries(schema.entities).map(([name, e]) => [name, e.fields]),
        ),
      };
    },
  },

  {
    name: "dokumente_suchen",
    title: "Dokumente suchen",
    description:
      "Sucht Rechnungen und Belege im Reporting. Die bequemen Argumente (lieferant, " +
      "stufe, datum_von/bis) werden auf die Felder dieses Kontos abgebildet; alles Weitere " +
      "geht über 'filter'. Ohne Einschränkung kommen die neuesten Dokumente.",
    inputSchema: {
      type: "object",
      properties: {
        lieferant: str("Lieferantenname, Teiltreffer genügt (Feld supplierName)."),
        rechnungsnummer: str("Rechnungsnummer (Feld invoiceNumber)."),
        stufe: str("Aktuelle Workflow-Stufe (Feld currentStage) — exakter Wert."),
        zahlungsstatus: str("Zahlungsstatus (Feld paymentState) — exakter Wert."),
        datum_von: str("Rechnungsdatum ab 'YYYY-MM-DD' (Feld invoiceDate)."),
        datum_bis: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        filter: FILTER_SCHEMA,
        felder: str("Komma-Liste der zurückzugebenden Felder. Leer = alle."),
        sortierung: str("z. B. 'invoiceDate desc'. Default: neueste zuerst."),
        limit: int("Maximale Zeilenzahl (1–500, Default 50)."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      const e = resolveEntity(schema, DOCS);

      const extra: Array<[string, Comparison, string]> = [];
      if (args.lieferant) extra.push(["supplierName", "contains", String(args.lieferant)]);
      if (args.rechnungsnummer) extra.push(["invoiceNumber", "eq", String(args.rechnungsnummer)]);
      if (args.stufe) extra.push(["currentStage", "eq", String(args.stufe)]);
      if (args.zahlungsstatus) extra.push(["paymentState", "eq", String(args.zahlungsstatus)]);
      if (args.datum_von) extra.push(["invoiceDate", "ge", String(args.datum_von)]);
      if (args.datum_bis) extra.push(["invoiceDate", "le", String(args.datum_bis)]);

      const select = args.felder
        ? String(args.felder)
            .split(",")
            .map((f) => resolveField(e.fields, f.trim()))
            .join(",")
        : undefined;

      let orderby: string | undefined = args.sortierung ? String(args.sortierung) : undefined;
      if (orderby) {
        const [f, dir] = orderby.split(/\s+/);
        orderby = `${resolveField(e.fields, f)}${dir ? ` ${dir.toLowerCase() === "desc" ? "desc" : "asc"}` : ""}`;
      } else if (e.fields.invoiceDate) {
        orderby = "invoiceDate desc";
      }

      return query(ctx, e.set, {
        filter: buildFilter(e.fields, args, extra),
        select,
        orderby,
        top: clamp(args.limit, 50),
      });
    },
  },

  {
    name: "auswertung",
    title: "Summen und Gruppierung",
    description:
      "Zählt und summiert über die Dokumente — z. B. Rechnungssummen je Lieferant oder je " +
      "Workflow-Stufe. Die Gruppierung rechnet dieser Server aus den geholten Zeilen; " +
      "wenn dafür nicht alle Zeilen gereicht haben, steht das im Ergebnis.",
    inputSchema: {
      type: "object",
      properties: {
        gruppiere_nach: str("Feld, nach dem gruppiert wird, z. B. 'supplierName' oder 'currentStage'."),
        summiere: str("Zahlenfeld, das summiert wird, z. B. 'amountGross'. Leer = nur zählen."),
        collection: str(`'${DOCS}' (Default) oder '${SPLITS}' für Belegaufteilungen.`),
        datum_von: str("Rechnungsdatum ab 'YYYY-MM-DD'."),
        datum_bis: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        filter: FILTER_SCHEMA,
        limit: int("Maximal zu ladende Zeilen (1–500, Default 500)."),
      },
      required: ["gruppiere_nach"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      const e = resolveEntity(schema, String(args.collection ?? DOCS));
      const gruppe = resolveField(e.fields, req<string>(args, "gruppiere_nach"));
      const summe = args.summiere ? resolveField(e.fields, String(args.summiere)) : null;

      const extra: Array<[string, Comparison, string]> = [];
      if (args.datum_von) extra.push(["invoiceDate", "ge", String(args.datum_von)]);
      if (args.datum_bis) extra.push(["invoiceDate", "le", String(args.datum_bis)]);

      const res = await query(ctx, e.set, {
        filter: buildFilter(e.fields, args, extra),
        select: [gruppe, summe].filter(Boolean).join(","),
        top: clamp(args.limit, MAX_ROWS),
      });

      const gruppen: Record<string, { anzahl: number; summe: number }> = {};
      for (const z of res.zeilen) {
        const k = String(z[gruppe] ?? "(ohne Angabe)");
        const g = (gruppen[k] ??= { anzahl: 0, summe: 0 });
        g.anzahl++;
        if (summe) g.summe = Math.round((g.summe + (Number(z[summe]) || 0)) * 100) / 100;
      }
      const sortiert = Object.entries(gruppen)
        .sort((a, b) => (summe ? b[1].summe - a[1].summe : b[1].anzahl - a[1].anzahl))
        .map(([wert, g]) => ({ wert, anzahl: g.anzahl, ...(summe ? { summe: g.summe } : {}) }));

      return {
        gruppiert_nach: gruppe,
        summiert: summe,
        zeilen_geladen: res.anzahl,
        gesamt_treffer: res.gesamt_treffer,
        abgeschnitten: res.abgeschnitten,
        ...(res.abgeschnitten
          ? {
              warnung:
                "Es gab mehr Zeilen als geladen wurden — die Summen sind unvollständig. " +
                "Zeitraum eingrenzen oder limit erhöhen.",
            }
          : {}),
        gruppen: sortiert,
      };
    },
  },

  {
    name: "belegaufteilungen_lesen",
    title: "Belegaufteilungen",
    description:
      "Die Kontierung eines Dokuments: Konto, Kostenstelle, Kostenträger, Netto, Steuer, " +
      "Brutto je Aufteilungszeile. Ergänzt wird sie um die Kopfdaten des Dokuments.",
    inputSchema: {
      type: "object",
      properties: { document_id: str("Die documentId aus dokumente_suchen.") },
      required: ["document_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req<string>(args, "document_id");
      return ctx.flw.json(`/api/v1/documents/${encodeURIComponent(id)}/receiptsplits`);
    },
  },

  {
    name: "api_erkunden",
    title: "Was kann dieses Konto?",
    description:
      "Liest die OpenAPI-Beschreibung des Kontos und listet, welche Endpunkte es wirklich " +
      "anbietet. FLOWWER dokumentiert öffentlich nur einen Teil — Find-API und " +
      "Archiv-Import/-Export gibt es je nach Konto und Freischaltung. Dieses Tool sagt, " +
      "was da ist, statt Pfade zu raten.",
    inputSchema: {
      type: "object",
      properties: { suche: str("Nur Endpunkte, die diesen Text enthalten.") },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      // Übliche Ablageorte einer OpenAPI-Beschreibung, in absteigender Wahrscheinlichkeit.
      const kandidaten = [
        "/swagger/v1/swagger.json",
        "/swagger/v1.0/swagger.json",
        "/swagger.json",
        "/api/swagger.json",
        "/openapi.json",
      ];
      const versucht: string[] = [];
      for (const pfad of kandidaten) {
        versucht.push(pfad);
        const res = await ctx.flw.request(pfad);
        if (!res.ok) continue;
        let spec: any;
        try {
          spec = JSON.parse(await res.text());
        } catch {
          continue;
        }
        if (!spec?.paths) continue;

        const suche = args.suche ? String(args.suche).toLowerCase() : null;
        const ops: Array<{ methode: string; pfad: string; zweck?: string }> = [];
        for (const [pf, methoden] of Object.entries<any>(spec.paths)) {
          for (const [m, op] of Object.entries<any>(methoden)) {
            if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
            const zeile = { methode: m.toUpperCase(), pfad: pf, zweck: op?.summary ?? undefined };
            const hay = `${pf} ${op?.summary ?? ""} ${op?.operationId ?? ""}`.toLowerCase();
            if (!suche || hay.includes(suche)) ops.push(zeile);
          }
        }
        ops.sort((a, b) => a.pfad.localeCompare(b.pfad) || a.methode.localeCompare(b.methode));
        return {
          quelle: pfad,
          titel: spec.info?.title ?? null,
          version: spec.info?.version ?? null,
          anzahl: ops.length,
          endpunkte: ops,
          hinweis:
            "Dieser Server bedient davon nur die dokumentierten Endpunkte. Wird hier etwas " +
            "gebraucht, das noch kein Tool hat, lässt es sich ergänzen.",
        };
      }
      throw new FlowwerError(
        `Unter https://${ctx.flw.account}.flowwer.de wurde keine OpenAPI-Beschreibung gefunden. ` +
          `Versucht: ${versucht.join(", ")}. Die Swagger-Oberfläche liegt laut FLOWWER unter ` +
          `/swagger — dort steht, unter welchem Pfad die Beschreibung ausgeliefert wird.`,
      );
    },
  },

  {
    name: "dokument_hochladen",
    title: "Dokument hochladen",
    description:
      "Lädt eine Rechnung oder einen Beleg nach FLOWWER hoch; dort startet damit der " +
      "Freigabe-Workflow. Inhalt als url (wird geladen) oder als content_base64. " +
      "Anlegen ja — ändern oder löschen kann dieser Server nichts.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung, z. B. 'rechnung.pdf'."),
        url: str("Öffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url."),
      },
      required: ["filename"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const filename = req<string>(args, "filename");
      const hasUrl = Boolean(args.url);
      const hasB64 = Boolean(args.content_base64);
      if (hasUrl === hasB64) throw new FlowwerError("Genau eins angeben: url ODER content_base64.");

      let bytes: Uint8Array;
      if (hasUrl) {
        const res = await fetch(String(args.url));
        if (!res.ok) throw new FlowwerError(`Datei nicht ladbar: HTTP ${res.status} von ${args.url}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
        let bin: string;
        try {
          bin = atob(raw);
        } catch {
          throw new FlowwerError("content_base64 ist kein gültiges Base64.");
        }
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (bytes.byteLength > 20_000_000) throw new FlowwerError("Datei größer als 20 MB.");

      const form = new FormData();
      form.set("file", new Blob([bytes]), filename);

      const res = await ctx.flw.request("/api/v1/upload", { method: "POST", form });
      const text = await res.text();
      if (!res.ok) {
        throw new FlowwerError(`Upload abgelehnt (HTTP ${res.status}).`, text.slice(0, 500));
      }
      let antwort: unknown = text;
      try {
        antwort = JSON.parse(text);
      } catch {
        /* Manche Endpunkte antworten mit reinem Text — dann eben Text. */
      }
      return { filename, bytes: bytes.byteLength, antwort };
    },
  },
];
