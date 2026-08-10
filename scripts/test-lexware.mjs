#!/usr/bin/env node
/**
 * Prüft den Lexware-Worker gegen eine Lexware-Attrappe.
 *
 * Ohne echten API-Key (die Public API setzt Lexware Office XL voraus) lässt sich sonst
 * nichts davon ausführen. Geprüft wird das, was falsch sein KANN, ohne dass es auffällt:
 * die Statusprüfung, die Paginierung, die Umsatzrechnung, die Überfälligkeitsrechnung,
 * die Ratenbegrenzung und der Download-Link.
 *
 *   node scripts/test-lexware.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/lexware/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const KEY = "lxo-test-key-123";

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

/* ── Lexware-Attrappe ─────────────────────────────────────────────────────── */
const realFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  if (!raw.includes("api.lexware.io")) return realFetch(input, init);
  const url = new URL(raw);
  const auth = (init.headers?.Authorization ?? "").replace("Bearer ", "");
  calls.push({ at: Date.now(), path: url.pathname, query: Object.fromEntries(url.searchParams) });
  const jsonRes = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  if (auth !== KEY) return jsonRes({ message: "unauthorized" }, 401);

  if (url.pathname === "/v1/profile") {
    return jsonRes({ organizationId: "org-1", companyName: "Musterbau GmbH", userName: "Chef" });
  }

  if (url.pathname === "/v1/voucherlist") {
    const page = Number(url.searchParams.get("page") ?? 0);
    const status = url.searchParams.get("voucherStatus") ?? "";
    // Zwei Seiten à 2 Rechnungen; die zweite ist die letzte.
    const all = [
      { id: "inv-1", voucherType: "invoice", voucherNumber: "RE-1", voucherStatus: "paid",
        voucherDate: "2026-01-15", dueDate: "2026-01-29", contactName: "Kunde A",
        totalAmount: 1190, openAmount: 0, currency: "EUR" },
      { id: "inv-2", voucherType: "invoice", voucherNumber: "RE-2", voucherStatus: "overdue",
        voucherDate: "2026-02-10", dueDate: "2026-02-24", contactName: "Kunde B",
        totalAmount: 2380, openAmount: 2380, currency: "EUR" },
      { id: "inv-3", voucherType: "invoice", voucherNumber: "RE-3", voucherStatus: "open",
        voucherDate: "2026-02-20", dueDate: "2099-01-01", contactName: "Kunde C",
        totalAmount: 595, openAmount: 595, currency: "EUR" },
      { id: "inv-4", voucherType: "invoice", voucherNumber: "RE-4", voucherStatus: "paid",
        voucherDate: "2026-03-01", dueDate: "2026-03-15", contactName: "Kunde A",
        totalAmount: 1000, openAmount: 0, currency: "EUR" },
    ];
    const rows = status === "paid" ? all.filter((r) => r.voucherStatus === "paid") : all;
    const perPage = 2;
    const slice = rows.slice(page * perPage, page * perPage + perPage);
    return jsonRes({
      content: slice,
      page,
      size: perPage,
      totalPages: Math.ceil(rows.length / perPage),
      totalElements: rows.length,
      last: (page + 1) * perPage >= rows.length,
    });
  }

  if (url.pathname === "/v1/contacts" && (init.method ?? "GET") === "GET") {
    return jsonRes({
      content: [
        { id: "c-1", version: 3, company: { name: "Kunde A GmbH" }, roles: { customer: { number: 10001 } },
          emailAddresses: { business: ["a@kunde.de"] } },
      ],
      page: 0, size: 250, totalPages: 1, totalElements: 1, last: true,
    });
  }
  if (url.pathname === "/v1/contacts" && init.method === "POST") {
    const body = JSON.parse(init.body);
    if (!body.roles || !Object.keys(body.roles).length) return jsonRes({ message: "roles required" }, 400);
    return jsonRes({ id: "c-new", version: 1 }, 201);
  }
  if (url.pathname === "/v1/contacts/c-new") {
    return jsonRes({ id: "c-new", version: 1, company: { name: "Neue Firma GmbH" }, roles: { customer: { number: 10002 } } });
  }

  if (url.pathname === "/v1/invoices" && init.method === "POST") {
    const body = JSON.parse(init.body);
    if (!body.lineItems?.length) return jsonRes({ message: "lineItems required" }, 400);
    return jsonRes({ id: "inv-new", resourceUri: "x" }, 201);
  }
  if (url.pathname === "/v1/invoices/inv-new") {
    const finalized = calls.some((c) => c.path === "/v1/invoices" && c.query.finalize === "true");
    return jsonRes({
      id: "inv-new",
      voucherNumber: finalized ? "RE-5" : null,
      voucherStatus: finalized ? "open" : "draft",
      totalPrice: { totalNetAmount: 1000, totalGrossAmount: 1190 },
    });
  }
  if (url.pathname === "/v1/invoices/inv-1/file") return jsonRes({ documentFileId: "file-9" });
  if (url.pathname === "/v1/files/file-9") {
    return new Response("%PDF-1.4 fake", { headers: { "content-type": "application/pdf" } });
  }

  return jsonRes({ message: `unhandled ${url.pathname}` }, 404);
};

