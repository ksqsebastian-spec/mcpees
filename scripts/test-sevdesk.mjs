#!/usr/bin/env node
/**
 * Prüft den sevdesk-Worker gegen eine sevdesk-Attrappe.
 *
 * Ohne echten Zugang lässt sich sonst kein einziges Tool ausführen. Geprüft wird das, was
 * falsch sein KANN, ohne dass es auffällt:
 *
 *  - Filter auf Fremdobjekte ohne objectName — sevdesk würde ungefiltert antworten.
 *  - Datumsfilter als Zeichenkette statt Zeitstempel — liefert Unsinn statt eines Fehlers.
 *  - Ein Statuswert, nach dem sich gar nicht filtern lässt (750).
 *  - Ein Query-Parameter, den es nicht gibt — sevdesk ignoriert ihn stillschweigend.
 *  - Positionen, die beim Anlegen verworfen werden, ohne dass ein Fehler kommt.
 *  - Ein Konto, in dem die Pflicht-IDs (Benutzer, Einheit, Land) nirgends zu holen sind.
 *
 * Außerdem wird geprüft, dass JEDES Tool mindestens einmal wirklich läuft. Der Client
 * prüft jeden Aufruf gegen die eingefrorene API-Beschreibung — ein falsch geschriebener
 * Pfad oder Parameter fliegt damit hier auf und nicht beim Nutzer.
 *
 *   node scripts/test-sevdesk.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/sevdesk/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
/** Zweites Konto: existiert, hat aber keinerlei Belege, Artikel oder Positionen. */
const TOKEN_LEER = "00112233445566778899aabbccddeeff";

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

/* ── Daten der Attrappe ───────────────────────────────────────────────────── */
const unix = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 1000);

const CONTACT_A = { id: "1", objectName: "Contact", name: "Kunde A GmbH" };
const CONTACT_B = { id: "2", objectName: "Contact", name: "Kunde B GmbH" };
const PERSON = { id: "7", objectName: "SevUser", username: "chef" };
const COUNTRY = { id: "1", objectName: "StaticCountry", name: "Deutschland" };
const UNITY = { id: "1", objectName: "Unity", translationCode: "STÜCK" };

const INVOICES = [
  { id: "1", invoiceNumber: "RE-1", status: "1000", invoiceDate: unix("2026-01-15"),
    sumNet: "1000.00", sumTax: "190.00", sumGross: "1190.00", paidAmount: "1190.00",
    contact: CONTACT_A, timeToPay: 14 },
  { id: "2", invoiceNumber: "RE-2", status: "200", invoiceDate: unix("2026-02-10"),
    sumNet: "2000.00", sumTax: "380.00", sumGross: "2380.00", paidAmount: "0",
    contact: CONTACT_B, timeToPay: 14 },
  { id: "3", invoiceNumber: "RE-3", status: "200", invoiceDate: unix("2026-02-20"),
    sumNet: "500.00", sumTax: "95.00", sumGross: "595.00", paidAmount: "95.00",
    contact: CONTACT_A, timeToPay: 36500 },
  { id: "4", invoiceNumber: null, status: "100", invoiceDate: unix("2026-03-01"),
    sumNet: "800.00", sumTax: "152.00", sumGross: "952.00", paidAmount: "0",
    contact: CONTACT_A, timeToPay: 14 },
  { id: "5", invoiceNumber: "RE-5", status: "1000", invoiceDate: unix("2026-03-05"),
    sumNet: "1000.00", sumTax: "190.00", sumGross: "1190.00", paidAmount: "1190.00",
    contact: CONTACT_B, timeToPay: 14 },
].map((i) => ({
  ...i, objectName: "Invoice", invoiceType: "RE", currency: "EUR", showNet: "1",
  smallSettlement: "0", contactPerson: PERSON, addressCountry: COUNTRY,
}));

const TRANSACTIONS = Array.from({ length: 250 }, (_, i) => ({
  id: String(1000 + i), objectName: "CheckAccountTransaction",
  valueDate: unix("2026-01-01") + i * 86_400, amount: "10.00",
  payeePayerName: `Partner ${i}`, paymtPurpose: `Zahlung ${i}`, status: "100",
  checkAccount: { id: "1", objectName: "CheckAccount", name: "Geschäftskonto" },
}));

