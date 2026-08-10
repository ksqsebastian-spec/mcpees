#!/usr/bin/env node
/**
 * Prüft den FLOWWER-Worker gegen eine Attrappe.
 *
 * Ohne FLOWWER-Konto gibt es keine andere Möglichkeit, irgendetwas davon auszuführen.
 * Geprüft wird das, was still falsch sein kann: die Kontokennung-Normalisierung, das
 * Lesen der Feldbeschreibung aus EDMX, die Ablehnung unbekannter Felder, der Bau des
 * $filter-Ausdrucks samt Maskierung von Anführungszeichen, die Gruppierung und die
 * ehrliche Meldung, wenn Zeilen fehlen.
 *
 *   node scripts/test-flowwer.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/flowwer/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const ACCOUNT = "musterbau";
const KEY = "flw-test-key-123";

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) return this.store.delete(key), null;
    return type === "json" ? JSON.parse(e.value) : e.value;
  }
  async put(key, value, opts = {}) {
    this.store.set(key, { value, expires: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null });
  }
  async delete(key) {
    this.store.delete(key);
  }
}

/* ── FLOWWER-Attrappe ─────────────────────────────────────────────────────── */
const EDMX = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
 <edmx:DataServices>
  <Schema Namespace="Flowwer.Reporting" xmlns="http://docs.oasis-open.org/odata/ns/edm">
   <EntityType Name="Document">
    <Key><PropertyRef Name="documentId"/></Key>
    <Property Name="documentId" Type="Edm.String" Nullable="false"/>
    <Property Name="documentNumber" Type="Edm.String"/>
    <Property Name="invoiceNumber" Type="Edm.String"/>
    <Property Name="supplierName" Type="Edm.String"/>
    <Property Name="invoiceDate" Type="Edm.Date"/>
    <Property Name="currentStage" Type="Edm.String"/>
    <Property Name="paymentState" Type="Edm.String"/>
    <Property Name="amountGross" Type="Edm.Decimal" Scale="2"/>
   </EntityType>
   <EntityType Name="DocumentWithReceiptSplit">
    <Property Name="documentId" Type="Edm.String"/>
    <Property Name="costCenter" Type="Edm.String"/>
    <Property Name="amountNet" Type="Edm.Decimal"/>
   </EntityType>
  </Schema>
 </edmx:DataServices>
