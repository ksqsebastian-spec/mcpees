/**
 * Schreibende Tools — ablegen und anhängen, mehr nicht.
 *
 * Kein Ändern, kein Löschen: wie bei den anderen Servern dieses Repos kann kein Tool
 * bestehende Daten überschreiben. Bei einem Dokumentenmanagement wiegt das schwerer als
 * anderswo — ein Archiv lebt davon, dass niemand nachträglich daran dreht. Indexfelder
 * korrigieren und Dokumente löschen geht in DocuWare selbst, mit Protokoll und Rechten.
 *
 * Zwei Vorsichtsmaßnahmen prägen die beiden Tools:
 *
 *  - **Ein Feld, das der Ablagedialog nicht führt, verfällt still.** DocuWare nimmt die
 *    Angabe entgegen, legt ab und schreibt sie nicht — der Beleg liegt im Schrank, das
 *    Feld ist leer, eine Fehlermeldung gibt es nicht. Deshalb wird vorher geprüft
 *    (fields.ts) und hinterher zurückgelesen.
 *  - **Ablegen und Datei anhängen sind zwei Schritte.** Erst entsteht der Datensatz, dann
 *    hängt die Datei daran. Wer nur den ersten macht, hat einen Eintrag ohne Beleg.
 */
import { DocuwareError, dwDate, links } from "../client";
import { structure, findCabinet, cabinetDetail, findField } from "../structure";
import { toFieldList } from "../fields";
import { fieldValue } from "../search";
import { type DwTool, str, req } from "../context";

