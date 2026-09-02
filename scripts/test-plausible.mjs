#!/usr/bin/env node
/**
 * Prüft den Plausible-Worker gegen eine Plausible-Attrappe.
 *
 * Ohne echten Zugang lässt sich sonst kein einziges Tool ausführen. Geprüft wird das, was
 * falsch sein KANN, ohne dass es auffällt:
 *
 *  - Ein absoluter Zeitraum als Zeichenkette statt als Array — Plausible antwortet mit
 *    einem 400er, dessen Text die Ursache nicht benennt.
 *  - Eine Kennzahl oder Dimension, die es nicht gibt — soll hier auffliegen, nicht dort.
 *  - conversion_rate ohne Ziel-Bezug — Plausible lehnt ab, ohne zu sagen, was fehlt.
 *  - Ein ausgeschlossenes Ziel (event:goal + is_not) — bei Plausible nicht erlaubt.
 *  - visit:country statt visit:country_name — liefert ISO-Codes und sieht richtig aus.
 *  - Die Kurzform 'page' zusammen mit einem Filter auf event:page — ergibt eine leere
 *    Antwort, die aussieht wie „kein Verkehr".
 *  - Parallel-Arrays, die roh durchgereicht werden — die Bedeutung einer Zahl stünde
 *    dann nur in der Reihenfolge der Anfrage.
 *  - Eine Domain mit Schema oder Pfad beim Verbinden — der häufigste Tippfehler.
 *
 * Außerdem wird geprüft, dass JEDES Tool mindestens einmal wirklich läuft.
 *
 *   node scripts/test-plausible.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/plausible/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const KEY = "plausible-test-key-0123456789";
const SITE = "example.com";

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) return this.store.delete(key), null;
    return type === "json" ? JSON.parse(e.value) : e.value;
  }
  async put(key, value, opts = {}) {
    this.store.set(key, {
      value,
      expires: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null,
    });
  }
  async delete(key) {
    this.store.delete(key);
  }
}

/* ── Attrappe ─────────────────────────────────────────────────────────────── */

/**
 * Antwortet in der Form, die Plausible liefert: Parallel-Arrays, deren Bedeutung nur aus
 * der Anfrage hervorgeht. Genau deshalb steht sie hier so und nicht schon benannt — der
 * Worker soll das Zusammenführen leisten, nicht die Attrappe.
 */
const realFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  if (!raw.includes("plausible.io")) return realFetch(input, init);

  const body = JSON.parse(init.body ?? "{}");
  const auth = init.headers?.authorization ?? "";
  calls.push({ body, auth });

  const res = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  if (auth !== `Bearer ${KEY}`) return res({ error: "invalid API key" }, 401);
  if (body.site_id !== SITE) return res({ error: "site does not exist or user is not a member" }, 404);

  /* Plausible nimmt einen absoluten Zeitraum NUR als Array. Die Attrappe ist hier so
     streng wie das Original — sonst würde der Test die eigentliche Falle nicht sehen. */
  const r = body.date_range;
  const okRange =
    (typeof r === "string" && /^(\d+h|\d+d|\d+mo|day|month|year|all)$/.test(r)) ||
    (Array.isArray(r) && r.length === 2 && r.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (!okRange) return res({ error: `#/date_range: invalid date range ${JSON.stringify(r)}` }, 400);

  const dims = body.dimensions ?? [];
  const metrics = body.metrics ?? [];

  if (metrics.includes("conversion_rate") || metrics.includes("group_conversion_rate")) {
    const hasGoal =
      dims.includes("event:goal") || (body.filters ?? []).some(([, t]) => t === "event:goal");
    if (!hasGoal) return res({ error: "metric `conversion_rate` can only be queried with goals" }, 400);
  }
  for (const [op, target] of body.filters ?? []) {
    if (target === "event:goal" && op !== "is" && op !== "contains") {
      return res({ error: "Invalid filter on `event:goal`" }, 400);
    }
  }

  /** Erfundene, aber in sich stimmige Werte — je Dimension ein paar Zeilen. */
  const value = (m, seed) =>
    ({
      visitors: 100 + seed * 10,
      visits: 120 + seed * 10,
      pageviews: 300 + seed * 25,
      bounce_rate: 40 + seed,
      visit_duration: 60 + seed * 5,
      events: 12 + seed,
      conversion_rate: 3.5 + seed,
    })[m] ?? seed;

  const labels = {
    "time:day": ["2026-02-01", "2026-02-02", "2026-02-03"],
    "time:week": ["2026-01-26", "2026-02-02"],
    "time:month": ["2026-01-01", "2026-02-01"],
    "time:hour": ["2026-02-01 09:00:00", "2026-02-01 10:00:00"],
    "event:page": ["/", "/preise", "/blog/eins"],
    "event:goal": ["Signup", "Purchase"],
    "visit:source": ["Google", "Direct / None"],
    "visit:country_name": ["Germany", "Austria"],
    "visit:country": ["DE", "AT"],
    "event:props:plan": ["pro", "free"],
  };

  if (!dims.length) {
    return res({ results: [{ dimensions: [], metrics: metrics.map((m) => value(m, 0)) }] });
  }
  const rows = (labels[dims[0]] ?? ["a", "b"]).map((label, i) => ({
    dimensions: dims.map((d, j) => (j === 0 ? label : (labels[d] ?? ["x"])[0])),
    metrics: metrics.map((m) => value(m, i)),
  }));
  return res({ results: rows.slice(0, body.pagination?.limit ?? rows.length) });
};