</edmx:Edmx>`;

const ROWS = [
  { documentId: "d1", invoiceNumber: "R-1", supplierName: "O'Brien Bau GmbH", invoiceDate: "2026-01-10",
    currentStage: "Freigabe", paymentState: "offen", amountGross: 1190 },
  { documentId: "d2", invoiceNumber: "R-2", supplierName: "Meier Elektro", invoiceDate: "2026-02-04",
    currentStage: "Freigabe", paymentState: "offen", amountGross: 2380 },
  { documentId: "d3", invoiceNumber: "R-3", supplierName: "Meier Elektro", invoiceDate: "2026-03-01",
    currentStage: "Verarbeitet", paymentState: "bezahlt", amountGross: 500 },
];

const realFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  if (!raw.includes("flowwer.de")) return realFetch(input, init);
  const url = new URL(raw);
  const key = init.headers?.["X-FLOWWER-ApiKey"];
  calls.push({ host: url.host, path: url.pathname, query: Object.fromEntries(url.searchParams) });

  if (url.host !== `${ACCOUNT}.flowwer.de`) return new Response("no such tenant", { status: 404 });
  if (key !== KEY) return new Response(JSON.stringify({ error: "nope" }), { status: 401 });

  const json = (d, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

  if (url.pathname === "/odata/reporting/") {
    return json({ value: [{ name: "Documents" }, { name: "DocumentsWithReceiptSplits" }] });
  }
  if (url.pathname === "/odata/reporting/$metadata") {
    return new Response(EDMX, { headers: { "content-type": "application/xml" } });
  }
  if (url.pathname === "/odata/reporting/Documents") {
    const f = url.searchParams.get("$filter") ?? "";
    let rows = ROWS;
    // Nur so viel Filterlogik, wie die Tests brauchen.
    const stage = /currentStage eq '([^']*)'/.exec(f);
    if (stage) rows = rows.filter((r) => r.currentStage === stage[1]);
    const sup = /contains\(supplierName,'((?:[^']|'')*)'\)/.exec(f);
    if (sup) rows = rows.filter((r) => r.supplierName.includes(sup[1].replace(/''/g, "'")));
    const von = /invoiceDate ge (\d{4}-\d{2}-\d{2})/.exec(f);
    if (von) rows = rows.filter((r) => r.invoiceDate >= von[1]);
    const top = Number(url.searchParams.get("$top") ?? 50);
    return json({ "@odata.count": rows.length, value: rows.slice(0, top) });
  }
  if (/^\/api\/v1\/documents\/[^/]+\/receiptsplits$/.test(url.pathname)) {
    return json({ documentId: "d1", invoiceNumber: "R-1", documentReceiptSplits: [
      { splitId: 1, account: "6300", costCenter: "K1", amountNet: 1000, amountTax: 190, amountGross: 1190 },
    ] });
  }
  if (url.pathname === "/swagger/v1/swagger.json") {
    return json({ info: { title: "FLOWWER API", version: "v1" }, paths: {
      "/api/v1/upload": { post: { summary: "Dokument hochladen" } },
      "/api/v1/documents/{documentId}/receiptsplits": { get: { summary: "Belegaufteilungen lesen" }, put: { summary: "ersetzen" } },
      "/api/v1/find": { post: { summary: "Dokumente über Filterpfad finden" } },
    } });
  }
  if (url.pathname === "/api/v1/upload" && init.method === "POST") {
    return json({ documentId: "neu-1", status: "queued" }, 201);
  }
  return new Response("not found", { status: 404 });
};

const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://flw.test" + path, init), env);

const checks = [];
const check = (name, cond, detail = "") => {
  checks.push({ name, ok: Boolean(cond) });
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
};

/* ── Anmeldung ────────────────────────────────────────────────────────────── */
const reg = await (
  await call("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Test", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }),
  })
).json();
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const base = {
  client_id: reg.client_id, redirect_uri: REDIRECT, response_type: "code",
  state: "s", code_challenge: challenge, code_challenge_method: "S256",
};
const post = (body) =>
  call("/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

const consent = await (await call(`/authorize?${new URLSearchParams(base)}`)).text();
check("Anmeldeseite fragt beide Felder ab", consent.includes('name="account"') && consent.includes('name="apiKey"'));
check("Die Kontokennung ist kein Passwortfeld", /name="account"[^>]*type="text"/s.test(consent) || consent.includes('type="text"'));

check("Fehlendes Feld wird benannt", (await (await post({ ...base, account: ACCOUNT, apiKey: "" })).text()).includes("API-Key"));
check("Falscher Schlüssel wird abgewiesen", (await (await post({ ...base, account: ACCOUNT, apiKey: "falsch" })).text()).includes("abgelehnt"));
check("Falsche Kontokennung wird abgewiesen", (await (await post({ ...base, account: "gibtsnicht", apiKey: KEY })).text()).includes("abgelehnt"));
check(
  "Eine ganze URL als Kontokennung wird akzeptiert und gekürzt",
  Boolean((await post({ ...base, account: "https://musterbau.flowwer.de/", apiKey: KEY })).headers.get("location")),
);

const ok = await post({ ...base, account: ACCOUNT, apiKey: KEY });
const code = new URL(ok.headers.get("location")).searchParams.get("code");
const tok = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: REDIRECT,
      client_id: reg.client_id, code_verifier: verifier,
    }).toString(),
  })
).json();
check("Code-Tausch liefert ein Token", Boolean(tok.access_token), JSON.stringify(tok));

const dump = [...env.OAUTH_KV.store.values()].map((e) => e.value).join("|");
check("Weder Schlüssel noch Kontokennung stehen im Klartext in KV", !dump.includes(KEY));

let id = 0;
async function tool(name, args = {}) {
  const res = await (
    await call("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tok.access_token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
  ).json();
  const text = res.result?.content?.[0]?.text ?? "";
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { isError: res.result?.isError, text, data };
}

const list = await (
  await call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
  })
).json();
check("tools/list liefert 6 Tools", list.result?.tools?.length === 6, `${list.result?.tools?.length}`);

/* ── Feldbeschreibung aus EDMX ────────────────────────────────────────────── */
const felder = await tool("felder_auflisten", { collection: "Documents" });
check("EDMX wird gelesen: 8 Felder auf Document", Object.keys(felder.data?.felder ?? {}).length === 8, felder.text.slice(0, 200));
check("Typen kommen mit", felder.data?.felder?.invoiceDate === "Edm.Date", JSON.stringify(felder.data?.felder));

const metaCallsVorher = calls.filter((c) => c.path.endsWith("$metadata")).length;
await tool("felder_auflisten", {});
check("Die Feldbeschreibung wird zwischengespeichert", calls.filter((c) => c.path.endsWith("$metadata")).length === metaCallsVorher);

/* ── Die Falle: unbekanntes Feld ──────────────────────────────────────────── */
const badField = await tool("dokumente_suchen", { filter: [{ feld: "lieferantName", wert: "x" }] });
check(
  "Unbekanntes Feld wird abgefangen, bevor der Request rausgeht",
  badField.isError === true && badField.text.includes("supplierName"),
  badField.text.slice(0, 180),
);
const badOp = await tool("dokumente_suchen", { filter: [{ feld: "supplierName", operator: "like", wert: "x" }] });
check("Unbekannter Operator wird abgelehnt", badOp.isError === true, badOp.text.slice(0, 140));
const badDate = await tool("dokumente_suchen", { datum_von: "01.02.2026" });
check("Falsches Datumsformat wird abgefangen", badDate.isError === true && badDate.text.includes("YYYY-MM-DD"), badDate.text.slice(0, 140));

/* ── Filterbau ────────────────────────────────────────────────────────────── */
const suche = await tool("dokumente_suchen", { stufe: "Freigabe" });
check("Filter auf die Stufe wirkt (2 Treffer)", suche.data?.anzahl === 2, JSON.stringify(suche.data?.anzahl));
check("Sortierung wird gesetzt", suche.data?.abfrage?.orderby === "invoiceDate desc", JSON.stringify(suche.data?.abfrage));

const apostroph = await tool("dokumente_suchen", { lieferant: "O'Brien" });
const letzterFilter = calls.filter((c) => c.path.endsWith("/Documents")).at(-1)?.query?.$filter ?? "";
check("Apostroph im Suchwort wird maskiert", letzterFilter.includes("''Brien"), letzterFilter);
check("…und findet trotzdem den richtigen Datensatz", apostroph.data?.anzahl === 1, JSON.stringify(apostroph.data?.anzahl));

const datum = await tool("dokumente_suchen", { datum_von: "2026-02-01" });
check("Edm.Date wird ohne Anführungszeichen geschrieben", /invoiceDate ge 2026-02-01/.test(calls.at(-1)?.query?.$filter ?? ""), calls.at(-1)?.query?.$filter);
check("Datumsfilter liefert 2 Zeilen", datum.data?.anzahl === 2, JSON.stringify(datum.data?.anzahl));

/* ── Auswertung ───────────────────────────────────────────────────────────── */
const aus = await tool("auswertung", { gruppiere_nach: "supplierName", summiere: "amountGross" });
const meier = aus.data?.gruppen?.find((g) => g.wert === "Meier Elektro");
check("Gruppierung summiert richtig (2380 + 500)", meier?.summe === 2880 && meier?.anzahl === 2, JSON.stringify(aus.data?.gruppen));
check("Absteigend nach Summe sortiert", aus.data?.gruppen?.[0]?.wert === "Meier Elektro", JSON.stringify(aus.data?.gruppen?.[0]));

const eng = await tool("auswertung", { gruppiere_nach: "currentStage", limit: 2 });
check("Zu wenig geladene Zeilen werden als Warnung gemeldet", eng.data?.abgeschnitten === true && Boolean(eng.data?.warnung), JSON.stringify(eng.data).slice(0, 200));

/* ── Weitere Tools ────────────────────────────────────────────────────────── */
const splits = await tool("belegaufteilungen_lesen", { document_id: "d1" });
check("Belegaufteilungen kommen durch", splits.data?.documentReceiptSplits?.length === 1, splits.text.slice(0, 160));

const api = await tool("api_erkunden", {});
check("OpenAPI des Kontos wird gefunden", api.data?.anzahl === 4 && api.data?.quelle === "/swagger/v1/swagger.json", api.text.slice(0, 200));
const gefiltert = await tool("api_erkunden", { suche: "find" });
check("Suche im Endpunktverzeichnis grenzt ein", gefiltert.data?.anzahl === 1, JSON.stringify(gefiltert.data?.anzahl));

const up = await tool("dokument_hochladen", { filename: "rechnung.pdf", content_base64: btoa("%PDF-1.4 test") });
check("Upload geht durch und meldet die Antwort", up.data?.antwort?.documentId === "neu-1", up.text.slice(0, 160));
const upBad = await tool("dokument_hochladen", { filename: "x.pdf" });
check("Upload ohne Inhalt wird abgelehnt", upBad.isError === true, upBad.text.slice(0, 140));

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} bestanden · ${calls.length} FLOWWER-Aufrufe`);
process.exit(failed.length ? 1 : 0);
