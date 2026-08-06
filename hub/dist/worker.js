// hub/src/registry.ts
var REGISTRY = [
  {
    id: "hero",
    name: "HERO",
    tagline: "Handwerkersoftware",
    description: "Projekte, Kunden, Angebote, Rechnungen, Termine, Zeiten und Field-Service aus HERO direkt im Chat. Lesen und Anlegen \u2014 kein Bearbeiten, kein L\xF6schen.",
    origin: "https://hero-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://hero-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    accent: "#FFC400",
    icon: "H",
    catalog: "tools.json",
    binding: "HERO",
    notes: [
      "OAuth 2.1 mit PKCE \u2014 jeder Nutzer hinterlegt beim Verbinden seinen eigenen HERO-API-Key.",
      "Mehrmandantenf\xE4hig: dieselbe URL funktioniert f\xFCr mehrere Betriebe.",
      "Der API-Key wird verschl\xFCsselt abgelegt; entschl\xFCsseln kann ihn nur der Token-Inhaber."
    ]
  },
  {
    id: "hero-vercel",
    name: "HERO (alt)",
    tagline: "Python-Server auf Vercel",
    description: "Die erste Fassung des HERO-Servers: gleiche 34 Tools, aber ohne Authentifizierung und mit fest verdrahtetem API-Key f\xFCr genau einen Mandanten. Abgel\xF6st durch die Cloudflare-Fassung mit OAuth.",
    origin: "https://hero-mcp.vercel.app",
    mcpUrl: "https://hero-mcp.vercel.app/mcp",
    auth: "none",
    status: "abgel\xF6st",
    accent: "#8b8b93",
    icon: "H",
    catalog: "mcp",
    notes: [
      "Ohne Auth: wer die URL kennt, kann den hinterlegten HERO-Account bedienen.",
      "upload_file und attach_pdf erwarten dort einen lokalen Dateipfad, den es serverseitig nicht gibt."
    ]
  }
];
var byId = new Map(REGISTRY.map((s) => [s.id, s]));

