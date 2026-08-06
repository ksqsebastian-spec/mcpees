/**
 * Kurzlebige Download-Links für Lexware-Dokumente.
 *
 * Lexware liefert keine vorsignierten URLs (anders als HERO) — PDFs kommen nur als Binärstrom
 * gegen den API-Key. Ein PDF base64-kodiert ins Gespräch zu legen wäre teuer und für den
 * Menschen nutzlos. Stattdessen legt der Server einen unrat­baren, zeitlich begrenzten Link an
 * und liefert die Datei selbst aus.
 *
 * Der API-Key liegt dabei genauso verschlüsselt wie bei den OAuth-Tokens: der Schlüssel wird
 * aus dem Link-Token abgeleitet. Wer nur KV lesen kann, hat wieder nur Chiffretext.
 */
import { randomToken, sha256hex, sealJSON, openJSON } from "../../../shared/src/crypto";
import { Lexware } from "./client";
import type { Env } from "../../../shared/src/types";

const MAX_MINUTES = 60 * 24;

export async function createFileLink(
  kv: KVNamespace,
  credential: string,
  file: { id: string; filename: string; contentType: string },
  minutes: number,
): Promise<{ token: string; expiresInMinutes: number }> {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("hmcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credential }),
      fileId: file.id,
      filename: file.filename,
      contentType: file.contentType,
    }),
    { expirationTtl: ttl * 60 },
  );
  return { token, expiresInMinutes: ttl };
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

  const res = await new Lexware(credential).request(`/v1/files/${rec.fileId}`, {
    accept: rec.contentType || "application/pdf",
    raw: true,
  });
  if (!res.ok) {
    return new Response(`Lexware liefert die Datei nicht aus (HTTP ${res.status}).`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? rec.contentType ?? "application/pdf",
      "content-disposition": `inline; filename="${rec.filename.replace(/["\\]/g, "")}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
