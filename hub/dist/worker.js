// shared/src/marks.ts
var HERO_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70.95 64"><path fill="#1a1a1a" d="M66.38,0h-21.58l-1.46,20.75h-13.9L30.9,0h-11.43L0,36.57l4.57,27.43h21.58l1.65-22.22h13.9l-1.65,22.22h11.43l19.47-36.57L66.38,0Z"/></svg>',
  bg: "#FFC400",
  accent: "#FFC400"
};
var SEVDESK_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="7.8889 7.5556 16.2222 15.7778"><path fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd" d="M22.4444 7.55556C21.524 7.55556 20.7778 8.30175 20.7778 9.22222V21.6667C20.7778 22.5871 21.524 23.3333 22.4444 23.3333C23.3649 23.3333 24.1111 22.5871 24.1111 21.6667V9.22222C24.1111 8.30175 23.3649 7.55556 22.4444 7.55556ZM14.3333 13.8889C14.3333 12.9684 15.0795 12.2222 16 12.2222C16.9205 12.2222 17.6667 12.9684 17.6667 13.8889V21.6667C17.6667 22.5871 16.9205 23.3333 16 23.3333C15.0795 23.3333 14.3333 22.5871 14.3333 21.6667V13.8889ZM7.88889 17.8889C7.88889 16.9684 8.63508 16.2222 9.55556 16.2222C10.476 16.2222 11.2222 16.9684 11.2222 17.8889V21.6667C11.2222 22.5871 10.476 23.3333 9.55556 23.3333C8.63508 23.3333 7.88889 22.5871 7.88889 21.6667V17.8889Z"/></svg>',
  bg: "#FB523B",
  accent: "#FB523B",
  fill: 0.507
};
var FILL = 0.56;
function composeLogo(mark, size = 512) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(mark.inner)?.[1]?.trim().split(/\s+/).map(Number);
  const [minX, minY, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 1, 1];
  const box = size * (mark.fill ?? FILL);
  const scale = Math.min(box / vw, box / vh);
  const tx = (size - vw * scale) / 2 - minX * scale;
  const ty = (size - vh * scale) / 2 - minY * scale;
  const body = mark.inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const radius = Math.round(size * 0.219);
  const stroke = mark.border ? `<rect x=".5" y=".5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="none" stroke="#dcdce2" stroke-width="${Math.max(1, size / 170)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${mark.bg}"/>${stroke}<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(4)})">${body}</g></svg>`;
}