/* ── Attrappe ─────────────────────────────────────────────────────────────── */
const realFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  if (!raw.includes("my.sevdesk.de")) return realFetch(input, init);
  const url = new URL(raw);
  const path = url.pathname.replace("/api/v1", "");
  const q = Object.fromEntries(url.searchParams);
  const method = init.method ?? "GET";
  const auth = init.headers?.Authorization ?? "";
  calls.push({ at: Date.now(), method, path, q, auth });

  const res = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  const wrap = (objects) => res({ objects });
  const body = () => (init.body && typeof init.body === "string" ? JSON.parse(init.body) : {});

  if (auth !== TOKEN && auth !== TOKEN_LEER) {
    return res({ error: { message: "Authentication required" } }, 401);
  }
  const leer = auth === TOKEN_LEER;

  /** Liste mit limit/offset/countAll bedienen — genau wie sevdesk es beschreibt. */
  const page = (rows) => {
    const offset = Number(q.offset ?? 0);
    const limit = Number(q.limit ?? 100);
    const slice = rows.slice(offset, offset + limit);
    return res(q.countAll === "true" ? { objects: slice, total: String(rows.length) } : { objects: slice });
  };

  if (path === "/Tools/bookkeepingSystemVersion") return wrap({ version: "2.0" });

  if (path === "/CheckAccount" && method === "GET") {
    return page([
      { id: "1", objectName: "CheckAccount", name: "Geschäftskonto", type: "online",
        iban: "DE02120300000000202051", currency: "EUR", status: "100", balance: "5000.00" },
      { id: "2", objectName: "CheckAccount", name: "Kasse", type: "offline",
        currency: "EUR", status: "100", balance: "250.00" },
    ]);
  }
  if (/^\/CheckAccount\/\d+\/getBalanceAtDate$/.test(path)) return wrap("1234.56");
  if (path === "/Contact/Factory/getNextCustomerNumber") return wrap("10003");

  if (path === "/Contact" && method === "GET") {
    if (leer) return page([]);
    const rows = [
      { id: "1", objectName: "Contact", name: "Kunde A GmbH", customerNumber: "10001",
        category: { id: "3", objectName: "Category", name: "Kunde" }, status: "1000" },
      { id: "2", objectName: "Contact", name: "Kunde B GmbH", customerNumber: "10002",
        category: { id: "3", objectName: "Category", name: "Kunde" }, status: "1000" },
      { id: "3", objectName: "Contact", surename: "Erika", familyname: "Mustermann",
        customerNumber: "10003", category: { id: "3", objectName: "Category", name: "Kunde" } },
    ];
    return page(q.customerNumber ? rows.filter((r) => r.customerNumber === q.customerNumber) : rows);
  }
  if (path === "/Contact" && method === "POST") {
    const b = body();
    if (!b.category?.id) return res({ error: { message: "category required" } }, 400);
    return res({ objects: { id: "99", objectName: "Contact", ...b, customerNumber: b.customerNumber ?? "10004" } }, 201);
  }
  if (/^\/Contact\/\d+$/.test(path)) {
    return wrap([{ id: "1", objectName: "Contact", name: "Kunde A GmbH", customerNumber: "10001",
      category: { id: "3", objectName: "Category", name: "Kunde" }, vatNumber: "DE123456789",
      defaultTimeToPay: 14 }]);
  }
  if (path === "/ContactAddress") {
    return page([{ id: "5", objectName: "ContactAddress", street: "Musterweg 1", zip: "20095",
      city: "Hamburg", country: { id: "1", objectName: "StaticCountry", name: "Deutschland" } }]);
  }
  if (path === "/CommunicationWay") {
    return page([{ id: "6", objectName: "CommunicationWay", type: "EMAIL", value: "a@kunde.de", main: "1" }]);
  }

  if (path === "/Invoice" && method === "GET") {
    if (leer) return page([]);
    let rows = INVOICES;
    if (q.status) rows = rows.filter((i) => i.status === String(q.status));
    if (q.invoiceNumber) rows = rows.filter((i) => i.invoiceNumber === q.invoiceNumber);
    if (q.startDate) rows = rows.filter((i) => i.invoiceDate >= Number(q.startDate));
    if (q.endDate) rows = rows.filter((i) => i.invoiceDate <= Number(q.endDate));
    // Genau die Falle: ohne objectName filtert sevdesk NICHT.
    if (q["contact[id]"] && q["contact[objectName]"]) {
      rows = rows.filter((i) => i.contact.id === String(q["contact[id]"]));
    }
    const embed = String(q.embed ?? "");
    if (!embed.includes("contact")) {
      rows = rows.map((i) => ({ ...i, contact: { id: i.contact.id, objectName: "Contact" } }));
    }
    return page(rows);
  }
  if (/^\/Invoice\/\d+$/.test(path)) {
    const id = path.split("/")[2];
    const found = INVOICES.find((i) => i.id === id) ?? CREATED.invoice;
    return found ? wrap([found]) : res({ error: { message: "not found" } }, 404);
  }
  if (/^\/Invoice\/\d+\/getPositions$/.test(path)) {
    const id = path.split("/")[2];
    if (id === "900") return page(CREATED.positions);
    return page([
      { id: "10", objectName: "InvoicePos", positionNumber: 1, name: "Beratung", quantity: "10",
        price: "100.00", taxRate: "19.0", sumNet: "1000.00", sumGross: "1190.00", unity: UNITY },
    ]);
  }
  if (/^\/Invoice\/\d+\/getPdf$/.test(path)) {
    return wrap({ filename: "RE-1.pdf", mimeType: "application/pdf", base64encoded: true,
      content: Buffer.from("%PDF-1.4 fake").toString("base64") });
  }
  if (path === "/InvoicePos" && method === "GET") {
    if (leer) return page([]);
    return page([{ id: "10", objectName: "InvoicePos", unity: UNITY }]);
  }

  if (path === "/Order" && method === "GET") {
    if (leer) return page([]);
    return page([
      { id: "20", objectName: "Order", orderNumber: "AN-1", orderType: "AN", status: "200",
        orderDate: unix("2026-04-01"), sumNet: "3000.00", sumGross: "3570.00", contact: CONTACT_A,
        contactPerson: PERSON, addressCountry: COUNTRY },
    ]);
  }
  if (/^\/Order\/\d+$/.test(path)) {
    return wrap([{ id: "20", objectName: "Order", orderNumber: "AN-1", orderType: "AN", status: "200",
      orderDate: unix("2026-04-01"), sumNet: "3000.00", sumGross: "3570.00", contact: CONTACT_A }]);
  }
  if (/^\/Order\/\d+\/getPositions$/.test(path)) {
    return page([{ id: "21", objectName: "OrderPos", positionNumber: 1, name: "Gerüst",
      quantity: "1", price: "3000.00", taxRate: "19.0", sumNet: "3000.00", unity: UNITY }]);
  }

  if (path === "/Voucher" && method === "GET") {
    let rows = [
      { id: "30", objectName: "Voucher", description: "ER-4711", status: "100", creditDebit: "D",
        voucherType: "VOU", voucherDate: unix("2026-05-02"), sumNet: "100.00", sumTax: "19.00",
        sumGross: "119.00", paidAmount: "0", supplier: { id: "4", objectName: "Contact", name: "Baustoff GmbH" } },
      { id: "31", objectName: "Voucher", description: "ER-4712", status: "1000", creditDebit: "D",
        voucherType: "VOU", voucherDate: unix("2026-05-20"), sumNet: "200.00", sumTax: "38.00",
        sumGross: "238.00", paidAmount: "238.00", supplierName: "Tankstelle" },
    ];
    if (q.status) rows = rows.filter((v) => v.status === String(q.status));
    if (q.creditDebit) rows = rows.filter((v) => v.creditDebit === q.creditDebit);
    return page(rows);
  }
  if (/^\/Voucher\/\d+$/.test(path)) {
    const id = path.split("/")[2];
    if (id === "800") return wrap([CREATED.voucher]);
    return wrap([{ id: "30", objectName: "Voucher", description: "ER-4711", status: "100",
      creditDebit: "D", voucherDate: unix("2026-05-02"), sumNet: "100.00", sumTax: "19.00",
      sumGross: "119.00", paidAmount: "0" }]);
  }
  if (path === "/VoucherPos" && method === "GET") {
    if (q["voucher[id]"] === "800") return page(CREATED.voucherPos);
    return page([{ id: "32", objectName: "VoucherPos", taxRate: "19.0", sumNet: "100.00",
      sumTax: "19.00", sumGross: "119.00", comment: "Material",
      accountDatev: { id: "40", objectName: "AccountDatev", accountNumber: "3400", name: "Wareneingang" } }]);
  }

  if (path === "/Part" && method === "GET") {
    if (leer) return page([]);
    return page([
      { id: "50", objectName: "Part", partNumber: "A-100", name: "Gerüstbohle", unity: UNITY,
        priceNet: "12.50", priceGross: "14.88", pricePurchase: "8.00", taxRate: "19.0",
        stock: "40", stockEnabled: "1", status: "100" },
    ]);
  }
  if (path === "/Part" && method === "POST") {
    const b = body();
    if (!b.unity?.id) return res({ error: { message: "unity required" } }, 400);
    return res({ objects: { id: "51", objectName: "Part", ...b } }, 201);
  }
  if (/^\/Part\/\d+\/getStock$/.test(path)) return wrap(40);

  if (path === "/CheckAccountTransaction" && method === "GET") return page(TRANSACTIONS);

  if (path === "/ReceiptGuidance/forExpense" || path === "/ReceiptGuidance/forRevenue" ||
      path === "/ReceiptGuidance/forAllAccounts") {
    return wrap([
      { accountDatevId: 40, accountNumber: "3400", accountName: "Wareneingang",
        description: "Einkauf von Material", allowedReceiptTypes: ["EXPENSE"],
        allowedTaxRules: [{ id: 9, name: "VORST_ABZUGSF_AUFW", description: "Vorsteuerabziehbare Aufwendungen",
          taxRates: ["ZERO", "SEVEN", "NINETEEN"] }] },
      { accountDatevId: 41, accountNumber: "4000", accountName: "Umsatzerlöse",
        description: "Verkauf von Waren", allowedReceiptTypes: ["REVENUE"],
        allowedTaxRules: [{ id: 1, name: "USTPFL_UMS_EINN", description: "Umsatzsteuerpflichtige Umsätze",
          taxRates: ["ZERO", "SEVEN", "NINETEEN"] }] },
    ]);
  }

  if (path === "/Invoice/Factory/saveInvoice" && method === "POST") {
    const b = body();
    const pos = b.invoicePosSave ?? [];
    // Die Falle: sevdesk verwirft eine Position mit unzulässigem Steuersatz, meldet aber
    // Erfolg. Die Rechnung entsteht mit weniger Zeilen.
    CREATED.positions = pos.filter((p) => [0, 7, 19].includes(Number(p.taxRate)));
    const net = CREATED.positions.reduce((s, p) => s + p.quantity * p.price, 0);
    CREATED.invoice = { id: "900", objectName: "Invoice", invoiceNumber: null,
      status: b.invoice.status, invoiceDate: b.invoice.invoiceDate, invoiceType: "RE",
      sumNet: net.toFixed(2), sumTax: (net * 0.19).toFixed(2), sumGross: (net * 1.19).toFixed(2),
      paidAmount: "0", currency: b.invoice.currency, contact: CONTACT_A, timeToPay: b.invoice.timeToPay };
    CREATED.invoiceBody = b;
    return res({ objects: { invoice: CREATED.invoice } }, 201);
  }
  if (path === "/Voucher/Factory/saveVoucher" && method === "POST") {
    const b = body();
    CREATED.voucherPos = b.voucherPosSave ?? [];
    CREATED.voucher = { id: "800", objectName: "Voucher", description: b.voucher.description,
      status: b.voucher.status, creditDebit: b.voucher.creditDebit, voucherDate: b.voucher.voucherDate,
      sumNet: CREATED.voucherPos.reduce((s, p) => s + p.sumNet, 0).toFixed(2),
      sumTax: "19.00", sumGross: CREATED.voucherPos.reduce((s, p) => s + p.sumGross, 0).toFixed(2) };
    CREATED.voucherBody = b;
    return res({ objects: { voucher: CREATED.voucher } }, 201);
  }
  if (path === "/Voucher/Factory/uploadTempFile" && method === "POST") {
    return res({ objects: { filename: "abc123.pdf", pages: 1, mimeType: "application/pdf" } }, 201);
  }

  return res({ error: { message: `unhandled ${method} ${path}` } }, 404);
};

