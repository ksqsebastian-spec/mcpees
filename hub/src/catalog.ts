/**
 * Tool-Kataloge von den Servern holen.
 *
 * Die Übersicht zeigt bewusst keine gepflegte Kopie der Tool-Listen, sondern fragt jeden
 * Server nach seinem eigenen Katalog. Eine Kopie wäre nach der ersten Änderung falsch,
 * ohne dass es jemand merkt. Ergebnisse werden im Cloudflare-Cache gehalten, damit die
 * Seite nicht bei jedem Aufruf zwei Fremdsysteme anfasst.
 */
import type { ServerEntry } from "./registry";

export interface ToolInfo {
  name: string;
  title?: string;
  description: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string; items?: unknown }>;
    required?: string[];
  };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
}

export interface Catalog {
  ok: boolean;
  tools: ToolInfo[];
  serverVersion?: string;
  error?: string;
}

const CACHE_SECONDS = 300;

export async function fetchCatalog(entry: ServerEntry): Promise<Catalog> {
  try {
    if (entry.catalog === "tools.json") {
      const res = await fetch(`${entry.origin}/tools.json`, {
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      } as RequestInit);
      if (!res.ok) return { ok: false, tools: [], error: `HTTP ${res.status}` };
      const body = (await res.json()) as any;
      return { ok: true, tools: body.tools ?? [], serverVersion: body.server?.version };
    }

    // Server ohne eigenen Katalog-Endpoint: direkt per MCP fragen. Geht nur ohne Auth.
    const res = await fetch(entry.mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    if (!res.ok) return { ok: false, tools: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    // Antwort kann SSE sein ("data: {...}") oder blankes JSON.
    const line = text.includes("data:")
      ? text.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim()
      : text;
    if (!line) return { ok: false, tools: [], error: "leere Antwort" };
    const body = JSON.parse(line);
    if (body.error) return { ok: false, tools: [], error: body.error.message };
    return { ok: true, tools: body.result?.tools ?? [] };
  } catch (e) {
    return { ok: false, tools: [], error: (e as Error).message };
  }
}