/* ── Aufbau ───────────────────────────────────────────────────────────────── */
const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://pl.test" + path, init), env);

const checks = [];
const check = (name, cond, detail = "") => {
  checks.push({ name, ok: Boolean(cond) });
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
};
const safeParse = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

async function login(apiKey, site) {
  const reg = await (
    await call("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Test",
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: "none",
      }),
    })
  ).json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const form = {
    client_id: reg.client_id,
    redirect_uri: REDIRECT,
    response_type: "code",
    state: "s",
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  const ok = await call("/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, apiKey, site }).toString(),
  });
  const location = ok.headers.get("location");
  if (!location) return { error: await ok.text() };
  const code = new URL(location).searchParams.get("code");
  const tok = await (
    await call("/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: reg.client_id,
        code_verifier: verifier,
      }).toString(),
    })
  ).json();
  return { access_token: tok.access_token };
}

/* ── Anmeldung ────────────────────────────────────────────────────────────── */
const noSite = await login(KEY, "");
check(
  "Ohne Domain wird gar nicht erst angefragt",
  String(noSite.error).includes("Domain"),
  String(noSite.error).slice(0, 160),
);

const withPath = await login(KEY, "example.com/blog");
check(
  "Eine Domain mit Pfad wird erklärt, nicht durchgereicht",
  String(withPath.error).includes("Pfad"),
  String(withPath.error).slice(0, 160),
);

const badKey = await login("plausible-falsch", SITE);
check("Ein falscher API-Key wird abgewiesen", !badKey.access_token && Boolean(badKey.error));
check(
  "Und die Meldung sagt, wo der Key herkommt",
  String(badKey.error).includes("API Keys"),
  String(badKey.error).slice(0, 200),
);

const unknownSite = await login(KEY, "fremde-seite.de");
check(
  "Eine Seite, die es im Konto nicht gibt, fällt beim Verbinden auf",
  !unknownSite.access_token && String(unknownSite.error).includes("Domain genau"),
  String(unknownSite.error).slice(0, 200),
);

const scheme = await login(KEY, "https://example.com/");
check(
  "https:// und Schrägstrich am Ende werden abgeschnitten statt abgelehnt",
  Boolean(scheme.access_token),
  String(scheme.error).slice(0, 200),
);

const session = await login(KEY, SITE);
check("Code-Tausch liefert ein Token", Boolean(session.access_token));

const dump = [...env.OAUTH_KV.store.values()].map((e) => e.value).join("|");
check("Der Plausible-Key steht nicht im Klartext in KV", !dump.includes(KEY));

/* ── Tools ────────────────────────────────────────────────────────────────── */
let id = 0;
const used = new Set();
async function tool(name, args = {}, token = session.access_token) {
  used.add(name);
  const res = await (
    await call("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
  ).json();
  const text = res.result?.content?.[0]?.text ?? "";
  return { isError: res.result?.isError, text, data: safeParse(text) };
}
const lastCall = () => calls[calls.length - 1];
const before = () => calls.length;

const list = await (
  await call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
  })
).json();
const names = (list.result?.tools ?? []).map((t) => t.name);
check("tools/list liefert 5 Tools", names.length === 5, String(names.length));
check(
  "Alle Tools sind als nur lesend gekennzeichnet",
  (list.result?.tools ?? []).every((t) => t.annotations?.readOnlyHint === true),
);

/* ── Zeitraum: die Hauptfalle ─────────────────────────────────────────────── */
const shortcut = await tool("overview", { date_range: "7d" });
check("Ein Kürzel bleibt eine Zeichenkette", lastCall().body.date_range === "7d");
check("…und die Abfrage geht durch", !shortcut.isError, shortcut.text.slice(0, 200));

