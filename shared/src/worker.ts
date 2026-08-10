/**
 * Das gemeinsame Gerüst: Routing, CORS und die Verdrahtung von OAuth mit MCP.
 * Ein konkreter Server liefert nur seine ServerConfig.
 *
 *   GET  /                                           Infoseite
 *   GET  /.well-known/oauth-authorization-server     RFC 8414
 *   GET  /.well-known/oauth-protected-resource[/mcp] RFC 9728
 *   POST /register                                   RFC 7591 Dynamic Client Registration
 *   GET  /authorize | POST /authorize                Anmeldung → Auth-Code
 *   POST /token                                      Code-Tausch und Refresh
 *   POST /revoke                                     RFC 7009
 *   POST /mcp                                        MCP, Bearer-Token erforderlich
 *   GET  /tools.json                                 Tool-Katalog, öffentlich
 *   GET  /favicon.ico | /icon.png | /favicon.svg     Bildmarke, ohne Anmeldung
 */
import {
  handleRegister,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleToken,
  handleRevoke,
  authenticate,
  authServerMetadata,
  protectedResourceMetadata,
  unauthorized,
} from "./oauth";
import { handleRpc, publicToolList, PROTOCOL_VERSION } from "./mcp";
import { landingPage, errorPage } from "./ui";
import type { Env, ServerConfig } from "./types";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-protocol-version",
  "access-control-max-age": "86400",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });

/* Base64 einmal beim Kaltstart auspacken, danach aus dem Speicher ausliefern. */
const ICON_CACHE = new Map<string, Uint8Array>();

function iconResponse(b64: string, type: string): Response {
  let bytes = ICON_CACHE.get(b64);
  if (!bytes) {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    ICON_CACHE.set(b64, bytes);
  }
  return new Response(bytes, {
    headers: { "content-type": type, "cache-control": "public, max-age=86400", ...CORS },
  });
}

export function createWorker<C>(config: ServerConfig<C>): ExportedHandler<Env> {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const origin = `${url.protocol}//${url.host}`;
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const hub = env.HUB_URL ?? "https://mcp-hub.ksqsebastian.workers.dev";

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
      }

      switch (`${request.method} ${path}`) {
        case "GET /":
          return landingPage(config.brand, origin, config.tools.length, hub);

        case "GET /favicon.svg":
        case "GET /icon.svg":
          return new Response(config.brand.logoSvg, {
            headers: {
              "content-type": "image/svg+xml",
              "cache-control": "public, max-age=86400",
              ...CORS,
            },
          });

        /* Rasterfassungen. Ohne sie bleibt jede Stelle leer, die kein SVG liest. */
        case "GET /favicon.ico":
          if (!config.brand.icon) break;
          return iconResponse(config.brand.icon.ico, "image/x-icon");

        case "GET /icon.png":
          if (!config.brand.icon) break;
          return iconResponse(config.brand.icon.png512, "image/png");

        case "GET /apple-touch-icon.png":
        case "GET /apple-touch-icon-precomposed.png":
          if (!config.brand.icon) break;
          return iconResponse(config.brand.icon.png180, "image/png");

        case "GET /.well-known/oauth-authorization-server":
        case "GET /.well-known/oauth-authorization-server/mcp":
          return json(authServerMetadata(origin, config.scopes));

        case "GET /.well-known/oauth-protected-resource":
        case "GET /.well-known/oauth-protected-resource/mcp":
          return json(protectedResourceMetadata(origin, config.scopes));

        case "POST /register":
          return handleRegister(request, env);

        case "GET /authorize":
          return handleAuthorizeGet(url, env, config);

        case "POST /authorize":
          return handleAuthorizePost(request, env, config);

        case "POST /token":
          return handleToken(request, env, config);

        case "POST /revoke":
          return handleRevoke(request, env);

        /** Öffentlicher Katalog — die Übersichtsseite baut sich daraus, ohne Zugangsdaten. */
        case "GET /tools.json":
          return json({
            server: {
              name: config.serverInfo.name,
              version: config.serverInfo.version,
              protocolVersion: PROTOCOL_VERSION,
            },
            mcpUrl: `${origin}/mcp`,
            auth: "oauth2",
            tools: publicToolList(config.tools),
          });

        case "GET /mcp":
          // Zustandslos: kein server-initiierter SSE-Stream.
          return json(
            { error: "method_not_allowed", error_description: "MCP läuft hier über POST /mcp." },
            405,
          );

        case "DELETE /mcp":
          return new Response(null, { status: 204, headers: CORS });

        case "POST /mcp": {
          const session = await authenticate(request, env);
          if (!session) {
            return unauthorized(
              origin,
              config.serverInfo.name,
              "Gültiges Bearer-Token erforderlich.",
            );
          }
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json(
              { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
              400,
            );
          }
          const res = await handleRpc(body, session, env.OAUTH_KV, origin, config);
          if (res === null) return new Response(null, { status: 202, headers: CORS });
          return json(res);
        }
      }

      const extra = await config.extraRoutes?.(request, url, env);
      if (extra) return extra;

      return errorPage(
        config.brand,
        "Nicht gefunden",
        `${request.method} ${path} gibt es hier nicht.`,
        404,
      );
    },
  };
}