const CREATED = {};

/* ── Aufbau ───────────────────────────────────────────────────────────────── */
const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://sev.test" + path, init), env);

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

async function login(apiToken) {
  const reg = await (
    await call("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Test", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }),
    })
  ).json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const form = {
    client_id: reg.client_id, redirect_uri: REDIRECT, response_type: "code",
    state: "s", code_challenge: challenge, code_challenge_method: "S256",
  };
  const ok = await call("/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, apiToken }).toString(),
  });
  const location = ok.headers.get("location");
  if (!location) return { error: await ok.text() };
  const code = new URL(location).searchParams.get("code");
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
  return { access_token: tok.access_token, form, client_id: reg.client_id };
}

/* ── Anmeldung ────────────────────────────────────────────────────────────── */
const badShape = await login("kein-hex-token");
check(
  "Ein Token in falschem Format wird vor jedem Netzaufruf abgewiesen",
  String(badShape.error).includes("32 Hexzeichen"),
  String(badShape.error).slice(0, 160),
);
const badToken = await login("ffffffffffffffffffffffffffffffff");
check("Ein formal gültiger, aber falscher Token wird abgewiesen", Boolean(badShape.error) && !badToken.access_token);

const session = await login(TOKEN);
check("Code-Tausch liefert ein Token", Boolean(session.access_token));

