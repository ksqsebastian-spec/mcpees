/** Die Übersichtsseite. Alles inline — kein CDN, keine externen Assets, kein Tracking. */
import { REGISTRY, type ServerEntry } from "./registry";
import type { Catalog, ToolInfo } from "./catalog";
import { BASE_CSS, COPY_JS, inkOn } from "../../shared/src/style";
import { composeLogo } from "../../shared/src/marks";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HUB_CSS = `
header {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  border-bottom: 1px solid transparent;
  transition: border-color .3s var(--ease);
}
header.stuck { border-bottom-color: var(--line); }
header .inner { display: flex; align-items: center; justify-content: space-between; height: 62px; }
.wordmark { font-weight: 620; font-size: 15.5px; letter-spacing: -.022em; display: flex; align-items: center; gap: 9px; }
.wordmark .mark { width: 9px; height: 9px; border-radius: 3px; background: var(--ink); }
header .right { font-size: 13.5px; color: var(--ink-3); }

/* ── Kopfbereich ──────────────────────────────────────────────────────── */
.hero { padding: 86px 0 68px; }
.hero .lede { margin-top: 20px; }

/* ── Erklärung ────────────────────────────────────────────────────────── */
.explain { padding: 8px 0 74px; }
.explain h2 { font-size: 1.6rem; letter-spacing: -.032em; margin: 14px 0 18px; }
.explain p { color: var(--ink-2); font-size: 1.04rem; line-height: 1.66; max-width: 58ch; }
.explain p + p { margin-top: 15px; }
.explain b { color: var(--ink); font-weight: 600; }
.steps { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line);
  border-radius: var(--radius); overflow: hidden; margin-top: 34px; grid-template-columns: repeat(3, 1fr); }
.step { background: var(--surface); padding: 24px 22px; }
.step .n {
  width: 25px; height: 25px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid var(--line-strong); font-size: 12.5px; font-weight: 620; color: var(--ink-2);
  margin-bottom: 13px;
}
.step h3 { font-size: 1rem; letter-spacing: -.018em; margin-bottom: 6px; }
.step p { font-size: .91rem; color: var(--ink-2); line-height: 1.55; }
@media (max-width: 720px) { .steps { grid-template-columns: 1fr; } }

/* ── Serverliste ──────────────────────────────────────────────────────── */
.servers { padding-bottom: 90px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.srv { display: flex; flex-direction: column; gap: 15px; }
.srv .top { display: flex; align-items: center; gap: 14px; }
.srv h3 { font-size: 1.14rem; letter-spacing: -.024em; }
.srv .go { margin-top: auto; }
.srv .tag { font-size: .84rem; color: var(--ink-3); margin-top: 2px; }
.srv .desc { color: var(--ink-2); font-size: .95rem; line-height: 1.57; }
.srv .facts { font-size: .84rem; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.srv .facts .sep { opacity: .45; }
.srv .facts .live { color: #12833f; font-weight: 600; }
.srv .facts .down { color: #b8442e; font-weight: 600; }

/* ── Detailseite ──────────────────────────────────────────────────────── */
.back { display: inline-flex; align-items: center; gap: .4em; font-size: .9rem; color: var(--ink-2); padding: 30px 0 26px; }
.back .arrow { transition: transform .28s var(--ease); }
.back:hover .arrow { transform: translateX(-3px); }
.detail-body { max-width: 68ch; }
.detail-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.detail-head h1 { font-size: 2.05rem; letter-spacing: -.038em; }
.detail-head .tag { color: var(--ink-3); font-size: .93rem; margin-top: 3px; }
.notes { list-style: none; padding: 0; margin: 26px 0 0; }
.notes li { position: relative; padding-left: 19px; margin: 10px 0; color: var(--ink-2); font-size: .93rem; line-height: 1.55; }
.notes li::before { content: ""; position: absolute; left: 2px; top: .6em; width: 5px; height: 5px; border-radius: 50%; background: var(--ink-3); }

.toolbar { position: relative; margin: 54px 0 6px; max-width: 68ch; }
.search {
  width: 100%; padding: 13px 15px 13px 42px; font: 400 15.5px/1.5 inherit;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--ink);
  transition: border-color .2s var(--ease), box-shadow .2s var(--ease);
}
.search::placeholder { color: var(--ink-3); }
.search:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 13%, transparent); }
.toolbar .glass { position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
  color: var(--ink-3); pointer-events: none; display: flex; }

.group { margin-top: 42px; max-width: 76ch; }
.group .head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
.group .head h2 { font-size: 1.06rem; letter-spacing: -.02em; }
.group .head .count { font-size: .86rem; color: var(--ink-3); }
.group .hint { font-size: .88rem; color: var(--ink-3); margin-bottom: 14px; }

.tool { padding: 20px 0; border-top: 1px solid var(--line); transition: opacity .2s var(--ease); }
.tool .row { display: flex; align-items: baseline; gap: 11px; flex-wrap: wrap; }
.tool .n { font: 600 14.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -.01em; }
.tool .t { font-size: .88rem; color: var(--ink-3); }
.tool .d { margin-top: 6px; color: var(--ink-2); font-size: .94rem; line-height: 1.58; max-width: 74ch; }
.tool .a { margin-top: 9px; font: 400 12.5px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-3); }
.tool .a b { color: var(--ink-2); font-weight: 600; }
.tool .a .req { color: #b8442e; }
.tool[hidden] { display: none; }
.empty { padding: 34px 0; color: var(--ink-3); font-size: .95rem; }

footer { border-top: 1px solid var(--line); padding: 34px 0 60px; font-size: .87rem; color: var(--ink-3); line-height: 1.65; }
footer a { color: var(--ink-2); text-decoration: underline; text-underline-offset: 2px; }
`;

const FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="16" fill="#131316"/>' +
  '<rect x="18" y="18" width="10" height="10" rx="3" fill="#fff"/>' +
  '<rect x="36" y="18" width="10" height="10" rx="3" fill="#fff" opacity=".55"/>' +
  '<rect x="18" y="36" width="10" height="10" rx="3" fill="#fff" opacity=".55"/>' +
  '<rect x="36" y="36" width="10" height="10" rx="3" fill="#fff"/></svg>';

const HEADER_JS = `
(function () {
  var h = document.querySelector('header');
  if (!h) return;
  var onScroll = function () { h.classList.toggle('stuck', window.scrollY > 6); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();`;

const FILTER_JS = `
(function () {
  var q = document.getElementById('q');
  if (!q) return;
  q.addEventListener('input', function () {
    var v = this.value.trim().toLowerCase();
    var visible = 0;
    document.querySelectorAll('[data-tool]').forEach(function (el) {
      var hit = !v || el.getAttribute('data-tool').indexOf(v) !== -1;
      el.hidden = !hit;
      if (hit) visible++;
    });
    document.querySelectorAll('.group').forEach(function (g) {
      var shown = g.querySelectorAll('.tool:not([hidden])').length;
      g.hidden = shown === 0;
      // Der Zähler muss mitlaufen, sonst behauptet die Überschrift eine Zahl,
      // die neben der gefilterten Liste sichtbar falsch ist.
      var c = g.querySelector('.count');
      if (c) {
        var total = c.getAttribute('data-total');
        c.textContent = v ? shown + ' von ' + total : total + ' Tools';
      }
    });
    var none = document.getElementById('none');
    if (none) none.hidden = visible > 0;
  });
})();`;

function shell(
  title: string,
  description: string,
  body: string,
  extraJs = "",
  status = 200,
): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<style>${BASE_CSS}${HUB_CSS}</style></head><body>
${body}
<script>${COPY_JS}${HEADER_JS}${extraJs}</script></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Ein 404 darf nicht am Rand hängenbleiben — sonst bleibt eine entfernte Seite
      // noch Minuten lang „vorhanden".
      "cache-control": status === 200 ? "public, max-age=120" : "no-store",
    },
  });
}