await tool("overview", { date_range: "2026-01-01,2026-01-31" });
check(
  "Ein absoluter Zeitraum wird zum Array — nicht als Zeichenkette geschickt",
  Array.isArray(lastCall().body.date_range) &&
    lastCall().body.date_range[0] === "2026-01-01" &&
    lastCall().body.date_range[1] === "2026-01-31",
  JSON.stringify(lastCall().body.date_range),
);

let n = before();
const badRange = await tool("overview", { date_range: "letzte Woche" });
check(
  "Ein unbekannter Zeitraum wird vor dem Netzaufruf abgefangen",
  badRange.isError && calls.length === n && badRange.text.includes("YYYY-MM-DD"),
  badRange.text.slice(0, 200),
);

n = before();
const badDay = await tool("overview", { date_range: "2026-13-01,2026-13-31" });
check(
  "Ein Datum, das es nicht gibt, ebenfalls — Plausible würde nur leer antworten",
  badDay.isError && calls.length === n,
  badDay.text.slice(0, 200),
);

/* ── Kennzahlen und Dimensionen ───────────────────────────────────────────── */
n = before();
const badMetric = await tool("overview", { date_range: "7d", metrics: ["besucher"] });
check(
  "Eine Kennzahl, die es nicht gibt, wird vor dem Netzaufruf gemeldet",
  badMetric.isError && calls.length === n && badMetric.text.includes("visitors"),
  badMetric.text.slice(0, 200),
);

n = before();
const badDim = await tool("breakdown", { date_range: "7d", dimension: "visit:chanel" });
check(
  "Eine falsch geschriebene Dimension ebenso",
  badDim.isError && calls.length === n,
  badDim.text.slice(0, 200),
);

n = before();
const rateNoGoal = await tool("overview", { date_range: "7d", metrics: ["conversion_rate"] });
check(
  "conversion_rate ohne Ziel-Bezug wird erklärt, statt als 400 zurückzukommen",
  rateNoGoal.isError && calls.length === n && rateNoGoal.text.includes("Ziel"),
  rateNoGoal.text.slice(0, 200),
);

/* ── Antwortform ──────────────────────────────────────────────────────────── */
const over = await tool("overview", { date_range: "30d" });
check(
  "Der Überblick kommt mit Feldnamen zurück, nicht als Parallel-Array",
  over.data?.werte?.visitors === 100 && over.data?.werte?.bounce_rate === 40,
  over.text.slice(0, 220),
);
check(
  "…und nennt Seite und Zeitraum",
  over.data?.site === SITE && over.data?.zeitraum === "30d",
  over.text.slice(0, 220),
);

const ts = await tool("timeseries", { date_range: "7d", granularity: "week" });
check(
  "Der Verlauf schlüsselt nach der gewählten Zeitdimension auf",
  lastCall().body.dimensions?.[0] === "time:week" && ts.data?.verlauf?.length === 2,
  ts.text.slice(0, 220),
);
check(
  "…und jede Zeile trägt ihr Datum als Feld",
  ts.data?.verlauf?.[0]?.["time:week"] === "2026-01-26",
  JSON.stringify(ts.data?.verlauf?.[0]),
);

n = before();
const badGran = await tool("timeseries", { date_range: "7d", granularity: "quartal" });
check(
  "Eine Zeitschrittweite, die es nicht gibt, wird abgefangen",
  badGran.isError && calls.length === n,
  badGran.text.slice(0, 200),
);

/* ── Aufschlüsselung ──────────────────────────────────────────────────────── */
const pages = await tool("breakdown", { date_range: "7d", dimension: "event:page", limit: 2 });
check(
  "Die Aufschlüsselung hält sich an das Limit",
  lastCall().body.pagination?.limit === 2 && pages.data?.werte?.length === 2,
  pages.text.slice(0, 220),
);
check(
  "…und sagt dazu, dass abgeschnitten wurde",
  String(pages.data?.hinweis ?? "").includes("2"),
  pages.text.slice(0, 220),
);

const geo = await tool("breakdown", { date_range: "7d", dimension: "visit:country" });
check(
  "visit:country wird auf die Klarnamen-Fassung gedreht",
  lastCall().body.dimensions?.[0] === "visit:country_name",
  JSON.stringify(lastCall().body.dimensions),
);
check(
  "…und die Antwort sagt, dass getauscht wurde",
  geo.data?.statt === "visit:country" && geo.data?.werte?.[0]?.["visit:country_name"] === "Germany",
  geo.text.slice(0, 240),
);

const props = await tool("breakdown", { date_range: "7d", dimension: "event:props:plan" });
check(
  "Eine eigene Ereignis-Eigenschaft geht als Dimension durch",
  !props.isError && props.data?.werte?.[0]?.["event:props:plan"] === "pro",
  props.text.slice(0, 220),
);