const dump = [...env.OAUTH_KV.store.values()].map((e) => e.value).join("|");
check("Der sevdesk-Token steht nicht im Klartext in KV", !dump.includes(TOKEN));

let id = 0;
const used = new Set();
async function tool(name, args = {}, token = session.access_token) {
  used.add(name);
  const res = await (
    await call("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
  ).json();
  const text = res.result?.content?.[0]?.text ?? "";
  return { isError: res.result?.isError, text, data: safeParse(text) };
}

/* ── Katalog ──────────────────────────────────────────────────────────────── */
const list = await (
  await call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
  })
).json();
const names = (list.result?.tools ?? []).map((t) => t.name);
check("tools/list liefert 21 Tools", names.length === 21, String(names.length));
check(
  "Jedes Tool hat Titel, Beschreibung und Annotation",
  list.result.tools.every((t) => t.description && t.title && t.annotations),
);
check(
  "Kein Tool zum Ändern, Löschen, Buchen oder Versenden",
  !names.some((n) => /^(update|delete|book|send|cancel|enshrine|reset|mark)_/.test(n)),
  names.join(", "),
);

/* ── Konto ────────────────────────────────────────────────────────────────── */
const info = await tool("system_info");
check("system_info nennt die Buchhaltungsversion", info.data?.buchhaltungsversion === "2.0", info.text.slice(0, 200));
check("… und daraus abgeleitet die richtige Steuerangabe", String(info.data?.steuerangabe).includes("taxRule"));
check(
  "… und die IDs, die sevdesk nirgends zum Nachschlagen anbietet",
  info.data?.vorgaben_fuers_anlegen?.kontaktperson_id === "7" &&
    info.data?.vorgaben_fuers_anlegen?.einheit_id === "1" &&
    info.data?.vorgaben_fuers_anlegen?.land_id === "1",
  JSON.stringify(info.data?.vorgaben_fuers_anlegen),
);