const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://lex.test" + path, init), env);

const checks = [];
const check = (name, cond, detail = "") => {
  checks.push({ name, ok: Boolean(cond) });
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
};

/* ── OAuth bis zum Token ──────────────────────────────────────────────────── */
const reg = await (
  await call("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Test", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }),
  })
).json();
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authBody = {
  client_id: reg.client_id, redirect_uri: REDIRECT, response_type: "code",
  state: "s", code_challenge: challenge, code_challenge_method: "S256",
};

const badLogin = await call("/authorize", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ ...authBody, apiKey: "falsch" }).toString(),
});
check("Falscher API-Key wird an der Anmeldung abgewiesen", (await badLogin.text()).includes("abgelehnt"));

const ok = await call("/authorize", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ ...authBody, apiKey: KEY }).toString(),
});
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
check("API-Key steht nicht im Klartext in KV", !dump.includes(KEY));

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
  return { isError: res.result?.isError, text, data: safeParse(text) };
}
const safeParse = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

/* ── Tool-Katalog ─────────────────────────────────────────────────────────── */
const list = await (
  await call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
  })
).json();
check("tools/list liefert 17 Tools", list.result?.tools?.length === 17, `${list.result?.tools?.length}`);
check(
  "Jedes Tool hat Beschreibung, Titel und Annotation",
  list.result.tools.every((t) => t.description && t.title && t.annotations),
);

/* ── Die Falle: ungültiger Status ─────────────────────────────────────────── */
const badStatus = await tool("list_vouchers", { voucher_type: "invoice", voucher_status: "accepted" });
check(
  "Ungültiger voucherStatus wird abgelehnt statt als leere Liste durchgereicht",
  badStatus.isError === true && badStatus.text.includes("leere Liste"),
  badStatus.text.slice(0, 160),
);
const badType = await tool("list_vouchers", { voucher_type: "rechnung" });
check("Unbekannte Belegart wird abgelehnt", badType.isError === true, badType.text.slice(0, 120));

/* ── Paginierung und Default-Status ───────────────────────────────────────── */
const vouchers = await tool("list_vouchers", { voucher_type: "invoice" });
check("Default-Status für Rechnungen ist open,paid", vouchers.data?.voucher_status === "open,paid", vouchers.text.slice(0, 160));
check("Beide Seiten werden eingesammelt (4 Belege)", vouchers.data?.anzahl === 4, JSON.stringify(vouchers.data?.anzahl));
check("Nicht abgeschnitten, und das steht auch so da", vouchers.data?.abgeschnitten === false);

const capped = await tool("list_vouchers", { voucher_type: "invoice", limit: 2 });
check("Ein gekapptes Ergebnis meldet das ehrlich", capped.data?.abgeschnitten === true && Boolean(capped.data?.hinweis));

/* ── Ratenbegrenzung ──────────────────────────────────────────────────────── */
const listCalls = calls.filter((c) => c.path === "/v1/voucherlist");
const gaps = listCalls.slice(1).map((c, i) => c.at - listCalls[i].at).filter((g) => g >= 0 && g < 5000);
check(
  "Aufrufe halten den Mindestabstand von 2 Requests/Sekunde ein",
  gaps.length > 0 && gaps.every((g) => g >= 500),
  `Abstände: ${gaps.join(", ")} ms`,
);