// hub/src/catalog.ts
var CACHE_SECONDS = 300;
async function fetchCatalog(entry, env = {}) {
  const service = entry.binding ? env[entry.binding] : void 0;
  const get = (url, init) => service ? service.fetch(new Request(url, init)) : fetch(url, init);
  try {
    if (entry.catalog === "tools.json") {
      const res2 = await get(`${entry.origin}/tools.json`, {
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
      });
      if (!res2.ok) return { ok: false, tools: [], error: `HTTP ${res2.status}` };
      const body2 = await res2.json();
      return { ok: true, tools: body2.tools ?? [], serverVersion: body2.server?.version };
    }
    const res = await get(entry.mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    if (!res.ok) return { ok: false, tools: [], error: `HTTP ${res.status}` };
    const text = await res.text();
    const line = text.includes("data:") ? text.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim() : text;
    if (!line) return { ok: false, tools: [], error: "leere Antwort" };
    const body = JSON.parse(line);
    if (body.error) return { ok: false, tools: [], error: body.error.message };
    return { ok: true, tools: body.result?.tools ?? [] };
  } catch (e) {
    return { ok: false, tools: [], error: e.message };
  }
}

// hub/src/ui.ts
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var CSS = `
:root { color-scheme: light dark;
  --bg:#fbfbfc; --fg:#17171a; --muted:#6b7280; --card:#fff; --line:#e8e8ea;
  --chip:#f3f3f5; --link:#0b62d0; --ok:#0f7b3d; --okbg:#e8f6ee; --warn:#8a5a00; --warnbg:#fdf3dc; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#0d0d0f; --fg:#ececed; --muted:#8b8b93; --card:#16161a; --line:#26262b;
  --chip:#1e1e23; --link:#6aa9f5; --ok:#57cc8a; --okbg:#12261a; --warn:#e8b45a; --warnbg:#2a2110; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg);
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; }
.wrap { max-width:960px; margin:0 auto; padding:56px 22px 88px; }
a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
h1 { font-size:34px; line-height:1.2; letter-spacing:-.03em; margin:0 0 12px; }
h2 { font-size:20px; letter-spacing:-.02em; margin:44px 0 14px; }
h3 { font-size:16px; margin:0; letter-spacing:-.01em; }
p { margin:0 0 16px; color:var(--muted); max-width:66ch; }
.lede { font-size:18px; color:var(--muted); margin-bottom:34px; }
.grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); }
.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px;
  display:flex; flex-direction:column; gap:12px; }
.card.link:hover { border-color:var(--muted); }
.head { display:flex; align-items:center; gap:13px; }
.ico { width:42px; height:42px; border-radius:11px; flex:0 0 auto; display:grid; place-items:center;
  font-weight:800; font-size:19px; color:#17171a; letter-spacing:-.02em; }
.head .sub { color:var(--muted); font-size:13px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { font-size:12px; font-weight:600; padding:3px 9px; border-radius:999px;
  background:var(--chip); color:var(--muted); border:1px solid var(--line); white-space:nowrap; }
.chip.ok { background:var(--okbg); color:var(--ok); border-color:transparent; }
.chip.warn { background:var(--warnbg); color:var(--warn); border-color:transparent; }
.url { display:flex; gap:8px; align-items:stretch; }
.url input { flex:1; min-width:0; font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
  padding:9px 11px; border-radius:9px; border:1px solid var(--line);
  background:var(--chip); color:var(--fg); }
.url button { padding:9px 13px; border-radius:9px; border:1px solid var(--line);
  background:var(--card); color:var(--fg); font:600 13px/1 inherit; cursor:pointer; }
.url button:hover { background:var(--chip); }
.tool { border-top:1px solid var(--line); padding:15px 0; }
.tool:first-of-type { border-top:0; }
.tool .tname { display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; }
code, .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.tool code.n { font-size:14.5px; font-weight:650; color:var(--fg); }
.tool p { margin:5px 0 0; font-size:14.5px; }
.args { margin:9px 0 0; display:flex; flex-wrap:wrap; gap:6px; }
.arg { font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; padding:2px 8px;
  border-radius:7px; background:var(--chip); border:1px solid var(--line); color:var(--muted); }
.arg b { color:var(--fg); font-weight:650; }
.arg .req { color:#c2410c; }
@media (prefers-color-scheme: dark) { .arg .req { color:#fb923c; } }
.search { width:100%; padding:11px 14px; font:15px/1.4 inherit; border-radius:10px;
  border:1px solid var(--line); background:var(--card); color:var(--fg); margin-bottom:18px; }
.search:focus { outline:2px solid var(--link); outline-offset:1px; }
.note { background:var(--chip); border:1px solid var(--line); border-radius:11px;
  padding:14px 16px; font-size:14px; color:var(--muted); }
.note ul { margin:0; padding-left:19px; } .note li { margin:4px 0; }
.foot { margin-top:56px; padding-top:22px; border-top:1px solid var(--line);
  font-size:13.5px; color:var(--muted); }
.back { font-size:14px; display:inline-block; margin-bottom:20px; }
.count { color:var(--muted); font-size:14px; font-weight:400; }
`;
var COPY_JS = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
    var old = b.textContent; b.textContent = 'Kopiert'; setTimeout(function(){ b.textContent = old; }, 1400);
  });
});`;
var FILTER_JS = `
var q = document.getElementById('q');
if (q) q.addEventListener('input', function () {
  var v = this.value.toLowerCase();
  document.querySelectorAll('[data-tool]').forEach(function (el) {
    el.style.display = el.getAttribute('data-tool').indexOf(v) === -1 ? 'none' : '';
  });
});`;
function shell(title, body, extraJs = "") {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="\xDCbersicht der MCP-Server: Endpunkte, Authentifizierung und alle Tools.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b62d0"/><path d="M18 44V20h7l7 12 7-12h7v24h-7V32l-7 11-7-11v12z" fill="#fff"/></svg>'
  )}">
<style>${CSS}</style></head><body><div class="wrap">${body}</div>
<script>${COPY_JS}${extraJs}</script></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" }
  });
}
function urlBox(url) {
  return `<div class="url"><input readonly value="${esc(url)}" onclick="this.select()">
<button data-copy="${esc(url)}">Kopieren</button></div>`;
}
function authChip(entry) {
  return entry.auth === "oauth" ? `<span class="chip ok">OAuth 2.1</span>` : `<span class="chip warn">ohne Auth</span>`;
}
function overviewPage(rows) {
  const cards = rows.map(({ entry, catalog }) => {
    const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint).length;
    const write = catalog.tools.length - read;
    return `<article class="card link">
<div class="head"><div class="ico" style="background:${esc(entry.accent)}">${esc(entry.icon)}</div>
<div><h3><a href="/s/${esc(entry.id)}">${esc(entry.name)}</a></h3>
<div class="sub">${esc(entry.tagline)}</div></div></div>
<p style="margin:0;font-size:14.5px">${esc(entry.description)}</p>
<div class="chips">${authChip(entry)}
${entry.status === "aktiv" ? "" : `<span class="chip">abgel\xF6st</span>`}
${catalog.ok ? `<span class="chip">${catalog.tools.length} Tools</span>
       <span class="chip">${read} lesend</span><span class="chip">${write} schreibend</span>` : `<span class="chip warn">nicht erreichbar</span>`}</div>
${urlBox(entry.mcpUrl)}
<div style="font-size:14px"><a href="/s/${esc(entry.id)}">Alle Tools ansehen \u2192</a></div>
</article>`;
  }).join("");
  return shell(
    "MCP-Server \u2014 \xDCbersicht",
    `<h1>MCP-Server</h1>