/* ── Die Fallen ───────────────────────────────────────────────────────────── */
const badStatus = await tool("search_invoices", { status: 750 });
check(
  "Ein Status, nach dem sich nicht filtern lässt (750), wird abgelehnt",
  badStatus.isError === true && badStatus.text.includes("100, 200, 1000"),
  badStatus.text.slice(0, 180),
);

const byContact = await tool("search_invoices", { contact_id: 2 });
const contactCall = calls.filter((c) => c.path === "/Invoice" && c.q["contact[id]"]).at(-1);
check(
  "Ein Filter auf den Kunden schickt id UND objectName — ohne beides filtert sevdesk nicht",
  contactCall?.q["contact[objectName]"] === "Contact",
  JSON.stringify(contactCall?.q),
);
check("… und wirkt dann auch", byContact.data?.anzahl === 2, JSON.stringify(byContact.data?.anzahl));

const byDate = await tool("search_invoices", { date_from: "2026-02-01", date_to: "2026-02-28" });
const dateCall = calls.filter((c) => c.path === "/Invoice" && c.q.startDate).at(-1);
check(
  "Datumsfilter gehen als Zeitstempel raus, nicht als 'YYYY-MM-DD'",
  /^\d+$/.test(dateCall?.q.startDate ?? ""),
  JSON.stringify(dateCall?.q.startDate),
);
check("… und der Zeitraum trifft genau zwei Rechnungen", byDate.data?.anzahl === 2, JSON.stringify(byDate.data?.anzahl));
const badDate = await tool("search_invoices", { date_from: "01.02.2026" });
check("Ein Datum im falschen Format wird abgefangen", badDate.isError === true && badDate.text.includes("YYYY-MM-DD"));

const embedCall = calls.filter((c) => c.path === "/Invoice" && c.q.embed).at(-1);
check("Verschachtelte Objekte werden per embed mitgeholt", String(embedCall?.q.embed).includes("contact"));
check(
  "… sodass an der Rechnung der Kundenname steht und nicht nur eine ID",
  byContact.data?.rechnungen?.[0]?.kunde === "Kunde B GmbH",
  JSON.stringify(byContact.data?.rechnungen?.[0]),
);

/* ── Paginierung ──────────────────────────────────────────────────────────── */
const tx = await tool("search_transactions", { limit: 250 });
const txCalls = calls.filter((c) => c.path === "/CheckAccountTransaction");
check("Über 100 Treffer werden über mehrere Seiten geholt", txCalls.length >= 3, `${txCalls.length} Aufrufe`);
check("Alle 250 Umsätze kommen an", tx.data?.anzahl === 250, JSON.stringify(tx.data?.anzahl));
check("Nicht abgeschnitten — und das steht auch so da", tx.data?.abgeschnitten === false);
const txSmall = await tool("search_transactions", { limit: 20 });
check("Ein gekapptes Ergebnis meldet das ehrlich", txSmall.data?.abgeschnitten === true && txSmall.data?.gesamt_treffer === 250);

/* ── Ratenbegrenzung ──────────────────────────────────────────────────────── */
const gaps = txCalls.slice(1).map((c, i) => c.at - txCalls[i].at).filter((g) => g >= 0 && g < 5000);
check(
  "Aufeinanderfolgende Aufrufe halten einen Mindestabstand ein",
  gaps.length > 0 && gaps.every((g) => g >= 200),
  `Abstände: ${gaps.join(", ")} ms`,
);