const header = (right = "") => `<header><div class="wrap inner">
<a class="wordmark" href="/"><span class="mark"></span>MCP-Server</a>
<div class="right">${right}</div></div></header>`;

/**
 * Der Markenhinweis nennt genau die Anbieter, deren Zeichen hier auftauchen — aus der
 * Registry gelesen, nicht fest verdrahtet. Sonst nennt er beim nächsten Server die
 * falschen Namen oder vergisst einen.
 */
function footer(): string {
  const fremd = REGISTRY.filter((e) => e.thirdPartyBrand).map((e) => e.name);
  // Aufzählung mit Komma und einem „und" am Ende — bei drei Namen liest sich
  // „A und B und C" wie ein Fehler.
  const namen =
    fremd.length > 1 ? `${fremd.slice(0, -1).join(", ")} und ${fremd[fremd.length - 1]}` : fremd[0];
  const hinweis = fremd.length
    ? `<br>${esc(namen)} ${fremd.length > 1 ? "sind Marken" : "ist eine Marke"} der
jeweiligen Anbieter. Die Logos stehen hier zur Kennzeichnung des angebundenen Systems;
es sind keine offiziellen Integrationen.`
    : "";
  return `<footer><div class="wrap">
Die Tool-Listen werden live von den Servern geholt, nicht hier gepflegt — was hier steht,
ist das, was der Server wirklich kann. <a href="/registry.json">registry.json</a>${hinweis}
</div></footer>`;
}

/**
 * Angezeigt wird die URL ohne Schema — sonst passt sie in der Kachel nicht und bricht ab.
 * Kopiert wird immer die vollständige URL, denn die braucht Claude.
 */