/* ── Filter ───────────────────────────────────────────────────────────────── */
await tool("breakdown", { date_range: "7d", dimension: "visit:source", page: "/blog*" });
check(
  "Ein '*' am Ende wird zur Präfixsuche, nicht zum Sternchen im Wert",
  JSON.stringify(lastCall().body.filters) === JSON.stringify([["contains", "event:page", ["/blog"]]]),
  JSON.stringify(lastCall().body.filters),
);

await tool("breakdown", { date_range: "7d", dimension: "visit:source", page: "/preise" });
check(
  "Ohne '*' bleibt es die genaue Seite",
  JSON.stringify(lastCall().body.filters) === JSON.stringify([["is", "event:page", ["/preise"]]]),
  JSON.stringify(lastCall().body.filters),
);

await tool("breakdown", {
  date_range: "7d",
  dimension: "visit:source",
  filters: [{ property: "plan", values: ["pro"] }],
});
check(
  "Ein bloßer Eigenschaftsname wird zu event:props:<name>",
  JSON.stringify(lastCall().body.filters) ===
    JSON.stringify([["is", "event:props:plan", ["pro"]]]),
  JSON.stringify(lastCall().body.filters),
);

n = before();
const clash = await tool("breakdown", {
  date_range: "7d",
  dimension: "visit:source",
  page: "/preise",
  filters: [{ property: "event:page", values: ["/andere"] }],
});
check(
  "'page' und ein Filter auf event:page zugleich werden abgewiesen statt leer beantwortet",
  clash.isError && calls.length === n,
  clash.text.slice(0, 220),
);

n = before();
const negatedGoal = await tool("overview", {
  date_range: "7d",
  filters: [{ property: "event:goal", operator: "is_not", values: ["Signup"] }],
});
check(
  "Ein ausgeschlossenes Ziel wird erklärt, bevor Plausible es mit 400 quittiert",
  negatedGoal.isError && calls.length === n && negatedGoal.text.includes("event:goal"),
  negatedGoal.text.slice(0, 220),
);

/* ── Ziele ────────────────────────────────────────────────────────────────── */
const conv = await tool("conversions", { date_range: "30d" });
check(
  "Ziele bringen immer die Ziel-Dimension mit — damit gilt conversion_rate",
  !conv.isError && lastCall().body.dimensions?.includes("event:goal"),
  conv.text.slice(0, 220),
);
check(
  "…und die Rate steht benannt in der Zeile",
  conv.data?.werte?.[0]?.conversion_rate === 3.5 && conv.data?.werte?.[0]?.["event:goal"] === "Signup",
  JSON.stringify(conv.data?.werte?.[0]),
);

const convPage = await tool("conversions", { date_range: "30d", per_page: true });
check(
  "Je Seite kommt die Seiten-Dimension dazu",
  JSON.stringify(lastCall().body.dimensions) === JSON.stringify(["event:goal", "event:page"]),
  JSON.stringify(lastCall().body.dimensions),
);
check("…und die Zeilen tragen beide Felder", Boolean(convPage.data?.werte?.[0]?.["event:page"]));

/* ── Vergleich ────────────────────────────────────────────────────────────── */
const cmp = await tool("compare", {
  range_a: "2026-01-01,2026-01-31",
  range_b: "2026-02-01,2026-02-28",
  metrics: ["visitors"],
});
check(
  "Der Vergleich stellt zwei Abfragen und rechnet die Differenz",
  !cmp.isError && cmp.data?.veraenderung?.visitors?.absolut === 0,
  cmp.text.slice(0, 240),
);
check(
  "…und beide Zeiträume stehen als Array in der Anfrage",
  calls.slice(-2).every((c) => Array.isArray(c.body.date_range)),
  JSON.stringify(calls.slice(-2).map((c) => c.body.date_range)),
);
check(
  "…und beide Seiten sind benannt, nicht durchnummeriert",
  cmp.data?.a?.zeitraum === "2026-01-01,2026-01-31" && cmp.data?.b?.werte?.visitors === 100,
  cmp.text.slice(0, 240),
);

/* ── Vollständigkeit ──────────────────────────────────────────────────────── */
const untested = names.filter((x) => !used.has(x));
check(
  "Jedes Tool ist mindestens einmal wirklich gelaufen",
  untested.length === 0,
  `nie aufgerufen: ${untested.join(", ")}`,
);

const failed = checks.filter((c) => !c.ok);
console.log(
  `\n${checks.length - failed.length}/${checks.length} bestanden · ${calls.length} Plausible-Aufrufe`,
);
process.exit(failed.length ? 1 : 0);
