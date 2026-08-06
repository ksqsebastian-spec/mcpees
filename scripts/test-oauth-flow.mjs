#!/usr/bin/env node
/**
 * Durchläuft den kompletten OAuth-Flow gegen den gebauten Worker — mit einem KV-Ersatz
 * im Speicher und einem gefälschten HERO.
 *
 * Warum das nötig ist: ohne echten HERO-API-Key lässt sich am Live-Server alles bis zur
 * Key-Prüfung testen, aber nicht das, was danach kommt — Code-Tausch, PKCE-Verifikation,
 * Ver- und Entschlüsselung des Keys, Refresh-Rotation, ein echter tools/call. Genau das
 * prüft dieses Skript.
 *
 *   node scripts/test-oauth-flow.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/hero/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const FAKE_KEY = "hero-test-key-123";

/* ── KV im Speicher, inklusive TTL-Semantik ───────────────────────────────── */
class MemoryKV {
  store = new Map();
  async get(key, type) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
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

/* ── HERO-Attrappe: antwortet nur auf den erwarteten Key ──────────────────── */
const realFetch = globalThis.fetch;
let heroCalls = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.includes("hero-software.de")) return realFetch(input, init);
  heroCalls++;
  const auth = (init.headers?.Authorization ?? init.headers?.authorization ?? "").replace("Bearer ", "");
  if (auth !== FAKE_KEY) {
    return new Response(JSON.stringify({ errors: [{ message: "Unauthenticated" }] }), { status: 403 });
  }
  const query = JSON.parse(init.body).query;
  const data = query.includes("company { id name } user")
    ? { company: { id: 1, name: "Testbetrieb GmbH" }, user: { id: 9, email: "chef@test.de", partner: { full_name: "Max Muster" } } }
    : {
        company: { id: 1, name: "Testbetrieb GmbH", measures: [{ id: 5, name: "Projekt", short: "PRJ" }] },
        user: { id: 9, email: "chef@test.de", partner: { id: 77, full_name: "Max Muster" } },
        project_types: [{ id: 3, name: "Projekte", is_default: true, is_active: true, project_status_steps: [{ id: 10, name: "Neu", status_code: 0, sort_order: 1, is_active: true }] }],
        document_types: [{ id: 20, name: "Angebot", base_type: "offer", is_active: true }, { id: 21, name: "Rechnung", base_type: "invoice", is_active: true }],
        calendar_event_categories: [{ id: 30, name: "Vor Ort" }],
        // Antwort auf list_open_invoices
        customer_documents: [
          { id: 500, nr: "RE-1", value: 1190, vat: 190, date: "2026-07-01", status_code: 100, status_name: "Veröffentlicht", project_match_id: 7,
            contact: { id: 2, full_name: "Erika Kunde", company_name: null, email: "e@k.de" },
            customer_document_booking: { is_open: true, status_name: "offen", due_date: "2026-07-15", paid_date: null, balance: 1190, payments: [{ id: 1, value: 190, paid_date: "2026-07-10" }] } },
        ],
      };
  return new Response(JSON.stringify({ data }), { status: 200, headers: { "X-Complexity": "42" } });
};

const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://hero.test" + path, init), env);

const checks = [];
const check = (name, cond, detail = "") => {
  checks.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
};

/* ── 1. Registrierung ─────────────────────────────────────────────────────── */
const reg = await (
  await call("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Testclient", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }),
  })
).json();
check("Dynamic Client Registration liefert client_id", reg.client_id?.startsWith("hmcp_c_"), JSON.stringify(reg));

/* ── 2. PKCE-Paar ─────────────────────────────────────────────────────────── */
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

const form = (o) => new URLSearchParams(o);
const authBody = {
  client_id: reg.client_id,
  redirect_uri: REDIRECT,
  response_type: "code",
  state: "state-123",
  code_challenge: challenge,
  code_challenge_method: "S256",
};

/* ── 3. Falscher Key wird abgelehnt ───────────────────────────────────────── */
const bad = await call("/authorize", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form({ ...authBody, hero_api_key: "falsch" }).toString(),
});
check("Falscher HERO-Key liefert kein Redirect", bad.status === 200 && (await bad.text()).includes("abgelehnt"));