// hub/src/registry.ts
var TARIF_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="9 9 42 46"><rect x="9" y="9" width="32" height="40" rx="5" fill="#fff" opacity=".62"/><rect x="19" y="15" width="32" height="40" rx="5" fill="#fff"/><path fill="none" stroke="#0E7A55" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" d="M26 35.5l6 6 12-12.5"/></svg>',
  bg: "#0E7A55",
  accent: "#0E7A55",
  fill: 0.446
};
var MIKDATEN_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10" shape-rendering="crispEdges"><g fill="#ffffff"><rect x="2" y="0" width="2" height="1"/><rect x="8" y="0" width="2" height="1"/><rect x="1" y="1" width="4" height="1"/><rect x="7" y="1" width="4" height="1"/><rect x="0" y="2" width="12" height="1"/><rect x="0" y="3" width="12" height="1"/><rect x="2" y="5" width="2" height="1"/><rect x="8" y="5" width="2" height="1"/><rect x="2" y="6" width="2" height="1"/><rect x="8" y="6" width="2" height="1"/><rect x="5" y="8" width="2" height="1"/><rect x="5" y="9" width="2" height="1"/></g><g fill="#FF4A1C"><rect x="0" y="4" width="12" height="1"/><rect x="0" y="5" width="2" height="1"/><rect x="4" y="5" width="4" height="1"/><rect x="10" y="5" width="2" height="1"/><rect x="0" y="6" width="2" height="1"/><rect x="4" y="6" width="4" height="1"/><rect x="10" y="6" width="2" height="1"/><rect x="0" y="7" width="12" height="1"/><rect x="0" y="8" width="5" height="1"/><rect x="7" y="8" width="5" height="1"/><rect x="0" y="9" width="5" height="1"/><rect x="7" y="9" width="5" height="1"/></g></svg>',
  bg: "#0A0A0A",
  accent: "#FF4A1C",
  fill: 0.6
};
var TUERWERK_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52"><g fill="none" stroke="#fff"><path stroke-width="9" stroke-linecap="butt" d="M0 46h14M50 46h14"/><path stroke-width="9" stroke-linecap="round" d="M14 46V10"/><path stroke-width="5" stroke-linecap="round" opacity=".85" d="M14 10a36 36 0 0 1 36 36"/></g></svg>',
  bg: "#1B54D6",
  accent: "#1B54D6",
  fill: 0.72
};
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
    mark: HERO_MARK,
    thirdPartyBrand: true,
    accent: HERO_MARK.accent,
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
    id: "sevdesk",
    name: "sevdesk",
    tagline: "Buchhaltung",
    description: "Kontakte, Ausgangsrechnungen, Eingangsbelege, Angebote, Artikel, Bankums\xE4tze und Auswertungen aus sevdesk. Lesen und Anlegen \u2014 kein \xC4ndern, kein L\xF6schen, kein Buchen.",
    origin: "https://sevdesk-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://sevdesk-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: SEVDESK_MARK,
    thirdPartyBrand: true,
    accent: SEVDESK_MARK.accent,
    icon: "S",
    catalog: "tools.json",
    binding: "SEVDESK",
    notes: [
      "OAuth 2.1 mit PKCE \u2014 jeder Nutzer hinterlegt beim Verbinden seinen eigenen sevdesk-API-Token (32 Hexzeichen, aus Einstellungen \u2192 Benutzer).",
      "Der Token erbt die Rechte seines Benutzers. Wer nur lesen lassen will, legt in sevdesk einen eigenen Benutzer mit Leserechten an.",
      "Jeder Aufruf wird vor dem Absenden gegen die offizielle API-Beschreibung gepr\xFCft. sevdesk lehnt unbekannte Filter n\xE4mlich nicht ab, sondern ignoriert sie \u2014 die Antwort w\xE4re sonst ungefiltert und s\xE4he richtig aus.",
      "Seit dem sevdesk-Update 2.0 hei\xDFt die Steuerregel taxRule statt taxType. Der Server fragt die Version des Kontos ab und schickt die passende Angabe.",
      "PDFs bekommen einen zeitlich begrenzten Link von diesem Server \u2014 sevdesk liefert sie nur als base64 gegen den Token aus.",
      "Die eingefrorene API-Beschreibung stammt aus github.com/nikolausm/mcp-sevdesk (MIT)."
    ]
  },
  {
    id: "tarifcheck",
    name: "Tarifcheck",
    tagline: "Tarifvertr\xE4ge",
    description: "Die Tarifvertr\xE4ge der Gruppenwerk-Gewerke \u2014 Bau, Ger\xFCstbau, Maler, Tischler. T\xE4glich automatisch abgeglichen, jede Fassung archiviert. Nur lesend.",
    origin: "https://tarifcheck.ksqsebastian.workers.dev",
    mcpUrl: "https://tarifcheck.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: TARIF_MARK,
    accent: TARIF_MARK.accent,
    icon: "T",
    catalog: "tools.json",
    binding: "TARIFCHECK",
    notes: [
      "Eigene Anmeldung mit Benutzer und Passwort \u2014 dieselbe wie auf der Seite. Kein externer Anbieter dahinter.",
      "Ausschlie\xDFlich lesend. Hochladen und Quellen \xE4ndern geht nur \xFCber die Seite selbst.",
      "Jede Antwort f\xFChrt mit, von wann die Fassung ist und ob sie allgemeinverbindlich ist. Beim Maler-Rahmentarifvertrag kursieren \xE4ltere Fassungen \u2014 ohne diesen Vorbehalt w\xE4re eine Zahl daraus wertlos.",
      "F\xFCr das Tischlerhandwerk gibt es keine Allgemeinverbindlicherkl\xE4rung und damit keine \xF6ffentliche Volltextquelle. \xDCberwacht wird dort nur die Downloadseite; der Vertragstext wird von Hand hochgeladen."
    ]
  },
  {
    id: "mikdaten",
    name: "Mikdaten",
    tagline: "Immobilienverwaltung",
    description: "Kanban-Board, Objektakten, Kontakte, Termine und Dokumente der Immobilienverwaltung. Lesen, Neues anlegen und Aufgaben durchs Board bewegen.",
    origin: "https://mikdaten.ksqsebastian.workers.dev",
    mcpUrl: "https://mikdaten.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: MIKDATEN_MARK,
    accent: MIKDATEN_MARK.accent,
    icon: "M",
    catalog: "tools.json",
    binding: "MIKDATEN",
    notes: [
      "Eigene Anmeldung mit Benutzername und Passwort \u2014 dieselbe wie auf der Seite. Kein externer Anbieter dahinter.",
      "Der Server l\xE4uft im Worker der Anwendung selbst, nicht als eigener Dienst. Er sieht dieselben Daten, ohne Kopie und ohne Zwischenschicht.",
      "Jede Anfrage l\xE4uft mit den Rechten der angemeldeten Person; Kommentare erscheinen unter deren Namen.",
      "Anlegen und Fortschreiben ist erlaubt: Aufgaben verschieben, erledigen, kommentieren, Checklisten abhaken, Objektdaten fortschreiben. Gel\xF6scht wird nichts.",
      "Personen und Objekte d\xFCrfen als Name, Benutzername oder Objektnummer angegeben werden, nicht nur als ID.",
      "Verbundene Anwendungen stehen in Mikdaten unter Einstellungen \u2192 KI-Anbindung und lassen sich dort einzeln trennen."
    ]
  },
  {
    id: "tuerwerk",
    name: "T\xFCrwerk",
    tagline: "T\xFCrenwartung",
    description: "Die T\xFCrenwartung von Seehafer Elemente \u2014 vor Ort diktiert, hier gesammelt, am Ende fertige Wartungsprotokolle als PDF. Drehfl\xFCgelt\xFCren, Fenster, Feststellanlagen.",
    origin: "https://tuerwerk.ksqsebastian.workers.dev",
    mcpUrl: "https://tuerwerk.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: TUERWERK_MARK,
    accent: TUERWERK_MARK.accent,
    icon: "T",
    catalog: "tools.json",
    binding: "TUERWERK",
    notes: [
      "Eigene Anmeldung mit Benutzer und Passwort \u2014 dieselbe wie auf der Seite. Kein externer Anbieter dahinter.",
      "Gedacht f\xFCrs Diktat am Handy: der Monteur spricht, jede T\xFCr wird sofort geschrieben. Bricht das Gespr\xE4ch ab, ist nichts verloren \u2014 weiter geht es mit derselben Kennung.",
      "Standard ist \u201Ealles in Ordnung\u201C; genannt werden nur die Abweichungen, als Punkt-Nummer aus der jeweiligen Vorlage. Was eine Nummer bedeutet, liefert 'pruefpunkte'.",
      "Die Protokolle entstehen im Worker selbst: die Original-Formulare werden mit den erfassten Werten \xFCberdruckt und in R2 abgelegt, einzeln oder als ZIP abrufbar.",
      "Die Unterschrift kommt aus dem Konto dessen, der die Wartung angelegt hat. Fehlt sie, bleibt das Feld leer \u2014 der Bericht entsteht trotzdem.",
      "Gel\xF6scht wird \xFCber den Server nichts."
    ]
  }
];
var byId = new Map(REGISTRY.map((s) => [s.id, s]));

