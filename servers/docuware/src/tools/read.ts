/**
 * Lesende Tools. Alle mit readOnlyHint — sie können nichts verändern.
 *
 * Der rote Faden ist immer derselbe: erst wissen, was es gibt (`file_cabinets`), dann
 * wissen, wonach sich fragen lässt (`index_fields`), dann suchen. Wer diese Reihenfolge
 * überspringt, rät Feldnamen — und DocuWare antwortet auf einen geratenen Feldnamen mit
 * 400 und ohne Hinweis, welcher es hätte sein sollen.
 */
import { DocuwareError, dwDate, link, links } from "../client";
import { structure, findCabinet, cabinetDetail, findField } from "../structure";
import { runSearch, fieldValue, rowFields } from "../search";
import { createFileLink } from "../files";
import { type DwTool, str, int, bool, req } from "../context";

/** Wie viele Treffer eine Suche höchstens einsammelt, wenn nichts anderes gesagt wird. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const limitOf = (args: Record<string, any>, fallback = DEFAULT_LIMIT) =>
  Math.min(MAX_LIMIT, Math.max(1, Number(args.limit) || fallback));

/** Ein Anhang („Section") lesbar machen. */
function attachmentRow(section: any) {
  return {
    id: section?.Id ?? null,
    dateiname: section?.OriginalFileName ?? null,
    typ: section?.ContentType ?? null,
    groesse_bytes: section?.FileSize ?? null,
    seiten: section?.PageCount ?? null,
    geaendert: dwDate(section?.ContentModified, true),
    hat_anmerkungen: section?.HasTextAnnotation ?? null,
  };
}

/** Aus einem TextShot den reinen Text machen — Seiten mit Seitenumbruch getrennt. */
export function textshotToText(shot: any): string {
  const asList = (v: unknown): any[] => (Array.isArray(v) ? v : v ? [v] : []);

  const zeile = (ln: any): string =>
    asList(ln?.Items)
      .filter((w) => w?.$type === "Word" && w?.Value)
      .map((w) => String(w.Value))
      .join(" ");

  const zone = (z: any): string => {
    if (z?.$type === "TextZone") return asList(z?.Ln).map(zeile).join("\n");
    // Eine Tabellenzone trägt ihre Zellen unter Cz, jede mit einer eigenen TextZone darin.
    if (z?.$type === "TableZone") {
      return asList(z?.Cz)
        .map((c) => (c?.TextZone ? asList(c.TextZone?.Ln).map(zeile).join("\n") : ""))
        .filter(Boolean)
        .join("\n");
    }
    return "";
  };

  return asList(shot?.Pages)
    .map((p) => asList(p?.Items).map(zone).filter(Boolean).join("\n"))
    .join("\n\n");
}