/* ── 4. Richtiger Key → Auth-Code ─────────────────────────────────────────── */
const ok = await call("/authorize", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form({ ...authBody, hero_api_key: FAKE_KEY }).toString(),
});
const location = ok.headers.get("location") ?? "";
const code = new URL(location || "https://x/?").searchParams.get("code");
check("Gültiger Key führt zum Redirect mit Code", Boolean(code), location);
check("state wird unverändert zurückgegeben", location.includes("state=state-123"), location);

/* ── 5. Code-Tausch mit falschem Verifier scheitert ───────────────────────── */
const wrongVerifier = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: "falsch" }).toString(),
  })
).json();
check("Falscher code_verifier wird abgewiesen", wrongVerifier.error === "invalid_grant", JSON.stringify(wrongVerifier));

/* ── 6. …und verbrennt den Code (Einmalgebrauch) ──────────────────────────── */
const reuse = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier }).toString(),
  })
).json();
check("Code ist nach einem Versuch verbraucht", reuse.error === "invalid_grant", JSON.stringify(reuse));

/* ── 7. Frischer Durchlauf bis zum Token ──────────────────────────────────── */
const ok2 = await call("/authorize", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form({ ...authBody, hero_api_key: FAKE_KEY }).toString(),
});
const code2 = new URL(ok2.headers.get("location")).searchParams.get("code");
const tok = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "authorization_code", code: code2, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier }).toString(),
  })
).json();
check("Code-Tausch liefert Access- und Refresh-Token", tok.access_token && tok.refresh_token, JSON.stringify(tok));

/* ── 8. Der HERO-Key liegt nirgends im Klartext in KV ─────────────────────── */
const dump = [...env.OAUTH_KV.store.values()].map((e) => e.value).join("|");
check("HERO-Key steht nicht im Klartext in KV", !dump.includes(FAKE_KEY));
check("Access-Token steht nicht im Klartext in KV", !dump.includes(tok.access_token));

/* ── 9. MCP mit dem Token ─────────────────────────────────────────────────── */
const rpc = (body, token) =>
  call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const init = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, tok.access_token)).json();
check("initialize antwortet", init.result?.serverInfo?.name === "hero", JSON.stringify(init).slice(0, 200));

const list = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tok.access_token)).json();
check("tools/list liefert 34 Tools", list.result?.tools?.length === 34, `${list.result?.tools?.length}`);

const called = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_open_invoices", arguments: {} } }, tok.access_token)).json();
const payload = JSON.parse(called.result?.content?.[0]?.text ?? "{}");
check("tools/call entschlüsselt den Key und ruft HERO", called.result?.isError === false, JSON.stringify(called).slice(0, 300));
check("Offene Posten werden korrekt gerechnet (1190 − 190 = 1000)", payload.summe === 1000, JSON.stringify(payload).slice(0, 200));

const badTool = await (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_stock", arguments: {} } }, tok.access_token)).json();
check("Fehlendes Pflichtargument kommt als isError zurück", badTool.result?.isError === true, JSON.stringify(badTool).slice(0, 200));

/* ── 10. Refresh mit Rotation ─────────────────────────────────────────────── */
const refreshed = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }).toString(),
  })
).json();
check("Refresh liefert neues Token-Paar", refreshed.access_token && refreshed.refresh_token !== tok.refresh_token);

const replay = await (
  await call("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }).toString(),
  })
).json();
check("Altes Refresh-Token gilt nach Rotation nicht mehr", replay.error === "invalid_grant");

const afterRefresh = await (await rpc({ jsonrpc: "2.0", id: 5, method: "tools/list" }, refreshed.access_token)).json();
check("Neues Access-Token funktioniert", afterRefresh.result?.tools?.length === 34);

/* ── 11. Widerruf ─────────────────────────────────────────────────────────── */
await call("/revoke", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form({ token: refreshed.access_token, client_id: reg.client_id }).toString(),
});
check("Nach Widerruf ist das Token wertlos", (await rpc({ jsonrpc: "2.0", id: 6, method: "tools/list" }, refreshed.access_token)).status === 401);

const stillOld = await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" }, tok.access_token);
check("Widerruf trifft die ganze Freigabe, nicht nur ein Token", stillOld.status === 401);

/* ── Ergebnis ─────────────────────────────────────────────────────────────── */
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} bestanden · ${heroCalls} HERO-Aufrufe`);
process.exit(failed.length ? 1 : 0);