<p class="lede">Alle selbst betriebenen Model-Context-Protocol-Server an einem Ort:
Endpunkt, Authentifizierung und was jedes Tool tut.</p>
<div class="grid">${cards}</div>
<h2>Einen Server in Claude verbinden</h2>
<div class="note"><ol style="margin:0;padding-left:19px">
<li>In Claude: <b>Einstellungen \u2192 Connectors \u2192 Connector hinzuf\xFCgen</b>.</li>
<li>Die Server-URL von oben einf\xFCgen und best\xE4tigen.</li>
<li>Bei Servern mit OAuth \xF6ffnet sich eine Anmeldeseite \u2014 dort einmalig die Zugangsdaten
f\xFCr das jeweilige Fachsystem hinterlegen.</li>
</ol></div>
<div class="foot">Die Tool-Listen werden live von den Servern geholt, nicht hier gepflegt \u2014
was hier steht, ist das, was der Server wirklich kann.
<a href="/registry.json">registry.json</a></div>`
  );
}
function argChips(tool) {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const names = Object.keys(props);
  if (!names.length) return `<div class="args"><span class="arg">keine Argumente</span></div>`;
  return `<div class="args">` + names.map((n) => {
    const type = props[n]?.type ?? "any";
    const isReq = required.has(n);
    return `<span class="arg" title="${esc(props[n]?.description ?? "")}">
<b>${esc(n)}</b>${isReq ? `<span class="req">*</span>` : ""}: ${esc(type)}</span>`;
  }).join("") + `</div>`;
}
function toolBlock(tool) {
  const kind = tool.annotations?.readOnlyHint ? `<span class="chip ok">lesend</span>` : `<span class="chip">schreibend</span>`;
  const hay = `${tool.name} ${tool.title ?? ""} ${tool.description}`.toLowerCase();
  return `<div class="tool" data-tool="${esc(hay)}">
<div class="tname"><code class="n">${esc(tool.name)}</code>
${tool.title ? `<span class="count">${esc(tool.title)}</span>` : ""}${kind}</div>
<p>${esc(tool.description)}</p>${argChips(tool)}</div>`;
}
function serverPage(entry, catalog) {
  const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint);
  const write = catalog.tools.filter((t) => !t.annotations?.readOnlyHint);
  const body = catalog.ok ? `<input id="q" class="search" placeholder="Tools durchsuchen \u2014 Name oder Beschreibung">
<h2>Lesend <span class="count">${read.length} Tools \xB7 k\xF6nnen nichts ver\xE4ndern</span></h2>
<div class="card" style="padding:6px 22px">${read.map(toolBlock).join("")}</div>
<h2>Schreibend <span class="count">${write.length} Tools \xB7 legen an, \xE4ndern und l\xF6schen nichts</span></h2>
<div class="card" style="padding:6px 22px">${write.map(toolBlock).join("")}</div>` : `<div class="note">Der Server antwortet gerade nicht (${esc(catalog.error)}).
Die Tool-Liste wird live geholt und kann deshalb hier fehlen, w\xE4hrend der Server neu startet.</div>`;
  return shell(
    `${entry.name} \u2014 MCP-Server`,
    `<a class="back" href="/">\u2190 Alle Server</a>
<div class="head" style="margin-bottom:14px">
<div class="ico" style="background:${esc(entry.accent)};width:52px;height:52px;font-size:23px">${esc(entry.icon)}</div>
<div><h1 style="margin:0;font-size:27px">${esc(entry.name)}</h1>
<div class="sub" style="color:var(--muted)">${esc(entry.tagline)}</div></div></div>
<p>${esc(entry.description)}</p>
<div class="chips" style="margin-bottom:16px">${authChip(entry)}
<span class="chip">${entry.status}</span>
${catalog.ok ? `<span class="chip">${catalog.tools.length} Tools</span>` : ""}
${catalog.serverVersion ? `<span class="chip">v${esc(catalog.serverVersion)}</span>` : ""}</div>
${urlBox(entry.mcpUrl)}
${entry.notes?.length ? `<div class="note" style="margin-top:18px"><ul>${entry.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
${body}
<div class="foot"><a href="${esc(entry.origin)}">${esc(entry.origin)}</a> \xB7
Katalog live vom Server geholt</div>`,
    FILTER_JS
  );
}
function notFound() {
  return shell(
    "Nicht gefunden",
    `<h1>Nicht gefunden</h1><p>Diese Seite gibt es nicht.</p><p><a href="/">\u2190 Alle Server</a></p>`
  );
}

// hub/src/index.ts
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") {
      const rows = await Promise.all(
        REGISTRY.map(async (entry) => ({ entry, catalog: await fetchCatalog(entry, env) }))
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
              readOnly: Boolean(t.annotations?.readOnlyHint)
            }))
          };
        })
      );
      return new Response(JSON.stringify({ servers: rows }, null, 2), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=120",
          "access-control-allow-origin": "*"
        }
      });
    }
    const match = /^\/s\/([a-z0-9-]+)$/.exec(path);
    if (match) {
      const entry = byId.get(match[1]);
      if (!entry) return notFound();
      return serverPage(entry, await fetchCatalog(entry, env));
    }
    return notFound();
  }
};
export {
  index_default as default
};
