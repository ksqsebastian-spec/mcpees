/**
 * Kurzlebige Download-Links für sevdesk-PDFs.
 *
 * sevdesk liefert PDFs nicht als Binärstrom, sondern als JSON mit base64-Inhalt
 * (`{ filename, mimeType, base64encoded, content }`) — und nur gegen den API-Token. Beides
 * spricht dagegen, die Datei ins Gespräch zu legen: base64 kostet ein Vielfaches an Token
 * und ist für den Menschen davor nutzlos.
 *
 * Stattdessen legt der Server einen nicht erratbaren, zeitlich begrenzten Link an und
 * liefert die Datei selbst aus. Der API-Token liegt dabei genauso verschlüsselt wie bei den
 * OAuth-Tokens: der Schlüssel wird aus dem Link-Token abgeleitet. Wer nur KV lesen kann,
 * hat wieder nur Chiffretext.
 */
import { randomToken, sha256hex, sealJSON, openJSON } from "../../../shared/src/crypto";
import { Sevdesk } from "./client";
import type { Env } from "../../../shared/src/types";

const MAX_MINUTES = 60 * 24;

/** Belegarten mit PDF-Route. Vouchers (Eingangsbelege) haben keine. */
export const PDF_PATHS: Record<string, string> = {
  invoice: "/Invoice/{invoiceId}/getPdf",
  order: "/Order/{orderId}/getPdf",
  creditnote: "/CreditNote/{creditNoteId}/getPdf",
};

const PDF_PARAM: Record<string, string> = {
  invoice: "invoiceId",
  order: "orderId",
  creditnote: "creditNoteId",
};

export async function createFileLink(
  kv: KVNamespace,
  credential: string,
  doc: { docType: string; id: string | number; filename: string },
  minutes: number,
): Promise<{ token: string; expiresInMinutes: number }> {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("smcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credential }),
      docType: doc.docType,
      id: String(doc.id),
      filename: doc.filename,
    }),
    { expirationTtl: ttl * 60 },
  );
  return { token, expiresInMinutes: ttl };
}

/** base64 -> Bytes. atob steht in Workers wie in Node zur Verfügung. */
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Route `GET /f/<token>` — liefert die Datei aus, solange der Link gilt. */
export async function serveFile(request: Request, url: URL, env: Env): Promise<Response | null> {
  const match = /^\/f\/([A-Za-z0-9_\-]+)$/.exec(url.pathname);
  if (!match || request.method !== "GET") return null;

  const token = match[1];
  const rec = await env.OAUTH_KV.get<any>(`dl:${await sha256hex(token)}`, "json");
  if (!rec) {
    return new Response("Dieser Link ist abgelaufen oder ungültig.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let credential: string;
  try {
    ({ credential } = await openJSON<{ credential: string }>(token, rec.sealed));
  } catch {
    return new Response("Link ungültig.", { status: 404 });
  }

  const template = PDF_PATHS[rec.docType];
  if (!template) return new Response("Unbekannte Belegart.", { status: 404 });

  let doc: any;
  try {
    doc = await new Sevdesk(credential).call<any>("GET", template, {
      path: { [PDF_PARAM[rec.docType]]: rec.id },
      // preventSendBy: Das Abrufen des PDFs setzt bei sevdesk sonst das Versanddatum —
      // ein Download würde den Beleg als versendet markieren. Lesen darf nichts verändern.
      query: { preventSendBy: true },
    });
  } catch (err) {
    return new Response(`sevdesk liefert die Datei nicht aus: ${(err as Error).message}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const content = doc?.content;
  if (typeof content !== "string") {
    return new Response("sevdesk hat kein PDF zurückgegeben.", { status: 502 });
  }
  const bytes = doc?.base64encoded === false ? new TextEncoder().encode(content) : fromBase64(content);
  const filename = String(doc?.filename || rec.filename || "beleg.pdf");

  return new Response(bytes, {
    headers: {
      "content-type": String(doc?.mimeType || "application/pdf"),
      "content-disposition": `inline; filename="${filename.replace(/["\\]/g, "")}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
