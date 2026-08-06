/** HTML für Login-, Landing- und Fehlerseiten. Kein Framework, kein externes Asset. */

export const BRAND = "#FFC400";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  background:#fafafa; color:#1b1b1b; display:flex; align-items:center; justify-content:center;
  min-height:100vh; padding:32px 20px; }
.card { background:#fff; max-width:520px; width:100%; border-radius:16px; padding:32px;
  box-shadow:0 1px 3px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.08); }
.brand { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
.brand .logo { width:40px; height:40px; border-radius:10px; flex:0 0 auto; }
.brand b { font-size:18px; letter-spacing:-.01em; }
.brand span { display:block; font-size:13px; color:#6b7280; font-weight:400; }
h1 { font-size:20px; margin:0 0 8px; letter-spacing:-.02em; }
p { margin:0 0 16px; color:#3f3f46; }
.muted { color:#6b7280; font-size:14px; }
label { display:block; font-weight:600; font-size:14px; margin:20px 0 6px; }
input[type=password], input[type=text] { width:100%; padding:11px 13px; font-size:15px;
  border:1px solid #d4d4d8; border-radius:9px; background:#fff; color:inherit; font-family:inherit; }
input:focus { outline:2px solid ${BRAND}; outline-offset:1px; border-color:transparent; }
button { width:100%; margin-top:22px; padding:12px 16px; font-size:15px; font-weight:650;
  border:0; border-radius:9px; background:${BRAND}; color:#1b1b1b; cursor:pointer; font-family:inherit; }
button:hover { filter:brightness(.95); }
.app { background:#f4f4f5; border-radius:10px; padding:14px 16px; margin:20px 0;
  font-size:14px; border:1px solid #e4e4e7; }
.app b { display:block; font-size:15px; }
.err { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:10px;
  padding:12px 14px; margin-bottom:16px; font-size:14px; }
code { background:#f4f4f5; padding:2px 6px; border-radius:5px; font-size:.9em;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
ul { padding-left:20px; color:#3f3f46; } li { margin:6px 0; }
a { color:#0b62d0; }
.foot { margin-top:26px; padding-top:18px; border-top:1px solid #ececed; font-size:13px; color:#6b7280; }
@media (prefers-color-scheme: dark) {
  body { background:#111113; color:#ececed; }
  .card { background:#19191c; box-shadow:0 1px 3px rgba(0,0,0,.5); }
  input[type=password], input[type=text] { background:#0e0e10; border-color:#2e2e33; color:#ececed; }
  .app { background:#111113; border-color:#2e2e33; }
  p, ul { color:#c4c4c8; } .muted,.foot { color:#8b8b93; }
  code { background:#26262b; } .foot { border-color:#26262b; }
  .err { background:#2a1416; border-color:#5c2427; color:#fca5a5; }
}
`;

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="${BRAND}"/>
<path fill="#1b1b1b" d="M150 130 L226 130 L226 232 L286 232 L286 130 L362 130 L362 382 L286 382 L286 280 L226 280 L226 382 L150 382 Z"/>
<path fill="${BRAND}" d="M150 130 L150 205 L200 130 Z"/>
<path fill="${BRAND}" d="M362 382 L362 307 L312 382 Z"/></svg>`;

const LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`;

export function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="${LOGO_DATA_URI}">
<style>${CSS}</style></head><body><main class="card">
<div class="brand"><img class="logo" src="${LOGO_DATA_URI}" alt="">
<div><b>HERO MCP</b><span>Handwerkersoftware für Claude</span></div></div>
${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export function consentPage(opts: {
  clientName: string;
  clientUri?: string;
  params: Record<string, string>;
  error?: string;
}): Response {
  const hidden = Object.entries(opts.params)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return page(
    "HERO MCP verbinden",
    `${opts.error ? `<div class="err">${esc(opts.error)}</div>` : ""}
<h1>Zugriff erlauben</h1>
<div class="app"><b>${esc(opts.clientName)}</b>
<span class="muted">${opts.clientUri ? esc(opts.clientUri) : "möchte auf deinen HERO-Account zugreifen"}</span></div>
<p>Gib deinen persönlichen HERO-API-Key ein. Er wird gegen HERO geprüft und danach
<b>verschlüsselt</b> gespeichert — entschlüsseln kann ihn nur der Client, der das ausgestellte
Token hält.</p>
<form method="post">${hidden}
<label for="key">HERO-API-Key</label>
<input id="key" name="hero_api_key" type="password" autocomplete="off" spellcheck="false"
  placeholder="Bearer-Token aus HERO → Einstellungen → API" required autofocus>
<button type="submit">Prüfen und verbinden</button></form>
<div class="foot">Den Key findest du in HERO unter <b>Einstellungen → API</b>.
Der Zugriff gilt genau für diesen Client und lässt sich jederzeit widerrufen,
indem du den Key in HERO neu erzeugst.</div>`,
  );
}

export function errorPage(title: string, message: string, status = 400): Response {
  return page(title, `<h1>${esc(title)}</h1><div class="err">${esc(message)}</div>`, status);
}

export function landingPage(origin: string, toolCount: number, hubUrl: string): Response {
  return page(
    "HERO MCP Server",
    `<h1>HERO MCP Server</h1>
<p>Model-Context-Protocol-Server für die HERO-Handwerkersoftware —
<b>${toolCount} Tools</b> zum Lesen, Anlegen, Hochladen und Herunterladen.
Geschützt mit OAuth 2.1; jeder Nutzer verbindet seinen eigenen HERO-Account.</p>
<label>Server-URL</label>
<input type="text" readonly value="${esc(origin)}/mcp" onclick="this.select()">
<p class="muted" style="margin-top:12px">In Claude: <b>Einstellungen → Connectors → Connector
hinzufügen</b>, URL einfügen, dann öffnet sich die Anmeldung und du hinterlegst deinen HERO-API-Key.</p>
<ul>
<li><b>Lesen</b> — Dashboard, Suche, Projekte, Kunden, Dokumente, Artikel, Lager, Aufträge,
Checklisten, Termine, Zeiten, offene Posten, Zahlungsstatus, Belege, PDF-Links</li>
<li><b>Schreiben</b> — Kunden, Projekte, Angebote, Rechnungen, Stundenzettel, Aufträge,
Checklisten, Artikel, Termine, Aufgaben, Zeiten, Logbuch, Zahlungen, Leads, Dateien</li>
<li><b>Nicht enthalten</b> — Bearbeiten und Löschen. Nichts kann kaputtgehen.</li>
</ul>
<div class="foot"><a href="${esc(hubUrl)}">Alle MCP-Server im Überblick →</a></div>`,
  );
}