/* ── Rechnen ──────────────────────────────────────────────────────────────── */
const rev = await tool("revenue", { date_from: "2026-01-01", date_to: "2026-12-31" });
check("Umsatz 'gestellt' zählt Entwürfe nicht mit (5355 brutto)", rev.data?.summe_brutto === 5355, JSON.stringify(rev.data?.summe_brutto));
check("… und sagt, wieviele Entwürfe ausgelassen wurden", rev.data?.entwuerfe_ausgelassen === 1, JSON.stringify(rev.data?.entwuerfe_ausgelassen));
check(
  "Monatsaufteilung stimmt",
  rev.data?.monate?.find((m) => m.monat === "2026-02")?.brutto === 2975,
  JSON.stringify(rev.data?.monate),
);
const revPaid = await tool("revenue", { date_from: "2026-01-01", date_to: "2026-12-31", basis: "bezahlt" });
check("Umsatz 'bezahlt' zählt nur bezahlte Rechnungen (2380)", revPaid.data?.summe_brutto === 2380, JSON.stringify(revPaid.data?.summe_brutto));
const badBasis = await tool("revenue", { date_from: "2026-01-01", date_to: "2026-12-31", basis: "geschätzt" });
check("Eine erfundene Basis wird abgelehnt", badBasis.isError === true);

const open = await tool("open_items");
check("Teilzahlung wird abgezogen: offen ist 2880, nicht 2975", open.data?.summe_offen === 2880, JSON.stringify(open.data?.summe_offen));
check(
  "Überfällig wird gerechnet und absteigend sortiert",
  open.data?.posten?.[0]?.nr === "RE-2" && open.data.posten[0].tage_ueberfaellig > 0,
  JSON.stringify(open.data?.posten?.[0]),
);
const overdue = await tool("open_items", { overdue_only: true });
check("overdue_only lässt die nicht fällige Rechnung weg", overdue.data?.anzahl === 1, JSON.stringify(overdue.data?.anzahl));

/* ── Lesen quer durch ─────────────────────────────────────────────────────── */
const contacts = await tool("search_contacts", { name: "kunde a" });
check("Namenssuche filtert lokal und sagt das", contacts.data?.anzahl === 1 && String(contacts.data?.gefiltert).includes("lokal"), contacts.text.slice(0, 200));
const byNumber = await tool("search_contacts", { customer_number: "10002" });
check("Die Kundennummer filtert sevdesk selbst", byNumber.data?.anzahl === 1 && byNumber.data.gefiltert === "von sevdesk");

const contact = await tool("get_contact", { contact_id: 1 });
check(
  "get_contact holt Adressen und Kontaktwege mit — die hängen nicht am Kontakt",
  contact.data?.adressen?.[0]?.ort === "Hamburg" && contact.data?.kontaktwege?.[0]?.wert === "a@kunde.de",
  contact.text.slice(0, 240),
);

const invoice = await tool("get_invoice", { invoice_id: 1 });
check("get_invoice liefert die Positionen mit Einheit", invoice.data?.positionen?.[0]?.einheit === "STÜCK", invoice.text.slice(0, 200));
check("… und übersetzt den Statuscode", String(invoice.data?.status).includes("bezahlt"));

const vouchers = await tool("search_vouchers", { credit_debit: "D" });
check("Eingangsbelege unterscheiden Einnahme und Ausgabe", vouchers.data?.belege?.[0]?.art === "Ausgabe", vouchers.text.slice(0, 200));
const voucher = await tool("get_voucher", { voucher_id: 30 });
check("get_voucher zeigt das Buchungskonto der Position", String(voucher.data?.positionen?.[0]?.konto).includes("3400"), voucher.text.slice(0, 200));

const orders = await tool("search_orders", {});
check("Aufträge werden nach Art benannt (AN = Angebot)", orders.data?.auftraege?.[0]?.art === "Angebot", orders.text.slice(0, 200));
const order = await tool("get_order", { order_id: 20 });
check("get_order liefert die Positionen", order.data?.positionen?.length === 1);

const parts = await tool("search_parts", { with_stock: true });
check("Artikel kommen mit Preis, Einheit und Bestand", parts.data?.artikel?.[0]?.lagerbestand === 40 && parts.data.artikel[0].einheit === "STÜCK", parts.text.slice(0, 220));

const accounts = await tool("check_accounts", { balance_date: "2026-06-30" });
check("Kontostand zum Stichtag wird geholt", accounts.data?.konten?.[0]?.saldo === 1234.56, accounts.text.slice(0, 200));
const noDate = await tool("check_accounts", {});
check("Ohne Stichtag kein zusätzlicher Saldo-Aufruf", noDate.data?.stichtag === null);

