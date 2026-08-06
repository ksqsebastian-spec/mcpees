/**
 * HERO MCP Server auf Cloudflare Workers.
 *
 *   GET  /                                          Infoseite
 *   GET  /.well-known/oauth-authorization-server    RFC 8414
 *   GET  /.well-known/oauth-protected-resource[/mcp] RFC 9728
 *   POST /register                                  RFC 7591 Dynamic Client Registration
 *   GET  /authorize | POST /authorize               Login (HERO-Key) → Auth-Code
 *   POST /token                                     Code-Tausch und Refresh
 *   POST /revoke                                    RFC 7009
 *   POST /mcp                                       MCP, Bearer-Token erforderlich
 *   GET  /tools.json                                Tool-Katalog (öffentlich, für die Übersichtsseite)
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
  type Env,
} from "./oauth";
import { handleRpc, publicToolList, PROTOCOL_VERSION, SERVER_VERSION } from "./mcp";
import { landingPage, errorPage, LOGO_SVG } from "./ui";
import { tools } from "./tools";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-protocol-version",
  "access-control-max-age": "86400",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    switch (`${request.method} ${path}`) {
      case "GET /":
        return landingPage(origin, tools.length, env.HUB_URL ?? "https://mcp-hub.ksqsebastian.workers.dev");

      case "GET /favicon.svg":
        return new Response(LOGO_SVG, {
          headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
        });

      case "GET /.well-known/oauth-authorization-server":
      case "GET /.well-known/oauth-authorization-server/mcp":
        return json(authServerMetadata(origin));

      case "GET /.well-known/oauth-protected-resource":
      case "GET /.well-known/oauth-protected-resource/mcp":
        return json(protectedResourceMetadata(origin));

      case "POST /register":
        return handleRegister(request, env);

      case "GET /authorize":
        return handleAuthorizeGet(url, env);

      case "POST /authorize":
        return handleAuthorizePost(request, env);

      case "POST /token":
        return handleToken(request, env);

      case "POST /revoke":
        return handleRevoke(request, env);

      /** Öffentlicher Katalog — die Übersichtsseite baut sich daraus, ohne Zugangsdaten. */
      case "GET /tools.json":
        return json({
          server: { name: "hero", version: SERVER_VERSION, protocolVersion: PROTOCOL_VERSION },
          mcpUrl: `${origin}/mcp`,
          auth: "oauth2",
          tools: publicToolList(),
        });

      case "GET /mcp":
        // Zustandslos: kein server-initiierter SSE-Stream.
        return json({ error: "method_not_allowed", error_description: "MCP läuft hier über POST /mcp." }, 405);

      case "DELETE /mcp":
        return new Response(null, { status: 204, headers: CORS });

      case "POST /mcp": {
        const session = await authenticate(request, env);
        if (!session) {
          return unauthorized(origin, "Gültiges Bearer-Token erforderlich.");
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
        }
        const res = await handleRpc(body, session, env.OAUTH_KV);
        if (res === null) {
          return new Response(null, { status: 202, headers: CORS });
        }
        return json(res);
      }
    }

    return errorPage("Nicht gefunden", `${request.method} ${path} gibt es hier nicht.`, 404);
  },
};