export const readTools: DwTool[] = [
  {
    name: "system_info",
    title: "Installation und Anmeldung",
    description:
      "Zeigt, mit welcher DocuWare-Installation gesprochen wird: Version, Organisation, " +
      "wie viele Aktenschränke und Briefkörbe sichtbar sind und mit welcher Anmeldeart der " +
      "Zugang läuft (Benutzerkonto oder App-Registrierung). Guter erster Aufruf — er sagt " +
      "auch, ob der Zugang überhaupt etwas sieht: In DocuWare hängen die Rechte am " +
      "Benutzer, ein Schrank ohne Berechtigung taucht hier gar nicht erst auf.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const schraenke = struct.cabinets.filter((c) => !c.isBasket);
      const koerbe = struct.cabinets.filter((c) => c.isBasket);
      return {
        docuware_version: struct.version,
        organisation: struct.organizationName,
        organisation_id: struct.organizationId,
        aktenschraenke: schraenke.length,
        briefkoerbe: koerbe.length,
        anmeldeart:
          ctx.dw.grant === "client_credentials"
            ? "App-Registrierung (Client-ID und Secret)"
            : "Benutzerkonto (Benutzername und Passwort)",
        hinweis:
          schraenke.length === 0
            ? "Dieser Zugang sieht keinen einzigen Aktenschrank. Die Rechte dafür werden in " +
              "DocuWare selbst vergeben."
            : "Weiter mit 'file_cabinets', dann 'index_fields' für den gewünschten Schrank.",
      };
    },
  },

  {
    name: "file_cabinets",
    title: "Aktenschränke und Briefkörbe",
    description:
      "Listet alle Aktenschränke und Briefkörbe, die dieser Zugang sehen darf. Ein " +
      "Aktenschrank ist das Archiv, ein Briefkorb der Posteingang davor — beide kommen bei " +
      "DocuWare aus derselben Liste, meinen aber Verschiedenes. Gesucht wird in " +
      "Aktenschränken; ein Briefkorb hat in der Regel keinen Suchdialog. " +
      "Alle anderen Tools nehmen den Namen oder die Id von hier.",
    inputSchema: {
      type: "object",
      properties: {
        mit_briefkoerben: bool("Briefkörbe mit auflisten. Default true."),
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const mitKoerben = args.mit_briefkoerben !== false;
      return {
        organisation: struct.organizationName,
        schraenke: struct.cabinets
          .filter((c) => mitKoerben || !c.isBasket)
          .map((c) => ({
            id: c.id,
            name: c.name,
            art: c.isBasket ? "Briefkorb" : "Aktenschrank",
          })),
      };
    },
  },

  {
    name: "index_fields",
    title: "Indexfelder eines Aktenschranks",
    description:
      "Zeigt die Indexfelder eines Aktenschranks: den Namen, den die API will (z. B. " +
      "DOCDATE), den Namen, den der Benutzer in DocuWare sieht (z. B. Belegdatum), den " +
      "Feldtyp und die Länge. Vor jeder Suche und vor jedem Ablegen aufrufen — der " +
      "Anzeigename allein hilft der API nicht, und ein geratener Feldname endet in einem " +
      "400 ohne Erklärung. 'in' sagt, wofür ein Feld taugt: 'suche' heißt, man kann danach " +
      "filtern, 'ablage' heißt, man kann es beim Ablegen füllen.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
      },
      required: ["aktenschrank"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      return {
        aktenschrank: cab.name,
        art: cab.isBasket ? "Briefkorb" : "Aktenschrank",
        suchdialog: detail.searchDialog?.name ?? null,
        ablagedialog: detail.storeDialog?.name ?? null,
        felder: detail.fields.map((f) => ({
          feld: f.id,
          bezeichnung: f.label,
          typ: f.type,
          laenge: f.length,
          hat_auswahlliste: Boolean(f.selectList),
          in: f.in,
        })),
      };
    },
  },

  {
    name: "field_values",
    title: "Werte einer Auswahlliste",
    description:
      "Liefert die erlaubten Werte eines Indexfelds, das in DocuWare eine Auswahlliste hat " +
      "(z. B. Dokumentart oder Firma). Nützlich, bevor man danach filtert: ein Wert, den es " +
      "in der Liste nicht gibt, liefert schlicht keine Treffer — und das sieht aus wie ein " +
      "leeres Archiv statt wie ein Tippfehler. Felder ohne Auswahlliste erkennt man in " +
      "'index_fields' an hat_auswahlliste=false.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        feld: str("Feldname oder Bezeichnung, z. B. 'DOCTYPE' oder 'Dokumentart'."),
      },
      required: ["aktenschrank", "feld"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      const feld = findField(detail, req<string>(args, "feld"));

      if (!feld.selectList) {
        throw new DocuwareError(
          `${feld.id} (${feld.label}) hat in '${cab.name}' keine Auswahlliste. Der Wert ist ` +
            `frei einzugeben.`,
        );
      }
      const antwort = await ctx.dw.json<any>("GET", feld.selectList);
      const werte = Array.isArray(antwort?.Value) ? antwort.Value : [];
      return {
        aktenschrank: cab.name,
        feld: feld.id,
        bezeichnung: feld.label,
        anzahl: werte.length,
        werte,
      };
    },
  },

  {
    name: "search_documents",
    title: "Dokumente suchen",
    description:
      "Sucht Dokumente in einem Aktenschrank über seine Indexfelder. Bedingungen sind ein " +
      "Objekt aus Feldname und Wert; der Feldname darf der API-Name (DOCNO) oder die " +
      "Bezeichnung (Belegnummer) sein. Ein '*' im Wert ist Platzhalter — 'Meier*' findet " +
      "auch 'Meiers'. Klammern im Wert werden automatisch maskiert, sonst wären sie Syntax " +
      "und die Trefferliste stumm falsch. Für einen Zeitraum oder Zahlenbereich eine Liste " +
      "aus zwei Werten übergeben ([von, bis]); eine offene Grenze ist null. Ein einzelnes " +
      "null als Wert sucht Dokumente, bei denen das Feld leer ist. " +
      "Datumsangaben immer als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        bedingungen: {
          type: "object",
          description:
            "Feldname -> Wert. Beispiel: {\"DOCTYPE\": \"Rechnung\", \"DOCDATE\": " +
            "[\"2026-01-01\", \"2026-03-31\"]}. Leer lassen findet alles im Schrank.",
          additionalProperties: true,
        },
        verknuepfung: str("'und' (Default) oder 'oder' — wie die Bedingungen zusammenwirken."),
        sortierung: {
          type: "array",
          description:
            "Sortierfelder, jeweils 'FELD' oder 'FELD:desc'. Mehrere sind erlaubt und " +
            "wirken in der angegebenen Reihenfolge.",
          items: { type: "string" },
        },
        felder: {
          type: "array",
          description:
            "Welche Indexfelder in den Treffern stehen sollen. Ohne Angabe kommen alle " +
            "Felder des Suchdialogs mit.",
          items: { type: "string" },
        },
        limit: int(`Höchstzahl der Treffer, 1 bis ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.`),
      },
      required: ["aktenschrank"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);

      const verknuepfung = String(args.verknuepfung ?? "und").toLowerCase();
      if (verknuepfung !== "und" && verknuepfung !== "oder") {
        throw new DocuwareError(`'${args.verknuepfung}' ist keine Verknüpfung. Erlaubt: und, oder.`);
      }

      const ergebnis = await runSearch(ctx.dw, detail, {
        bedingungen: (args.bedingungen ?? {}) as Record<string, unknown>,
        verknuepfung,
        sortierung: Array.isArray(args.sortierung) ? args.sortierung.map(String) : [],
        felder: Array.isArray(args.felder) ? args.felder.map(String) : [],
        maxItems: limitOf(args),
      });

      return {
        aktenschrank: cab.name,
        suchdialog: detail.searchDialog?.name ?? null,
        gefunden: ergebnis.gesamt,
        geliefert: ergebnis.treffer.length,
        abgeschnitten: ergebnis.abgeschnitten,
        treffer: ergebnis.treffer.map((t) => ({
          id: t.id,
          titel: t.titel,
          felder: t.felder,
        })),
      };
    },
  },

  {
    name: "get_document",
    title: "Dokument im Detail",
    description:
      "Ein einzelnes Dokument mit allen Indexfeldern und allen Anhängen. Bei DocuWare ist " +
      "ein Dokument eine Klammer um mehrere Dateien — die heißen dort 'Sections' und sind " +
      "hier die Anhänge. Ein gescanntes Rechnungspaket kann so aus Rechnung, Lieferschein " +
      "und Anlage bestehen, unter einer Id. Zum Herunterladen 'download_link' benutzen, " +
      "zum Volltext 'document_text'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments, z. B. aus search_documents."),
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const id = String(req<string>(args, "dokument_id"));
      const doc = await ctx.dw.json<any>("GET", `${cab.documents}/${encodeURIComponent(id)}`);

      return {
        aktenschrank: cab.name,
        id: doc?.Id ?? id,
        titel: doc?.Title ?? null,
        typ: doc?.ContentType ?? null,
        groesse_bytes: doc?.FileSize ?? null,
        angelegt: dwDate(doc?.CreatedAt, true),
        geaendert: dwDate(doc?.LastModified, true),
        felder: Object.fromEntries(
          (Array.isArray(doc?.Fields) ? doc.Fields : [])
            .filter((f: any) => f?.FieldName)
            .map((f: any) => [String(f.FieldName), fieldValue(f)]),
        ),
        anhaenge: (Array.isArray(doc?.Sections) ? doc.Sections : []).map(attachmentRow),
      };
    },
  },

  {
    name: "document_text",
    title: "Volltext eines Dokuments",
    description:
      "Liefert den OCR-Volltext eines Dokuments — das, was DocuWare beim Einlesen erkannt " +
      "hat. Damit lässt sich der Inhalt lesen, ohne die Datei herunterzuladen. Das setzt " +
      "voraus, dass der Aktenschrank Volltextindizierung hat und das Dokument verarbeitet " +
      "wurde; sonst sagt DocuWare, dass es keinen Text gibt. Ohne 'anhang_id' werden alle " +
      "Anhänge nacheinander gelesen.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments."),
        anhang_id: str("Nur diesen Anhang lesen. Ohne Angabe alle."),
        max_zeichen: int("Text je Anhang kürzen. Default 20000."),
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const id = String(req<string>(args, "dokument_id"));
      const grenze = Math.max(500, Math.min(200_000, Number(args.max_zeichen) || 20_000));

      const doc = await ctx.dw.json<any>("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      let sections: any[] = Array.isArray(doc?.Sections) ? doc.Sections : [];
      if (args.anhang_id) {
        const nur = String(args.anhang_id);
        sections = sections.filter((s) => String(s?.Id ?? "") === nur);
        if (sections.length === 0) {
          throw new DocuwareError(
            `Das Dokument ${id} hat keinen Anhang '${nur}'. Vorhanden: ` +
              `${(doc?.Sections ?? []).map((s: any) => s?.Id).join(", ") || "keiner"}.`,
          );
        }
      }

      const teile = [];
      for (const section of sections) {
        /*
         * Die Beziehung `textshot` steht nicht in der Kurzfassung, die am Dokument hängt —
         * dafür muss der Anhang selbst geholt werden. Das ist kein Umweg, sondern der Weg.
         */
        const voll = await ctx.dw.json<any>(
          "GET",
          link(section, "self", `Der Anhang ${section?.Id}`),
        );
        const textshot = links(voll)["textshot"];
        if (!textshot) {
          teile.push({
            anhang_id: section?.Id ?? null,
            dateiname: section?.OriginalFileName ?? null,
            text: null,
            hinweis:
              "Für diesen Anhang gibt es keinen Volltext. Entweder ist der Aktenschrank " +
              "nicht volltextindiziert, oder das Dokument ist noch nicht verarbeitet.",
          });
          continue;
        }
        const shot = await ctx.dw.json<any>("GET", textshot);
        const text = textshotToText(shot);
        teile.push({
          anhang_id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? null,
          seiten: Array.isArray(shot?.Pages) ? shot.Pages.length : null,
          gekuerzt: text.length > grenze,
          text: text.slice(0, grenze),
        });
      }

      return { aktenschrank: cab.name, dokument_id: id, anhaenge: teile };
    },
  },

  {
    name: "download_link",
    title: "Dokument herunterladen",
    description:
      "Erzeugt einen zeitlich begrenzten Link, über den die Datei heruntergeladen werden " +
      "kann. DocuWare gibt Dateien nur gegen ein Zugangstoken heraus; der Link hier " +
      "übernimmt das und läuft von selbst ab. Ohne 'anhang_id' kommt das ganze Dokument, " +
      "mit 'anhang_id' nur diese eine Datei. Mit Anmerkungen (Stempel, Notizen) wandelt " +
      "DocuWare nach PDF — ohne sie bleibt das Original, wie es abgelegt wurde.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments."),
        anhang_id: str("Nur diesen Anhang. Ohne Angabe das ganze Dokument."),
        mit_anmerkungen: bool(
          "Stempel und Notizen mit ausliefern; wandelt nach PDF. Default true.",
        ),
        gueltig_minuten: int("Wie lange der Link gilt, 1 bis 1440. Default 60."),
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const id = String(req<string>(args, "dokument_id"));
      const doc = await ctx.dw.json<any>("GET", `${cab.documents}/${encodeURIComponent(id)}`);

      let quelle: any = doc;
      let name = String(doc?.Title || `dokument-${id}`);
      if (args.anhang_id) {
        const nur = String(args.anhang_id);
        const section = (Array.isArray(doc?.Sections) ? doc.Sections : []).find(
          (s: any) => String(s?.Id ?? "") === nur,
        );
        if (!section) {
          throw new DocuwareError(`Das Dokument ${id} hat keinen Anhang '${nur}'.`);
        }
        // Am Anhang in der Dokumentantwort fehlt `fileDownload`; die volle Fassung hat sie.
        quelle = await ctx.dw.json<any>("GET", link(section, "self", `Der Anhang ${nur}`));
        name = String(section?.OriginalFileName || name);
      }

      const mitAnmerkungen = args.mit_anmerkungen !== false;
      const { token, expiresInMinutes } = await createFileLink(
        ctx.kv,
        ctx.dw.credentials,
        {
          href: link(quelle, "fileDownload", args.anhang_id ? "Der Anhang" : "Das Dokument"),
          filename: name,
          keepAnnotations: mitAnmerkungen,
        },
        Number(args.gueltig_minuten) || 60,
      );

      return {
        aktenschrank: cab.name,
        dokument_id: id,
        anhang_id: args.anhang_id ?? null,
        dateiname: name,
        mit_anmerkungen: mitAnmerkungen,
        link: `${ctx.origin}/f/${token}`,
        gueltig_minuten: expiresInMinutes,
        hinweis:
          "Der Link ist ein Geheimnis auf Zeit — wer ihn hat, bekommt die Datei, ohne sich " +
          "anzumelden. Nach Ablauf ist er wertlos.",
      };
    },
  },
];