const guide = await tool("booking_accounts", { richtung: "ausgabe", suche: "3400" });
check(
  "booking_accounts nennt Konto, Steuerregel und erlaubte Sätze",
  guide.data?.konten?.[0]?.konto_id === 40 && guide.data.konten[0].steuerregeln[0].id === 9,
  guide.text.slice(0, 260),
);
const badDir = await tool("booking_accounts", { richtung: "seitwärts" });
check("Eine erfundene Richtung wird abgelehnt", badDir.isError === true);

/* ── Download ─────────────────────────────────────────────────────────────── */
const dl = await tool("download_document", { doc_type: "invoice", document_id: 1, minutes: 10 });
check("download_document liefert einen Link", typeof dl.data?.url === "string" && dl.data.url.includes("/f/"), dl.text.slice(0, 200));
const dlToken = dl.data?.url?.split("/f/")[1];
check("Der Link-Token steht nicht im Klartext in KV", dlToken && ![...env.OAUTH_KV.store.keys()].some((k) => k.includes(dlToken)));
const file = await call(`/f/${dlToken}`);
const pdf = await file.text();
check("Der Link liefert das PDF aus, aus base64 dekodiert", file.status === 200 && pdf.startsWith("%PDF"), `${file.status} ${pdf.slice(0, 20)}`);
check("Die Datei wird nicht zwischengespeichert", file.headers.get("cache-control")?.includes("no-store"));
const pdfCall = calls.filter((c) => c.path.endsWith("/getPdf")).at(-1);
check(
  "Der PDF-Abruf setzt preventSendBy — Lesen darf nichts als versendet markieren",
  pdfCall?.q.preventSendBy === "true",
  JSON.stringify(pdfCall?.q),
);
check("Ein erfundener Link läuft ins Leere", (await call("/f/smcp_dl_gibtesnicht")).status === 404);
const badDoc = await tool("download_document", { doc_type: "voucher", document_id: 30 });
check("Für Eingangsbelege gibt es kein PDF, und das wird gesagt", badDoc.isError === true, badDoc.text.slice(0, 140));

/* ── Anlegen ──────────────────────────────────────────────────────────────── */
const noName = await tool("create_contact", { kategorie: "kunde" });
check("Kontakt ohne Firma und ohne Nachname wird abgelehnt", noName.isError === true && noName.text.includes("firma"), noName.text.slice(0, 160));
const badCat = await tool("create_contact", { kategorie: "interessent", firma: "X" });
check("Eine erfundene Kategorie wird abgelehnt", badCat.isError === true);
const newContact = await tool("create_contact", { kategorie: "lieferant", firma: "Baustoff GmbH" });
check("Kontakt anlegen liefert id und Nummer", newContact.data?.id === "99" && newContact.data?.kategorie === "lieferant", newContact.text.slice(0, 180));
check(
  "… und schickt die Kategorie als Verweis mit id und objectName",
  JSON.parse(calls.filter((c) => c.path === "/Contact" && c.method === "POST").at(-1) ? "true" : "false"),
);

const badTax = await tool("create_part", { name: "X", artikelnummer: "A-1", steuersatz: 5 });
check("Ein Steuersatz, den sevdesk bei Artikeln nicht zulässt, wird abgefangen", badTax.isError === true && badTax.text.includes("0, 7 und 19"), badTax.text.slice(0, 160));
const part = await tool("create_part", { name: "Gerüstrohr", artikelnummer: "A-200", steuersatz: 19, preis_netto: 9.9 });
check("Artikel anlegen nimmt die gelernte Einheit", part.data?.id === "51" && part.data?.einheit_id === "1", part.text.slice(0, 200));

const invoiceOk = await tool("create_invoice", {
  kontakt_id: 1,
  positionen: [{ name: "Beratung", menge: 10, einzelpreis: 100, steuersatz: 19 }],
});
check("Rechnung entsteht als Entwurf", String(invoiceOk.data?.status).includes("Entwurf"), invoiceOk.text.slice(0, 220));
check("… mit Status 100 im Body", CREATED.invoiceBody?.invoice?.status === "100", JSON.stringify(CREATED.invoiceBody?.invoice?.status));
check(
  "… und taxRule statt taxType, weil das Konto auf 2.0 läuft",
  CREATED.invoiceBody?.invoice?.taxRule?.id === "1" && CREATED.invoiceBody?.invoice?.taxType === undefined,
  JSON.stringify({ taxRule: CREATED.invoiceBody?.invoice?.taxRule, taxType: CREATED.invoiceBody?.invoice?.taxType }),
);
check(
  "… und sagt, dass die Steuerregel nur die Voreinstellung war",
  String(invoiceOk.data?.steuerangabe).includes("Voreinstellung"),
  String(invoiceOk.data?.steuerangabe),
);
check("… und das Datum geht als Zeitstempel raus", typeof CREATED.invoiceBody?.invoice?.invoiceDate === "number");
check("… alle Positionen sind angekommen", invoiceOk.data?.positionen_gespeichert === 1 && !invoiceOk.data?.warnung);

