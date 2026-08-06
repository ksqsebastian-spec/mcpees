/**
 * MCP über Streamable HTTP, zustandslos.
 *
 * Zustandslos heißt: keine Session-IDs, keine Durable Objects, kein Server-State zwischen
 * Requests. Jeder POST /mcp trägt sein Bearer-Token, daraus fällt der HERO-Key — mehr
 * Kontext braucht dieser Server nicht. Das macht ihn beliebig skalierbar und billig.
 */
import { Hero, HeroError } from "./hero";
import { getConfig } from "./tenant";
import { tools, toolsByName } from "./tools";
import type { Session } from "./oauth";
import { LOGO_SVG } from "./ui";

export const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_VERSION = "2.0.0";

const INSTRUCTIONS =
  "HERO Handwerkersoftware — bringe deinen Betrieb direkt in den Chat. Frage Projekte, Kunden, " +
  "Termine, Aufträge und offene Posten ab, erstelle Angebote, Rechnungen, Abschlags- und " +
  "Schlussrechnungen, Stundenzettel und Aufträge, lade Dateien hoch und hole PDF-Links — alles " +
  "im Gespräch. 34 Tools (Lesen · Erstellen · Upload · Download), kein Bearbeiten oder Löschen: " +
  "nichts kann kaputtgehen. Einstieg: „was ist heute los?\" (dashboard) oder „wer schuldet uns " +
  "noch was?\" (list_open_invoices). Zeitangaben immer als ISO MIT Offset, Datumsangaben als " +
  "'YYYY-MM-DD'.";

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

const result = (id: any, res: unknown) => ({ jsonrpc: "2.0" as const, id, result: res });
const rpcError = (id: any, code: number, message: string, data?: unknown) => ({
  jsonrpc: "2.0" as const,
  id: id ?? null,
  error: { code, message, ...(data === undefined ? {} : { data }) },
});

function serverInfo() {
  return {
    name: "hero",
    title: "HERO Handwerkersoftware",
    version: SERVER_VERSION,
    websiteUrl: "https://hero-software.de",
    icons: [
      {
        src: `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
    ],
  };
}

export function publicToolList() {
  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  }));
}

export async function handleRpc(
  body: unknown,
  session: Session,
  kv: KVNamespace,
): Promise<unknown | null> {
  if (Array.isArray(body)) {
    return rpcError(null, -32600, "JSON-RPC-Batches werden von MCP nicht mehr unterstützt.");
  }
  const req = body as RpcRequest;
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return rpcError((req as any)?.id, -32600, "Kein gültiger JSON-RPC-2.0-Request.");
  }

  // Notifications (keine id) werden bestätigt, aber nicht beantwortet.
  const isNotification = req.id === undefined || req.id === null;

  switch (req.method) {
    case "initialize": {
      const wanted = req.params?.protocolVersion;
      const version = SUPPORTED_PROTOCOLS.includes(wanted) ? wanted : PROTOCOL_VERSION;
      return result(req.id, {
        protocolVersion: version,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: serverInfo(),
        instructions: INSTRUCTIONS,
      });
    }

    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null;

    case "ping":
      return result(req.id, {});

    case "tools/list":
      return result(req.id, { tools: publicToolList() });

    case "resources/list":
      return result(req.id, { resources: [] });

    case "resources/templates/list":
      return result(req.id, { resourceTemplates: [] });

    case "prompts/list":
      return result(req.id, { prompts: [] });

    case "tools/call": {
      const name = req.params?.name;
      const tool = toolsByName.get(name);
      if (!tool) {
        return rpcError(req.id, -32602, `Unbekanntes Tool '${name}'.`);
      }
      const hero = new Hero(session.apiKey);
      try {
        const cfg = await getConfig(kv, hero, session.apiKey);
        const data = await tool.handler(req.params?.arguments ?? {}, { hero, cfg, kv });
        return result(req.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        });
      } catch (e) {
        // Fachliche Fehler gehören als isError-Ergebnis ins Gespräch, nicht als
        // Protokollfehler — das Modell soll sie lesen und korrigieren können.
        const err = e as Error;
        const detail = err instanceof HeroError && err.detail ? `\n${JSON.stringify(err.detail).slice(0, 600)}` : "";
        return result(req.id, {
          content: [{ type: "text", text: `Fehler in ${name}: ${err.message}${detail}` }],
          isError: true,
        });
      }
    }

    default:
      if (isNotification) return null;
      return rpcError(req.id, -32601, `Methode '${req.method}' wird nicht unterstützt.`);
  }
}
