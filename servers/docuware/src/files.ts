/**
 * Kurzlebige Download-Links für DocuWare-Dokumente.
 *
 * DocuWare liefert Dokumente nur gegen ein Access-Token aus, und das gehört nirgendwo hin,
 * wo ein Mensch oder ein Modell es zu sehen bekäme. Die Datei selbst ins Gespräch zu legen
 * ist auch keine Lösung: ein gescanntes PDF als base64 kostet ein Vielfaches an Token und
 * ist für den Menschen davor nutzlos.
 *
 * Stattdessen legt der Server einen nicht erratbaren, zeitlich begrenzten Link an und
 * liefert die Datei selbst aus. Die Zugangsdaten liegen dabei genauso verschlüsselt wie bei
 * den OAuth-Tokens: der Schlüssel wird aus dem Link-Token abgeleitet. Wer nur KV lesen
 * kann, hat wieder nur Chiffretext.
 */
import { randomToken, sha256hex, sealJSON, openJSON } from "../../../shared/src/crypto";
import { Docuware, sanitizeFilename, type Credentials } from "./client";
import type { Env } from "../../../shared/src/types";

const MAX_MINUTES = 60 * 24;

export interface FileTarget {
  /** Die Beziehung `fileDownload` des Dokuments oder eines Anhangs. */
  href: string;
  filename: string;
  /**
   * Anmerkungen (Stempel, Notizen) mit ausliefern. DocuWare kann das nur, wenn es die
   * Datei nach PDF wandelt — deshalb hängt beides zusammen.
   */
  keepAnnotations: boolean;
}

export async function createFileLink(
  kv: KVNamespace,
  credentials: Credentials,
  target: FileTarget,
  minutes: number,
): Promise<{ token: string; expiresInMinutes: number }> {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("dwmcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credentials }),
      href: target.href,
      filename: target.filename,
      keepAnnotations: target.keepAnnotations,
    }),
    { expirationTtl: ttl * 60 },
  );
  return { token, expiresInMinutes: ttl };
}

/** Route `GET /f/<token>` — liefert die Datei aus, solange der Link gilt. */
export async function serveFile(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  const match = /^\/f\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (!match || request.method !== "GET") return null;

  const token = match[1];
  const rec = await env.OAUTH_KV.get<any>(`dl:${await sha256hex(token)}`, "json");
  if (!rec) {
    return new Response("Dieser Link ist abgelaufen oder ungültig.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let credentials: Credentials;
  try {
    ({ credentials } = await openJSON<{ credentials: Credentials }>(token, rec.sealed));
  } catch {
    return new Response("Link ungültig.", { status: 404 });
  }

  let datei: { bytes: Uint8Array; contentType: string; filename: string | null };
  try {
    datei = await new Docuware(credentials, env.OAUTH_KV).bytes(String(rec.href), {
      query: {
        keepAnnotations: rec.keepAnnotations ? "true" : "false",
        // Anmerkungen gibt es nur im PDF; ohne sie bleibt das Original, wie es ist.
        targetFileType: rec.keepAnnotations ? "PDF" : "Auto",
      },
    });
  } catch (err) {
    return new Response(`DocuWare liefert die Datei nicht aus: ${(err as Error).message}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const filename = sanitizeFilename(datei.filename || rec.filename || "dokument.pdf");
  return new Response(datei.bytes, {
    headers: {
      "content-type": datei.contentType,
      "content-disposition": `inline; filename="${filename}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