const invoiceDropped = await tool("create_invoice", {
  kontakt_id: 1,
  positionen: [
    { name: "Beratung", menge: 10, einzelpreis: 100, steuersatz: 19 },
    { name: "Krumme Steuer", menge: 1, einzelpreis: 50, steuersatz: 13 },
  ],
});
check(
  "Eine still verworfene Position wird durch Zurücklesen sichtbar",
  invoiceDropped.data?.positionen_geschickt === 2 &&
    invoiceDropped.data?.positionen_gespeichert === 1 &&
    Boolean(invoiceDropped.data?.warnung),
  invoiceDropped.text.slice(0, 260),
);
const noPos = await tool("create_invoice", { kontakt_id: 1, positionen: [] });
check("Eine Rechnung ohne Positionen wird abgelehnt", noPos.isError === true);

const noKonto = await tool("create_voucher", {
  beschreibung: "ER-1", positionen: [{ netto: 100, steuersatz: 19 }],
});
check("Belegposition ohne Buchungskonto wird abgelehnt und auf booking_accounts verwiesen",
  noKonto.isError === true && noKonto.text.includes("booking_accounts"), noKonto.text.slice(0, 160));

const voucherNew = await tool("create_voucher", {
  beschreibung: "ER-4713",
  lieferant_name: "Baustoff GmbH",
  steuerregel_id: 9,
  positionen: [{ konto_id: 40, netto: 100, steuersatz: 19, kommentar: "Material" }],
});
check("Beleg entsteht als offen, nicht als bezahlt", voucherNew.data?.status === "offen (100)", voucherNew.text.slice(0, 220));
check(
  "… bucht auf accountDatev, weil das Konto auf 2.0 läuft",
  CREATED.voucherBody?.voucherPosSave?.[0]?.accountDatev?.id === "40" &&
    CREATED.voucherBody.voucherPosSave[0].accountingType === undefined,
  JSON.stringify(CREATED.voucherBody?.voucherPosSave?.[0]),
);
check(
  "… und rechnet den Bruttobetrag aus Netto und Steuersatz",
  CREATED.voucherBody?.voucherPosSave?.[0]?.sumGross === 119,
  JSON.stringify(CREATED.voucherBody?.voucherPosSave?.[0]?.sumGross),
);
const voucherDraft = await tool("create_voucher", {
  beschreibung: "ER-4714", entwurf: true,
  positionen: [{ konto_id: 40, netto: 50, steuersatz: 19 }],
});
check("entwurf=true legt mit Status 50 an", CREATED.voucherBody?.voucher?.status === 50 && String(voucherDraft.data?.status).includes("50"));

const badB64 = await tool("upload_voucher_file", { dateiname: "x.pdf", inhalt_base64: "!!!kein base64!!!" });
check("Ungültiges base64 wird abgefangen", badB64.isError === true, badB64.text.slice(0, 140));
const upload = await tool("upload_voucher_file", {
  dateiname: "rechnung.pdf",
  inhalt_base64: Buffer.from("%PDF-1.4 fake").toString("base64"),
});
check(
  "Upload liefert den Dateinamen und den nächsten Schritt",
  upload.data?.datei === "abc123.pdf" && String(upload.data?.naechster_schritt).includes("create_voucher"),
  upload.text.slice(0, 200),
);

/* ── Konto ohne Belege ────────────────────────────────────────────────────── */
const leer = await login(TOKEN_LEER);
const leerPart = await tool("create_part", { name: "X", artikelnummer: "A-9", steuersatz: 19 }, leer.access_token);
check(
  "In einem Konto ohne Belege wird keine ID erfunden, sondern erklärt, was fehlt",
  leerPart.isError === true && leerPart.text.includes("Einheit") && leerPart.text.includes("kein"),
  leerPart.text.slice(0, 220),
);
const leerInvoice = await tool("create_invoice", {
  kontakt_id: 1, positionen: [{ name: "X", menge: 1, einzelpreis: 1, steuersatz: 19 }],
}, leer.access_token);
check("Dasselbe beim Rechnungsentwurf", leerInvoice.isError === true && leerInvoice.text.includes("Kontaktperson"), leerInvoice.text.slice(0, 220));

/* ── Vollständigkeit ──────────────────────────────────────────────────────── */
const untested = names.filter((n) => !used.has(n));
check(
  "Jedes Tool ist mindestens einmal wirklich gelaufen",
  untested.length === 0,
  `nie aufgerufen: ${untested.join(", ")}`,
);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} bestanden · ${calls.length} sevdesk-Aufrufe`);
process.exit(failed.length ? 1 : 0);
