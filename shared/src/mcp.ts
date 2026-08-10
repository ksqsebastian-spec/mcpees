/**
 * MCP über Streamable HTTP, zustandslos.
 *
 * Zustandslos heißt: keine Session-IDs, keine Durable Objects, kein Server-State zwischen
 * Requests. Jeder POST /mcp trägt sein Bearer-Token, daraus fallen die Zugangsdaten — mehr
 * Kontext braucht der Server nicht. Das macht ihn beliebig skalierbar und billig.
 */
import type { Session } from "./oauth";
import type { ServerConfig, ToolDef } from "./types";

export const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

const result = (id: any, res: unknown) => ({ jsonrpc: "2.0" as const, id, result: res });
const rpcError = (id: any, code: number, message: string) => ({
  jsonrpc: "2.0" as const,
  id: id ?? null,
  error: { code, message },
});

export function publicToolList<C>(tools: ToolDef<C>[]) {
  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  }));
}

export async function handleRpc<C>(
  body: unknown,
  session: Session,
  kv: KVNamespace,
  origin: string,
  config: ServerConfig<C>,
): Promise<unknown | null> {
  if (Array.isArray(body)) {
    return rpcError(null, -32600, "JSON-RPC-Batches werden von MCP nicht mehr unterstützt.");
  }
  const req = body as RpcRequest;
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return rpcError((req as any)?.id, -32600, "Kein gültiger JSON-RPC-2.0-Request.");
  }
  const isNotification = req.id === undefined || req.id === null;

  switch (req.method) {
    case "initialize": {
      const wanted = req.params?.protocolVersion;
      return result(req.id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(wanted) ? wanted : PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          ...config.serverInfo,
          /*
           * PNG zuerst: eine data:-URI mit SVG lässt sich zwar überall einbetten, wird aber
           * von etlichen Clients nicht als Bild angenommen. Nur wenn keine Rasterfassung
           * vorliegt, bleibt das SVG die einzige Angabe.
           */
          icons: config.brand.icon
            ? [
                { src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["512x512"] },
                { src: `${origin}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
              ]
            : [
                {
                  src: `data:image/svg+xml;base64,${btoa(config.brand.logoSvg)}`,
                  mimeType: "image/svg+xml",
                  sizes: ["any"],
                },
              ],
        },
        instructions: config.instructions,
      });
    }

    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null;

    case "ping":
      return result(req.id, {});

    case "tools/list":
      return result(req.id, { tools: publicToolList(config.tools) });

    case "resources/list":
      return result(req.id, { resources: [] });

    case "resources/templates/list":
      return result(req.id, { resourceTemplates: [] });

    case "prompts/list":
      return result(req.id, { prompts: [] });

    case "tools/call": {
      const name = req.params?.name;
      const tool = config.tools.find((t) => t.name === name);
      if (!tool) return rpcError(req.id, -32602, `Unbekanntes Tool '${name}'.`);
      try {
        const ctx = await config.context(session.credentials, kv, origin);
        const data = await tool.handler(req.params?.arguments ?? {}, ctx);
        return result(req.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        });
      } catch (e) {
        // Fachliche Fehler gehören als isError-Ergebnis ins Gespräch, nicht als
        // Protokollfehler — das Modell soll sie lesen und korrigieren können.
        const err = e as Error & { detail?: unknown };
        const detail = err.detail ? `\n${JSON.stringify(err.detail).slice(0, 600)}` : "";
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