// hub/src/catalog.ts
var CACHE_SECONDS = 300;
async function fetchCatalog(entry, env = {}) {
  if (entry.catalog === "none") return { ok: false, tools: [], retired: true };
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

// shared/src/style.ts
function inkOn(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#16161a" : "#ffffff";
}
var BASE_CSS = `
:root {
  --ink: #131316;
  --ink-2: #6e6e78;
  --ink-3: #9b9ba4;
  --bg: #ffffff;
  --surface: #ffffff;
  --line: #e7e7ea;
  --line-strong: #d2d2d8;
  --wash: #f7f7f8;
  --focus: #131316;
  --radius: 18px;
  --ease: cubic-bezier(.22,.61,.25,1);
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #f4f4f6;
    --ink-2: #a0a0aa;
    --ink-3: #70707a;
    --bg: #0b0b0d;
    --surface: #131316;
    --line: #26262c;
    --line-strong: #3a3a42;
    --wash: #17171b;
    --focus: #f4f4f6;
  }
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 400 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

a { color: inherit; text-decoration: none; }
h1, h2, h3 { margin: 0; font-weight: 640; letter-spacing: -.028em; line-height: 1.12; }
p { margin: 0; }

/* \u2500\u2500 Typografische Stufen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.display { font-size: clamp(2.3rem, 6.2vw, 3.65rem); letter-spacing: -.042em; line-height: 1.03; font-weight: 660; }
.lede { font-size: clamp(1.05rem, 1.9vw, 1.28rem); color: var(--ink-2); line-height: 1.5; max-width: 34ch; }
.eyebrow {
  font-size: .74rem; font-weight: 620; letter-spacing: .13em; text-transform: uppercase;
  color: var(--ink-3);
}
.meta { font-size: .9rem; color: var(--ink-2); }
.mono, code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; }

/* \u2500\u2500 Raster \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 28px; }
.narrow { max-width: 720px; }

/* \u2500\u2500 Bewegung: nur beim Eintreten und bei Interaktion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.rise { animation: rise .62s var(--ease) both; }
.d1 { animation-delay: .04s } .d2 { animation-delay: .09s } .d3 { animation-delay: .14s }
.d4 { animation-delay: .19s } .d5 { animation-delay: .24s } .d6 { animation-delay: .29s }

/* \u2500\u2500 Kachel mit dem Systemk\xFCrzel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.tile {
  width: 44px; height: 44px; border-radius: 13px; flex: 0 0 auto;
  display: grid; place-items: center;
  font-weight: 700; font-size: 19px; letter-spacing: -.03em;
}

/* \u2500\u2500 Karten \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 26px;
  transition: transform .28s var(--ease), box-shadow .28s var(--ease), border-color .28s var(--ease);
}
a.card:hover, .card.hoverable:hover {
  transform: translateY(-3px);
  border-color: var(--line-strong);
  box-shadow: 0 14px 34px -14px rgba(0,0,0,.18);
}

/* \u2500\u2500 Links mit Pfeil \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.go { display: inline-flex; align-items: center; gap: .42em; font-weight: 560; font-size: .96rem; }
.go .arrow { transition: transform .28s var(--ease); }
.go:hover .arrow { transform: translateX(4px); }

/* \u2500\u2500 URL-Feld mit Kopierknopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.urlbar {
  display: flex; align-items: stretch; gap: 8px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--wash);
  padding: 5px 5px 5px 14px; transition: border-color .28s var(--ease);
}
.urlbar:focus-within { border-color: var(--line-strong); }
.urlbar input {
  flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink);
  font: 500 13.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 7px 0; outline: none;
}
.copy {
  border: 0; border-radius: 9px; padding: 7px 14px; cursor: pointer;
  background: var(--ink); color: var(--bg);
  font: 620 13px/1.4 inherit; letter-spacing: -.01em;
  transition: opacity .2s var(--ease), transform .2s var(--ease);
}
.copy:hover { opacity: .84; }
.copy:active { transform: scale(.96); }
.copy.done { background: #12833f; color: #fff; }

/* \u2500\u2500 Eingabefelder \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.field {
  width: 100%; padding: 13px 15px; font: 400 16px/1.5 inherit;
  border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface); color: var(--ink);
  transition: border-color .2s var(--ease), box-shadow .2s var(--ease);
}
.field::placeholder { color: var(--ink-3); }
.field:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 14%, transparent); }

/* \u2500\u2500 Knopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.btn {
  display: block; width: 100%; padding: 14px 18px; border: 0; border-radius: 12px;
  background: var(--ink); color: var(--bg); cursor: pointer;
  font: 620 15.5px/1.4 inherit; letter-spacing: -.011em;
  transition: opacity .2s var(--ease), transform .2s var(--ease);
}
.btn:hover { opacity: .86; }
.btn:active { transform: scale(.988); }

/* \u2500\u2500 Hinweise und Fehler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.note { background: var(--wash); border-radius: 14px; padding: 18px 20px; font-size: .94rem; color: var(--ink-2); }
.note strong, .note b { color: var(--ink); font-weight: 600; }
.err {
  border-left: 2px solid #c8382f; background: color-mix(in srgb, #c8382f 7%, transparent);
  border-radius: 0 10px 10px 0; padding: 12px 16px; font-size: .93rem; color: var(--ink);
}

/* \u2500\u2500 Trennlinien \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rule { height: 1px; background: var(--line); border: 0; margin: 0; }

:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
var COPY_JS = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
    var old = b.textContent;
    b.textContent = 'Kopiert';
    b.classList.add('done');
    setTimeout(function () { b.textContent = old; b.classList.remove('done'); }, 1500);
  });
});`;

// hub/src/ui.ts
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var HUB_CSS = `
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

/* \u2500\u2500 Kopfbereich \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.hero { padding: 86px 0 68px; }
.hero .lede { margin-top: 20px; }

/* \u2500\u2500 Erkl\xE4rung \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 Serverliste \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 Detailseite \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
var FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#131316"/><rect x="18" y="18" width="10" height="10" rx="3" fill="#fff"/><rect x="36" y="18" width="10" height="10" rx="3" fill="#fff" opacity=".55"/><rect x="18" y="36" width="10" height="10" rx="3" fill="#fff" opacity=".55"/><rect x="36" y="36" width="10" height="10" rx="3" fill="#fff"/></svg>';
var HEADER_JS = `
(function () {
  var h = document.querySelector('header');
  if (!h) return;
  var onScroll = function () { h.classList.toggle('stuck', window.scrollY > 6); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();`;
var FILTER_JS = `
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
      // Der Z\xE4hler muss mitlaufen, sonst behauptet die \xDCberschrift eine Zahl,
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
function shell(title, description, body, extraJs = "", status = 200) {
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
      "cache-control": status === 200 ? "public, max-age=120" : "no-store"
    }
  });
}
var header = (right = "") => `<header><div class="wrap inner">
<a class="wordmark" href="/"><span class="mark"></span>MCP-Server</a>
<div class="right">${right}</div></div></header>`;
function footer() {
  const fremd = REGISTRY.filter((e) => e.thirdPartyBrand).map((e) => e.name);
  const namen = fremd.length > 1 ? `${fremd.slice(0, -1).join(", ")} und ${fremd[fremd.length - 1]}` : fremd[0];
  const hinweis = fremd.length ? `<br>${esc(namen)} ${fremd.length > 1 ? "sind Marken" : "ist eine Marke"} der
jeweiligen Anbieter. Die Logos stehen hier zur Kennzeichnung des angebundenen Systems;
es sind keine offiziellen Integrationen.` : "";
  return `<footer><div class="wrap">
Die Tool-Listen werden live von den Servern geholt, nicht hier gepflegt \u2014 was hier steht,
ist das, was der Server wirklich kann. <a href="/registry.json">registry.json</a>${hinweis}
</div></footer>`;
}
function urlbar(url, short = false) {
  const shown = short ? url.replace(/^https?:\/\//, "") : url;
  return `<div class="urlbar"><input readonly value="${esc(shown)}"
onfocus="this.value='${esc(url)}';this.select()" onblur="this.value='${esc(shown)}'"
aria-label="Server-URL"><button class="copy" data-copy="${esc(url)}">Kopieren</button></div>`;
}
function tile(entry, size = 44) {
  if (entry.mark) {
    const svg = `data:image/svg+xml;base64,${btoa(composeLogo(entry.mark, 128))}`;
    return `<img class="tile" src="${svg}" alt="" width="${size}" height="${size}"
style="width:${size}px;height:${size}px">`;
  }
  return `<span class="tile" style="background:${esc(entry.accent)};color:${inkOn(entry.accent)};
width:${size}px;height:${size}px;font-size:${Math.round(size * 0.43)}px">${esc(entry.icon)}</span>`;
}
function overviewPage(rows) {
  const total = rows.reduce((n, r) => n + r.catalog.tools.length, 0);
  const cards = rows.map(({ entry, catalog }, i) => {
    const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint).length;
    const write = catalog.tools.length - read;
    const kinds = !write ? "nur lesend" : !read ? "nur schreibend" : `${read} lesend, ${write} schreibend`;
    const facts = catalog.ok ? `<span class="live">Aktiv</span><span class="sep">\xB7</span>
           <span>${catalog.tools.length} Tools</span><span class="sep">\xB7</span>
           <span>${kinds}</span><span class="sep">\xB7</span><span>OAuth</span>` : catalog.retired ? `<span class="down">Abgeschaltet</span>` : `<span class="down">Nicht erreichbar</span>`;
    return `<div class="card srv hoverable rise d${Math.min(6, i + 3)}">
<div class="top">${tile(entry)}
<div><h3><a href="/s/${esc(entry.id)}">${esc(entry.name)}</a></h3>
<div class="tag">${esc(entry.tagline)}</div></div></div>
<p class="desc">${esc(entry.description)}</p>
<div class="facts">${facts}</div>
${urlbar(entry.mcpUrl, true)}
<a class="go" href="/s/${esc(entry.id)}">Tools ansehen <span class="arrow">\u2192</span></a></div>`;
  }).join("");
  return shell(
    "MCP-Server",
    "Eigene MCP-Server f\xFCr Claude: Endpunkte, Anmeldung und alle Tools im \xDCberblick.",
    `${header(`${rows.length} Server \xB7 ${total} Tools`)}
<section class="hero"><div class="wrap">
<h1 class="display rise">Eure Systeme,<br>direkt im Chat.</h1>
<p class="lede rise d1">Eigene MCP-Server, die Claude mit der Software verbinden,
mit der ihr ohnehin arbeitet. Ohne Export, ohne Copy-Paste.</p>
</div></section>

<section class="explain"><div class="wrap">
<div class="eyebrow rise d2">Kurz erkl\xE4rt</div>
<h2 class="rise d2">Was ist ein MCP?</h2>
<div class="rise d3">
<p><b>MCP steht f\xFCr Model Context Protocol</b> \u2014 eine gemeinsame Sprache, mit der ein
KI-Assistent wie Claude mit einer Software reden kann. Ungef\xE4hr das, was USB-C f\xFCr Stecker
ist: eine Form, auf die sich alle einigen, damit nicht jedes Ger\xE4t sein eigenes Kabel braucht.</p>
<p>Ohne MCP wei\xDF Claude nur, was im Gespr\xE4ch steht. Mit MCP kann er in eure Systeme schauen
und dort arbeiten \u2014 nachsehen, wer noch nicht bezahlt hat, ein Angebot schreiben, einen Termin
eintragen. <b>Ein Server verbindet Claude mit genau einem System.</b></p>
<p>Was er darf, steht in seiner Tool-Liste, und mehr geht nicht. Die Server hier k\xF6nnen lesen
und anlegen \u2014 <b>\xE4ndern und l\xF6schen k\xF6nnen sie nicht</b>. Und sie sehen nur das, wof\xFCr ihr
euch beim Verbinden anmeldet.</p>
</div>
<div class="steps rise d4">
<div class="step"><div class="n">1</div><h3>URL eintragen</h3>
<p>In Claude unter Einstellungen \u2192 Connectors die Server-URL einf\xFCgen.</p></div>
<div class="step"><div class="n">2</div><h3>Einmal anmelden</h3>
<p>Es \xF6ffnet sich eine Anmeldeseite. Dort hinterlegt ihr euren Zugang zum jeweiligen System.</p></div>
<div class="step"><div class="n">3</div><h3>Fragen stellen</h3>
<p>\u201EWer schuldet uns noch was?" \u2014 Claude nutzt die passenden Tools von selbst.</p></div>
</div>
</div></section>

<section class="servers"><div class="wrap">
<div class="section-head rise d4"><h2>Server</h2><span class="meta">${rows.length} verf\xFCgbar</span></div>
<div class="grid">${cards}</div>
</div></section>
${footer()}`
  );
}
function argLine(tool) {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const names = Object.keys(props);
  if (!names.length) return `<div class="a">ohne Argumente</div>`;
  return `<div class="a">` + names.map((n) => {
    const type = props[n]?.type ?? "any";
    return `<b>${esc(n)}</b>${required.has(n) ? `<span class="req">*</span>` : ""}:&nbsp;${esc(type)}`;
  }).join(" &nbsp;\xB7&nbsp; ") + `</div>`;
}
function toolBlock(tool) {
  const hay = `${tool.name} ${tool.title ?? ""} ${tool.description}`.toLowerCase();
  return `<div class="tool" data-tool="${esc(hay)}">
<div class="row"><span class="n">${esc(tool.name)}</span>
${tool.title ? `<span class="t">${esc(tool.title)}</span>` : ""}</div>
<p class="d">${esc(tool.description)}</p>${argLine(tool)}</div>`;
}
function group(title, hint, tools) {
  if (!tools.length) return "";
  return `<section class="group"><div class="head"><h2>${esc(title)}</h2>
<span class="count" data-total="${tools.length}">${tools.length} Tools</span></div>
<p class="hint">${esc(hint)}</p>
${tools.map(toolBlock).join("")}</section>`;
}
function serverPage(entry, catalog) {
  const read = catalog.tools.filter((t) => t.annotations?.readOnlyHint);
  const write = catalog.tools.filter((t) => !t.annotations?.readOnlyHint);
  const tools = catalog.ok ? `<div class="toolbar rise d4"><span class="glass"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.6 10.6 L14 14" stroke-linecap="round"/></svg></span>
<input id="q" class="search" placeholder="Tools durchsuchen" autocomplete="off">
</div>
<div id="none" class="empty" hidden>Kein Tool passt zu dieser Suche.</div>
${group("Lesend", "Fragen ab. K\xF6nnen nichts ver\xE4ndern.", read)}
${group("Schreibend", "Legen Neues an. \xC4ndern und l\xF6schen nichts Bestehendes.", write)}` : catalog.retired ? `<div class="note" style="margin-top:34px">Dieser Server ist abgeschaltet. Sein Endpoint
antwortet auf jeden Aufruf mit <b>HTTP 410</b> und nennt den Nachfolger.</div>` : `<div class="note" style="margin-top:34px">Der Server antwortet gerade nicht
(${esc(catalog.error)}). Die Tool-Liste wird live geholt und fehlt deshalb, w\xE4hrend der Server
neu startet.</div>`;
  const facts = [
    catalog.ok ? `${catalog.tools.length} Tools` : null,
    entry.auth === "oauth" ? "OAuth 2.1 mit PKCE" : "ohne Authentifizierung",
    catalog.serverVersion ? `v${catalog.serverVersion}` : null
  ].filter(Boolean).join(' <span style="opacity:.45">\xB7</span> ');
  return shell(
    `${entry.name} \u2014 MCP-Server`,
    entry.description,
    `${header()}
<div class="wrap">
<a class="back" href="/"><span class="arrow">\u2190</span> Alle Server</a>
<div class="detail-head rise">${tile(entry, 52)}
<div><h1>${esc(entry.name)}</h1><div class="tag">${esc(entry.tagline)}</div></div></div>
<p class="lede rise d1 detail-body" style="max-width:60ch;font-size:1.08rem">${esc(entry.description)}</p>
<p class="meta rise d1" style="margin:16px 0 26px">${facts}</p>
<div class="rise d2 detail-body">${urlbar(entry.mcpUrl)}</div>
${entry.notes?.length ? `<ul class="notes rise d3 detail-body">${entry.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
${tools}
</div>
${footer()}`,
    FILTER_JS
  );
}
function notFound() {
  return shell(
    "Nicht gefunden",
    "Diese Seite gibt es nicht.",
    `${header()}<div class="wrap" style="padding:110px 0 140px">
<h1 class="display rise" style="font-size:2.4rem">Nicht gefunden</h1>
<p class="lede rise d1" style="margin-top:16px">Diese Seite gibt es nicht.</p>
<p class="rise d2" style="margin-top:26px"><a class="go" href="/">Alle Server <span class="arrow">\u2192</span></a></p>
</div>${footer()}`,
    "",
    404
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