function urlbar(url: string, short = false): string {
  const shown = short ? url.replace(/^https?:\/\//, "") : url;
  return `<div class="urlbar"><input readonly value="${esc(shown)}"
onfocus="this.value='${esc(url)}';this.select()" onblur="this.value='${esc(shown)}'"
aria-label="Server-URL"><button class="copy" data-copy="${esc(url)}">Kopieren</button></div>`;
}

function tile(entry: ServerEntry, size = 44): string {
  if (entry.mark) {
    const svg = `data:image/svg+xml;base64,${btoa(composeLogo(entry.mark, 128))}`;
    return `<img class="tile" src="${svg}" alt="" width="${size}" height="${size}"
style="width:${size}px;height:${size}px">`;
  }
  return `<span class="tile" style="background:${esc(entry.accent)};color:${inkOn(entry.accent)};
width:${size}px;height:${size}px;font-size:${Math.round(size * 0.43)}px">${esc(entry.icon)}</span>`;
}

/* ── Übersicht ────────────────────────────────────────────────────────── */

export function overviewPage(rows: Array<{ entry: ServerEntry; catalog: Catalog }>): Response {
  const total = rows.reduce((n, r) => n + r.catalog.tools.length, 0);

  const cards = rows
    .map(({ entry, catalog }, i) => {
      const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint).length;
      const write = catalog.tools.length - read;
      // Bei einem reinen Lesedienst wäre "6 lesend, 0 schreibend" umständlich —
      // "nur lesend" sagt dasselbe und ist obendrein die interessantere Aussage.
      const kinds = !write ? "nur lesend" : !read ? "nur schreibend" : `${read} lesend, ${write} schreibend`;
      const facts = catalog.ok
        ? `<span class="live">Aktiv</span><span class="sep">·</span>
           <span>${catalog.tools.length} Tools</span><span class="sep">·</span>
           <span>${kinds}</span><span class="sep">·</span><span>OAuth</span>`
        : catalog.retired
          ? `<span class="down">Abgeschaltet</span>`
          : `<span class="down">Nicht erreichbar</span>`;
      return `<div class="card srv hoverable rise d${Math.min(6, i + 3)}">
<div class="top">${tile(entry)}
<div><h3><a href="/s/${esc(entry.id)}">${esc(entry.name)}</a></h3>
<div class="tag">${esc(entry.tagline)}</div></div></div>
<p class="desc">${esc(entry.description)}</p>
<div class="facts">${facts}</div>
${urlbar(entry.mcpUrl, true)}
<a class="go" href="/s/${esc(entry.id)}">Tools ansehen <span class="arrow">→</span></a></div>`;
    })
    .join("");

  return shell(
    "MCP-Server",
    "Eigene MCP-Server für Claude: Endpunkte, Anmeldung und alle Tools im Überblick.",
    `${header(`${rows.length} Server · ${total} Tools`)}
<section class="hero"><div class="wrap">
<h1 class="display rise">Eure Systeme,<br>direkt im Chat.</h1>
<p class="lede rise d1">Eigene MCP-Server, die Claude mit der Software verbinden,
mit der ihr ohnehin arbeitet. Ohne Export, ohne Copy-Paste.</p>
</div></section>

<section class="explain"><div class="wrap">
<div class="eyebrow rise d2">Kurz erklärt</div>
<h2 class="rise d2">Was ist ein MCP?</h2>
<div class="rise d3">
<p><b>MCP steht für Model Context Protocol</b> — eine gemeinsame Sprache, mit der ein
KI-Assistent wie Claude mit einer Software reden kann. Ungefähr das, was USB-C für Stecker
ist: eine Form, auf die sich alle einigen, damit nicht jedes Gerät sein eigenes Kabel braucht.</p>
<p>Ohne MCP weiß Claude nur, was im Gespräch steht. Mit MCP kann er in eure Systeme schauen
und dort arbeiten — nachsehen, wer noch nicht bezahlt hat, ein Angebot schreiben, einen Termin
eintragen. <b>Ein Server verbindet Claude mit genau einem System.</b></p>
<p>Was er darf, steht in seiner Tool-Liste, und mehr geht nicht. Die Server hier können lesen
und anlegen — <b>ändern und löschen können sie nicht</b>. Und sie sehen nur das, wofür ihr
euch beim Verbinden anmeldet.</p>
</div>
<div class="steps rise d4">
<div class="step"><div class="n">1</div><h3>URL eintragen</h3>
<p>In Claude unter Einstellungen → Connectors die Server-URL einfügen.</p></div>
<div class="step"><div class="n">2</div><h3>Einmal anmelden</h3>
<p>Es öffnet sich eine Anmeldeseite. Dort hinterlegt ihr euren Zugang zum jeweiligen System.</p></div>
<div class="step"><div class="n">3</div><h3>Fragen stellen</h3>
<p>„Wer schuldet uns noch was?" — Claude nutzt die passenden Tools von selbst.</p></div>
</div>
</div></section>

<section class="servers"><div class="wrap">
<div class="section-head rise d4"><h2>Server</h2><span class="meta">${rows.length} verfügbar</span></div>
<div class="grid">${cards}</div>
</div></section>
${footer()}`,
  );
}

/* ── Detailseite ──────────────────────────────────────────────────────── */

function argLine(tool: ToolInfo): string {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const names = Object.keys(props);
  if (!names.length) return `<div class="a">ohne Argumente</div>`;
  return (
    `<div class="a">` +
    names
      .map((n) => {
        const type = (props[n] as any)?.type ?? "any";
        return `<b>${esc(n)}</b>${required.has(n) ? `<span class="req">*</span>` : ""}:&nbsp;${esc(type)}`;
      })
      .join(" &nbsp;·&nbsp; ") +
    `</div>`
  );
}

