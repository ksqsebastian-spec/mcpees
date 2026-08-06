/**
 * Übersichtsseite über alle MCP-Server.
 *
 *   GET /               Alle Server
 *   GET /s/<id>         Ein Server mit vollständiger Tool-Liste
 *   GET /registry.json  Dasselbe maschinenlesbar
 */
import { REGISTRY, byId } from "./registry";
import { fetchCatalog, type HubEnv } from "./catalog";
import { overviewPage, serverPage, notFound } from "./ui";

export default {
  async fetch(request: Request, env: HubEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/") {
      const rows = await Promise.all(
        REGISTRY.map(async (entry) => ({ entry, catalog: await fetchCatalog(entry, env) })),
      );
      return overviewPage(rows);
    }

    if (path === "/registry.json") {
      const rows = await Promise.all(
        REGISTRY.map(async (entry) => {
          const catalog = await fetchCatalog(entry, env);
          return {
            id: entry.id,
            name: entry.name,
            description: entry.description,
            mcpUrl: entry.mcpUrl,
            auth: entry.auth,
            status: entry.status,
            reachable: catalog.ok,
            toolCount: catalog.tools.length,
            tools: catalog.tools.map((t) => ({
              name: t.name,
              description: t.description,
              readOnly: Boolean(t.annotations?.readOnlyHint),
            })),
          };
        }),
      );
      return new Response(JSON.stringify({ servers: rows }, null, 2), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=120",
          "access-control-allow-origin": "*",
        },
      });
    }

    const match = /^\/s\/([a-z0-9-]+)$/.exec(path);
    if (match) {
      const entry = byId.get(match[1]);
      if (!entry) return notFound();
      return serverPage(entry, await fetchCatalog(entry, env));
    }

    return notFound();
  },
};