/** base64 -> Bytes. atob steht in Workers wie in Node zur Verfügung. */
function fromBase64(b64: string, feld: string): Uint8Array {
  try {
    const bin = atob(String(b64).replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new DocuwareError(`${feld} ist kein gültiges base64.`);
  }
}

/** Die Indexfelder einer Dokumentantwort als `{ Feldname: Wert }`. */
function docFields(doc: any): Record<string, unknown> {
  return Object.fromEntries(
    (Array.isArray(doc?.Fields) ? doc.Fields : [])
      .filter((f: any) => f?.FieldName)
      .map((f: any) => [String(f.FieldName), fieldValue(f)]),
  );
}

export const writeTools: DwTool[] = [
  {
    name: "store_document",
    title: "Dokument ablegen",
    description:
      "Legt ein neues Dokument in einem Aktenschrank oder Briefkorb an: zuerst der " +
      "Datensatz mit den Indexfeldern, danach — optional in einem Aufwasch — die Datei " +
      "dazu. Feldnamen dürfen der API-Name oder die Bezeichnung sein; welche es gibt und " +
      "welche sich überhaupt füllen lassen, sagt 'index_fields'. Ein Feld, das der " +
      "Ablagedialog nicht kennt, wird hier abgewiesen statt stillschweigend verworfen. " +
      "Nach dem Ablegen wird zurückgelesen und gemeldet, was tatsächlich im Schrank steht. " +
      "Datumsangaben als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks oder Briefkorbs."),
        felder: {
          type: "object",
          description:
            "Indexfeld -> Wert. Beispiel: {\"DOCTYPE\": \"Rechnung\", \"BELEGNR\": \"4711\"}. " +
            "Eine Liste als Wert füllt ein Stichwortfeld.",
          additionalProperties: true,
        },
        dateiname: str("Dateiname mit Endung, z. B. 'rechnung-4711.pdf'. Nur mit inhalt_base64."),
        inhalt_base64: str("Der Dateiinhalt als base64. Ohne Datei entsteht ein reiner Datensatz."),
        mime_type: str("z. B. 'application/pdf'. Default application/pdf."),
      },
      required: ["aktenschrank", "felder"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);

      const werte = (args.felder ?? {}) as Record<string, unknown>;
      if (Object.keys(werte).length === 0) {
        throw new DocuwareError(
          "Ohne Indexfelder entsteht ein Dokument, das sich nachher nicht wiederfinden lässt. " +
            "Mindestens ein Feld angeben — 'index_fields' zeigt, welche.",
        );
      }
      if (args.inhalt_base64 && !args.dateiname) {
        throw new DocuwareError("Zu inhalt_base64 gehört ein dateiname mit Endung.");
      }

      const angelegt = await ctx.dw.json<any>("POST", cab.documents, {
        body: { Fields: toFieldList(detail, werte) },
      });
      const id = String(angelegt?.Id ?? "");
      if (!id) {
        throw new DocuwareError(
          "DocuWare hat auf das Ablegen geantwortet, nennt aber keine Dokument-Id.",
          angelegt,
        );
      }

      let anhang: Record<string, unknown> | null = null;
      if (args.inhalt_base64) {
        const bytes = fromBase64(String(args.inhalt_base64), "inhalt_base64");
        const name = String(args.dateiname);
        const form = new FormData();
        form.append(
          "file",
          new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }),
          name,
        );
        const rel = links(angelegt);
        const ziel = rel["files"] ?? rel["sections"];
        if (!ziel) {
          throw new DocuwareError(
            `Das angelegte Dokument ${id} nennt keine Beziehung, an die eine Datei gehängt ` +
              `werden könnte. Der Datensatz steht im Schrank, die Datei fehlt — ` +
              `'attach_file' kann sie nachreichen.`,
          );
        }
        const section = await ctx.dw.json<any>("POST", ziel, { form });
        anhang = {
          id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? name,
          typ: section?.ContentType ?? null,
          groesse_bytes: section?.FileSize ?? bytes.length,
        };
      }

      /*
       * Zurücklesen, nicht der Antwort glauben. Ein Feld, das DocuWare beim Ablegen
       * verworfen hat, steht in der Antwort auf das POST unter Umständen trotzdem noch —
       * im Schrank steht es dann nicht. Was hier zurückkommt, ist der Schrank.
       */
      const gelesen = await ctx.dw.json<any>(
        "GET",
        `${cab.documents}/${encodeURIComponent(id)}`,
      );
      const gespeichert = docFields(gelesen);

      const leerGeblieben = Object.keys(werte)
        .map((name) => findField(detail, name).id)
        .filter((id) => {
          const wert = gespeichert[id];
          return wert === null || wert === undefined || wert === "";
        });

      return {
        angelegt: true,
        aktenschrank: cab.name,
        dokument_id: id,
        titel: gelesen?.Title ?? null,
        angelegt_am: dwDate(gelesen?.CreatedAt, true),
        felder: gespeichert,
        anhang,
        ...(leerGeblieben.length > 0
          ? {
              warnung:
                `Diese Felder sind nach dem Ablegen leer: ${leerGeblieben.join(", ")}. ` +
                `DocuWare hat sie verworfen, ohne das zu melden — meist, weil der Wert nicht ` +
                `zum Feldtyp passt oder eine Auswahlliste ihn nicht kennt ('field_values').`,
            }
          : {}),
        ...(anhang === null
          ? {
              hinweis:
                "Abgelegt ist bisher nur der Datensatz, ohne Datei. Mit 'attach_file' lässt " +
                "sich eine nachreichen.",
            }
          : {}),
      };
    },
  },

  {
    name: "attach_file",
    title: "Datei an ein Dokument hängen",
    description:
      "Hängt eine weitere Datei an ein vorhandenes Dokument. Bei DocuWare ist ein Dokument " +
      "eine Klammer um mehrere Dateien; so kommen Lieferschein und Anlage unter dieselbe " +
      "Id wie die Rechnung. Die vorhandenen Dateien bleiben unangetastet — es kommt eine " +
      "dazu, es wird keine ersetzt.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments, an das die Datei soll."),
        dateiname: str("Dateiname mit Endung, z. B. 'lieferschein.pdf'."),
        inhalt_base64: str("Der Dateiinhalt als base64."),
        mime_type: str("z. B. 'application/pdf' oder 'image/jpeg'. Default application/pdf."),
      },
      required: ["aktenschrank", "dokument_id", "dateiname", "inhalt_base64"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req<string>(args, "aktenschrank"));
      const id = String(req<string>(args, "dokument_id"));
      const name = String(req<string>(args, "dateiname"));
      const bytes = fromBase64(String(req<string>(args, "inhalt_base64")), "inhalt_base64");

      const doc = await ctx.dw.json<any>("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      const vorher = Array.isArray(doc?.Sections) ? doc.Sections.length : 0;

      const rel = links(doc);
      const ziel = rel["files"] ?? rel["sections"];
      if (!ziel) {
        throw new DocuwareError(
          `Das Dokument ${id} nennt weder 'files' noch 'sections' — dorthin gehen neue ` +
            `Dateien. Ohne diese Beziehung gibt DocuWare keinen Weg an, eine anzuhängen.`,
        );
      }

      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }),
        name,
      );
      const section = await ctx.dw.json<any>("POST", ziel, { form });

      // Nachzählen: eine Antwort ohne Fehler heißt noch nicht, dass die Datei am Dokument hängt.
      const danach = await ctx.dw.json<any>("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      const jetzt = Array.isArray(danach?.Sections) ? danach.Sections.length : 0;

      return {
        angehaengt: jetzt > vorher,
        aktenschrank: cab.name,
        dokument_id: id,
        anhang: {
          id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? name,
          typ: section?.ContentType ?? null,
          groesse_bytes: section?.FileSize ?? bytes.length,
        },
        anhaenge_vorher: vorher,
        anhaenge_jetzt: jetzt,
        ...(jetzt > vorher
          ? {}
          : {
              warnung:
                "DocuWare hat den Upload angenommen, das Dokument hat aber nicht mehr " +
                "Anhänge als vorher. Die Datei ist nicht angekommen.",
            }),
      };
    },
  },
];