function toolBlock(tool: ToolInfo): string {
  const hay = `${tool.name} ${tool.title ?? ""} ${tool.description}`.toLowerCase();
  return `<div class="tool" data-tool="${esc(hay)}">
<div class="row"><span class="n">${esc(tool.name)}</span>
${tool.title ? `<span class="t">${esc(tool.title)}</span>` : ""}</div>
<p class="d">${esc(tool.description)}</p>${argLine(tool)}</div>`;
}

/**
 * Eine Tool-Gruppe. Leere Gruppen fallen weg: ein reiner Lesedienst hätte sonst einen
 * Abschnitt „Schreibend — 0 Tools" mit der Erklärung, was schreibende Tools tun. Das las
 * sich, als fehle etwas.
 */
function group(title: string, hint: string, tools: ToolInfo[]): string {
  if (!tools.length) return "";
  return `<section class="group"><div class="head"><h2>${esc(title)}</h2>
<span class="count" data-total="${tools.length}">${tools.length} Tools</span></div>
<p class="hint">${esc(hint)}</p>
${tools.map(toolBlock).join("")}</section>`;
}

export function serverPage(entry: ServerEntry, catalog: Catalog): Response {
  const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint);
  const write = catalog.tools.filter((t) => !t.annotations?.readOnlyHint);

  const tools = catalog.ok
    ? `<div class="toolbar rise d4"><span class="glass"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6 L14 14" stroke-linecap="round"/></svg></span>
<input id="q" class="search" placeholder="Tools durchsuchen" autocomplete="off">
</div>
<div id="none" class="empty" hidden>Kein Tool passt zu dieser Suche.</div>
${group("Lesend", "Fragen ab. Können nichts verändern.", read)}
${group("Schreibend", "Legen Neues an. Ändern und löschen nichts Bestehendes.", write)}`
    : catalog.retired
      ? `<div class="note" style="margin-top:34px">Dieser Server ist abgeschaltet. Sein Endpoint
antwortet auf jeden Aufruf mit <b>HTTP 410</b> und nennt den Nachfolger.</div>`
      : `<div class="note" style="margin-top:34px">Der Server antwortet gerade nicht
(${esc(catalog.error)}). Die Tool-Liste wird live geholt und fehlt deshalb, während der Server
neu startet.</div>`;

  const facts = [
    catalog.ok ? `${catalog.tools.length} Tools` : null,
    entry.auth === "oauth" ? "OAuth 2.1 mit PKCE" : "ohne Authentifizierung",
    catalog.serverVersion ? `v${catalog.serverVersion}` : null,
  ]
    .filter(Boolean)
    .join(' <span style="opacity:.45">·</span> ');

  return shell(
    `${entry.name} — MCP-Server`,
    entry.description,
    `${header()}
<div class="wrap">
<a class="back" href="/"><span class="arrow">←</span> Alle Server</a>
<div class="detail-head rise">${tile(entry, 52)}
<div><h1>${esc(entry.name)}</h1><div class="tag">${esc(entry.tagline)}</div></div></div>
<p class="lede rise d1 detail-body" style="max-width:60ch;font-size:1.08rem">${esc(entry.description)}</p>
<p class="meta rise d1" style="margin:16px 0 26px">${facts}</p>
<div class="rise d2 detail-body">${urlbar(entry.mcpUrl)}</div>
${entry.notes?.length ? `<ul class="notes rise d3 detail-body">${entry.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
${tools}
</div>
${footer()}`,
    FILTER_JS,
  );
}

export function notFound(): Response {
  return shell(
    "Nicht gefunden",
    "Diese Seite gibt es nicht.",
    `${header()}<div class="wrap" style="padding:110px 0 140px">
<h1 class="display rise" style="font-size:2.4rem">Nicht gefunden</h1>
<p class="lede rise d1" style="margin-top:16px">Diese Seite gibt es nicht.</p>
<p class="rise d2" style="margin-top:26px"><a class="go" href="/">Alle Server <span class="arrow">→</span></a></p>
</div>${footer()}`,
    "",
    404,
  );
}