/* ── Rechnen ──────────────────────────────────────────────────────────────── */
const rev = await tool("revenue", { date_from: "2026-01-01", date_to: "2026-12-31" });
check("Umsatz 'gestellt' summiert alle vier Rechnungen (5165)", rev.data?.summe_brutto === 5165, JSON.stringify(rev.data?.summe_brutto));
check("Monatsaufteilung stimmt", rev.data?.pro_monat?.["2026-02"] === 2975, JSON.stringify(rev.data?.pro_monat));

const revPaid = await tool("revenue", { date_from: "2026-01-01", date_to: "2026-12-31", basis: "bezahlt" });
check("Umsatz 'bezahlt' zählt nur bezahlte Rechnungen (2190)", revPaid.data?.summe_brutto === 2190, JSON.stringify(revPaid.data?.summe_brutto));

const open = await tool("open_items");
check("Offene Posten summieren nur wirklich Offenes (2975)", open.data?.summe_offen === 2975, JSON.stringify(open.data?.summe_offen));
check(
  "Als 'overdue' gemeldete Rechnung zählt als offen",
  open.data?.posten?.some((p) => p.nr === "RE-2"),
  JSON.stringify(open.data?.posten?.map((p) => p.nr)),
);
check(
  "Überfälligkeit wird gerechnet und absteigend sortiert",
  (open.data?.posten?.[0]?.tage_ueberfaellig ?? 0) > 0,
  JSON.stringify(open.data?.posten?.[0]),
);
const overdueOnly = await tool("open_items", { overdue_only: true });
check("overdue_only filtert die nicht fällige Rechnung raus", overdueOnly.data?.anzahl === 1, JSON.stringify(overdueOnly.data?.anzahl));

/* ── Download-Link ────────────────────────────────────────────────────────── */
const dl = await tool("download_document", { doc_type: "invoice", document_id: "inv-1", minutes: 10 });
check("download_document liefert einen Link", typeof dl.data?.url === "string" && dl.data.url.includes("/f/"), dl.text.slice(0, 160));
const token = dl.data?.url?.split("/f/")[1];
check("Der Link-Token steht nicht im Klartext in KV", token && ![...env.OAUTH_KV.store.keys()].some((k) => k.includes(token)));

const fileRes = await call(`/f/${token}`);
check("Der Link liefert das PDF aus", fileRes.status === 200 && fileRes.headers.get("content-type")?.includes("pdf"), String(fileRes.status));
check("Die Datei wird nicht zwischengespeichert", fileRes.headers.get("cache-control")?.includes("no-store"));
const bogus = await call("/f/hmcp_dl_gibtesnicht");
check("Ein erfundener Link läuft ins Leere", bogus.status === 404);

/* ── Schreiben ────────────────────────────────────────────────────────────── */
const noName = await tool("create_contact", { email: "x@y.de" });
check("Kontakt ohne Firma und ohne Nachname wird abgelehnt", noName.isError === true, noName.text.slice(0, 140));

const contact = await tool("create_contact", { company_name: "Neue Firma GmbH", city: "Hamburg" });
check("Kontakt anlegen liefert id und Nummer zurück", contact.data?.id === "c-new" && contact.data?.nummer === 10002, contact.text.slice(0, 160));

const draft = await tool("create_document", {
  doc_type: "invoice",
  contact_id: "c-1",
  line_items: [{ name: "Beratung", quantity: 10, unit_name: "Stunde", net_price: 100 }],
});
check("Entwurf wird als Entwurf gekennzeichnet", draft.data?.finalisiert === false && draft.data?.status === "draft", draft.text.slice(0, 200));
check("Der Entwurf-Hinweis nennt die fehlende Belegnummer", String(draft.data?.hinweis).includes("keine Belegnummer"));

const badUnit = await tool("create_document", {
  doc_type: "invoice",
  contact_id: "c-1",
  line_items: [{ name: "Beratung", quantity: 10, net_price: 100 }],
});
check("Position ohne Einheit wird lokal abgefangen", badUnit.isError === true && badUnit.text.includes("unit_name"), badUnit.text.slice(0, 140));

const badDoc = await tool("create_document", { doc_type: "dunning", contact_id: "c-1", line_items: [{ name: "x", quantity: 1, unit_name: "Stück", net_price: 1 }] });
check("Mahnung über create_document wird auf create_dunning verwiesen", badDoc.isError === true && badDoc.text.includes("create_dunning"));

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} bestanden · ${calls.length} Lexware-Aufrufe`);
process.exit(failed.length ? 1 : 0);
