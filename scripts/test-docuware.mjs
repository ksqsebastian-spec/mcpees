#!/usr/bin/env node
/**
 * Prüft den DocuWare-Worker gegen eine DocuWare-Attrappe.
 *
 * Ohne echten Zugang lässt sich sonst kein einziges Tool ausführen. Geprüft wird das, was
 * falsch sein KANN, ohne dass es auffällt:
 *
 *  - Ein Anzeigename statt des Datenbanknamens im Suchfeld — DocuWare antwortet mit 400
 *    und sagt nicht, welcher Name es hätte sein sollen.
 *  - Klammern in einem Suchwert. Unmaskiert sind sie Syntax; die Trefferliste ist dann
 *    falsch und sieht vollkommen richtig aus.
 *  - Die Sortierung im Query-Parameter statt im Rumpf. Dort nimmt DocuWare nur das erste
 *    Feld und verwirft den Rest stillschweigend.
 *  - Ein Indexfeld, das der Ablagedialog nicht führt. DocuWare legt trotzdem ab und lässt
 *    das Feld leer — ohne Fehlermeldung.
 *  - `/Date(1700000000000)/` durchgereicht statt in ein Datum verwandelt.
 *  - Zugangsdaten oder Access-Token im Klartext in KV.
 *
 * Außerdem wird geprüft, dass JEDES Tool mindestens einmal wirklich läuft.
 *
 *   node scripts/test-docuware.mjs
 */
import { createHash, randomBytes } from "node:crypto";

const WORKER = new URL("../servers/docuware/dist/worker.js", import.meta.url);
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const URL_DW = "dw.test";
const IDENTITY = "https://login.test/org1";
const TOKEN_ENDPOINT = `${IDENTITY}/connect/token`;

const USER = "m.mustermann";
const PASSWORT = "geheim";
/** Zweiter Zugang: eine App-Registrierung. Client-IDs sind bei DocuWare GUIDs. */
const CLIENT_ID = "6f1d2c3b-4a59-4c8e-9b71-0e2f3a4b5c6d";
const CLIENT_SECRET = "s3cr3t-der-app";

const ACCESS_TOKEN = "dw-access-token-abcdef";
const ACCESS_TOKEN_APP = "dw-access-token-app-123456";

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

const dwDate = (iso) => `/Date(${Date.parse(`${iso}T00:00:00Z`)}+0100)/`;

const FELDER_SUCHE = [
  { DBFieldName: "BELEGNR", DlgLabel: "Belegnummer", DWFieldType: "Text", Length: 20 },
  { DBFieldName: "DOCDATE", DlgLabel: "Belegdatum", DWFieldType: "Date" },
  { DBFieldName: "BETRAG", DlgLabel: "Betrag", DWFieldType: "Numeric" },
  {
    DBFieldName: "DOCTYPE",
    DlgLabel: "Dokumentart",
    DWFieldType: "Text",
    Length: 40,
    Links: [
      { rel: "simpleSelectList", href: "/DocuWare/Platform/FileCabinets/FC1/Fields/DOCTYPE/List" },
    ],
  },
  { DBFieldName: "FIRMA", DlgLabel: "Firma", DWFieldType: "Text", Length: 60 },
  // Nur im Suchdialog, nicht im Ablagedialog: danach lässt sich filtern, füllen nicht.
  { DBFieldName: "DWSTOREDATETIME", DlgLabel: "Ablagedatum", DWFieldType: "DateTime" },
];

const FELDER_ABLAGE = FELDER_SUCHE.filter((f) => f.DBFieldName !== "DWSTOREDATETIME");

const feld = (name, art, wert) => ({ FieldName: name, ItemElementName: art, Item: wert });

const DOKUMENTE = [
  {
    Id: "1",
    Title: "Rechnung 4711",
    ContentType: "application/pdf",
    FileSize: 12_345,
    CreatedAt: dwDate("2026-02-03"),
    LastModified: dwDate("2026-02-04"),
    Fields: [
      feld("BELEGNR", "String", "4711"),
      feld("DOCDATE", "Date", dwDate("2026-02-01")),
      feld("BETRAG", "Decimal", 1190.5),
      feld("DOCTYPE", "String", "Rechnung (Eingang)"),
      feld("FIRMA", "String", "Müller GmbH"),
    ],
  },
  {
    Id: "2",
    Title: "Rechnung 4712",
    ContentType: "application/pdf",
    FileSize: 9_000,
    CreatedAt: dwDate("2026-02-10"),
    LastModified: dwDate("2026-02-10"),
    Fields: [
      feld("BELEGNR", "String", "4712"),
      feld("DOCDATE", "Date", dwDate("2026-02-09")),
      feld("BETRAG", "Decimal", 238),
      feld("DOCTYPE", "String", "Rechnung (Eingang)"),
      feld("FIRMA", "String", "Meier KG"),
    ],
  },
  {
    Id: "3",
    Title: "Lieferschein 88",
    ContentType: "application/pdf",
    FileSize: 4_200,
    CreatedAt: dwDate("2026-03-01"),
    LastModified: dwDate("2026-03-01"),
    Fields: [
      feld("BELEGNR", "String", "88"),
      // Kein Datum: DocuWare schreibt dafür /Date(0)/ und meint „leer".
      feld("DOCDATE", "Date", "/Date(0)/"),
      feld("BETRAG", "Decimal", null),
      feld("DOCTYPE", "String", "Lieferschein"),
      feld("FIRMA", "String", "Müller GmbH"),
    ],
  },
];

const ABSCHNITTE = {
  1: [
    {
      Id: "S1",
      ContentType: "application/pdf",
      OriginalFileName: "rechnung-4711.pdf",
      FileSize: 12_345,
      PageCount: 2,
      ContentModified: dwDate("2026-02-03"),
      HasTextAnnotation: false,
      Links: [{ rel: "self", href: "/DocuWare/Platform/FileCabinets/FC1/Sections/S1" }],
    },
    {
      Id: "S2",
      ContentType: "image/jpeg",
      OriginalFileName: "anlage.jpg",
      FileSize: 2_000,
      PageCount: 1,
      ContentModified: dwDate("2026-02-03"),
      Links: [{ rel: "self", href: "/DocuWare/Platform/FileCabinets/FC1/Sections/S2" }],
    },
  ],
  2: [],
  3: [],
};

/** Ein TextShot, so wie DocuWare ihn liefert: Seiten → Zonen → Zeilen → Wörter. */
const TEXTSHOT = {
  Pages: [
    {
      Items: [
        {
          $type: "TextZone",
          Ln: [
            { Items: [{ $type: "Word", Value: "Rechnung" }, { $type: "Word", Value: "4711" }] },
            { Items: [{ $type: "Word", Value: "Müller" }, { $type: "Word", Value: "GmbH" }] },
          ],
        },
        {
          $type: "TableZone",
          Cz: [{ TextZone: { Ln: [{ Items: [{ $type: "Word", Value: "Summe" }, { $type: "Word", Value: "1190,50" }] }] } }],
        },
      ],
    },
  ],
};

const PDF_BYTES = Buffer.from("%PDF-1.4 attrappe");

/* ── Attrappe ─────────────────────────────────────────────────────────────── */

const realFetch = globalThis.fetch;
const calls = [];
/** Anzahl der Anhänge je Dokument — der Upload verändert sie, damit das Nachzählen greift. */
const angehaengt = { 1: 0 };
let neueDokumentId = 100;
const angelegt = new Map();

globalThis.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  if (!raw.includes("dw.test") && !raw.includes("login.test")) return realFetch(input, init);

  const url = new URL(raw);
  const path = url.pathname;
  const q = Object.fromEntries(url.searchParams);
  const method = init.method ?? "GET";
  const auth = init.headers?.Authorization ?? "";
  calls.push({ method, host: url.host, path, q, auth, body: init.body });

  const res = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  const body = () => {
    if (typeof init.body === "string" && init.body.startsWith("{")) return JSON.parse(init.body);
    return {};
  };

  /* --- Identity Service --------------------------------------------------- */
  if (path === "/DocuWare/Platform/Home/IdentityServiceInfo") {
    return res({ IdentityServiceUrl: IDENTITY });
  }
  if (url.host === "login.test" && path.endsWith("/.well-known/openid-configuration")) {
    return res({ issuer: IDENTITY, token_endpoint: TOKEN_ENDPOINT });
  }
  if (raw === TOKEN_ENDPOINT && method === "POST") {
    const form = new URLSearchParams(String(init.body));
    const grant = form.get("grant_type");
    if (
      grant === "password" &&
      form.get("username") === USER &&
      form.get("password") === PASSWORT &&
      form.get("client_id") === "docuware.platform.net.client" &&
      form.get("scope") === "docuware.platform"
    ) {
      return res({ access_token: ACCESS_TOKEN, token_type: "Bearer", expires_in: 3600 });
    }
    if (
      grant === "client_credentials" &&
      form.get("client_id") === CLIENT_ID &&
      form.get("client_secret") === CLIENT_SECRET
    ) {
      return res({ access_token: ACCESS_TOKEN_APP, token_type: "Bearer", expires_in: 3600 });
    }
    return res({ error: "invalid_grant" }, 400);
  }

  /* --- Ab hier: alles braucht ein Bearer-Token ---------------------------- */
  const gueltig = auth === `Bearer ${ACCESS_TOKEN}` || auth === `Bearer ${ACCESS_TOKEN_APP}`;
  if (!gueltig) return res({ Message: "Not authenticated" }, 401);

  if (path === "/DocuWare/Platform") {
    return res({
      Version: "7.12",
      Links: [{ rel: "organizations", href: "/DocuWare/Platform/Organizations" }],
    });
  }

  if (path === "/DocuWare/Platform/Organizations") {
    return res({
      Organization: [
        {
          Id: "1",
          Name: "Musterfirma GmbH",
          Links: [
            { rel: "self", href: "/DocuWare/Platform/Organizations/1" },
            { rel: "fileCabinets", href: "/DocuWare/Platform/FileCabinets?orgId=1" },
          ],
        },
      ],
    });
  }

  if (path === "/DocuWare/Platform/FileCabinets" && !q.dialog) {
    return res({
      FileCabinet: [
        {
          Id: "FC1",
          Name: "Eingangsrechnungen",
          IsBasket: false,
          Links: [
            { rel: "documents", href: "/DocuWare/Platform/FileCabinets/FC1/Documents" },
            { rel: "dialogs", href: "/DocuWare/Platform/FileCabinets/FC1/Dialogs" },
          ],
        },
        {
          Id: "BK1",
          Name: "Posteingang",
          IsBasket: true,
          Links: [{ rel: "documents", href: "/DocuWare/Platform/FileCabinets/BK1/Documents" }],
        },
      ],
    });
  }

  if (path === "/DocuWare/Platform/FileCabinets/FC1/Dialogs") {
    return res({
      Dialog: [
        {
          $type: "DialogInfo",
          Id: "S1",
          Type: "Search",
          IsDefault: true,
          DisplayName: "Standardsuche",
          Links: [{ rel: "self", href: "/DocuWare/Platform/FileCabinets/FC1/Query/Dialogs/S1" }],
        },
        {
          // Systemeigene Kopie für die mobile Ansicht — Unterstrich in der Id.
          $type: "DialogInfo",
          Id: "S1_mobile",
          Type: "Search",
          IsDefault: true,
          DisplayName: "Standardsuche (mobil)",
          Links: [
            { rel: "self", href: "/DocuWare/Platform/FileCabinets/FC1/Query/Dialogs/S1_mobile" },
          ],
        },
        { $type: "DialogInfoBase", Id: "X1", Type: "Search", DisplayName: "keine echte" },
        {
          $type: "DialogInfo",
          Id: "ST1",
          Type: "Store",
          DisplayName: "Ablage",
          Links: [{ rel: "self", href: "/DocuWare/Platform/FileCabinets/FC1/Store/Dialogs/ST1" }],
        },
      ],
    });
  }

  if (path === "/DocuWare/Platform/FileCabinets/FC1/Query/Dialogs/S1") {
    return res({
      Id: "S1",
      DisplayName: "Standardsuche",
      Fields: FELDER_SUCHE,
      Query: {
        Links: [
          {
            rel: "dialogExpression",
            href: "/DocuWare/Platform/FileCabinets/FC1/Query/DialogExpression?dialogId=S1",
          },
        ],
      },
    });
  }
  if (path === "/DocuWare/Platform/FileCabinets/FC1/Query/Dialogs/S1_mobile") {
    return res({ Message: "Der mobile Dialog wurde benutzt." }, 400);
  }
  if (path === "/DocuWare/Platform/FileCabinets/FC1/Store/Dialogs/ST1") {
    return res({ Id: "ST1", DisplayName: "Ablage", Fields: FELDER_ABLAGE });
  }

  if (path === "/DocuWare/Platform/FileCabinets/FC1/Fields/DOCTYPE/List") {
    return res({ Value: ["Rechnung (Eingang)", "Lieferschein", "Mahnung"] });
  }

  /* --- Suche -------------------------------------------------------------- */
  if (path === "/DocuWare/Platform/FileCabinets/FC1/Query/DialogExpression" && method === "POST") {
    // Erste Seite: zwei Treffer und ein Verweis auf die nächste.
    return res({
      Count: { Value: DOKUMENTE.length },
      Items: DOKUMENTE.slice(0, 2).map(trefferZeile),
      Links: [
        {
          rel: "next",
          href: "/DocuWare/Platform/FileCabinets/FC1/Query/DialogExpression/Page2",
        },
      ],
    });
  }
  if (path === "/DocuWare/Platform/FileCabinets/FC1/Query/DialogExpression/Page2") {
    return res({ Count: { Value: DOKUMENTE.length }, Items: DOKUMENTE.slice(2).map(trefferZeile) });
  }

  /* --- Dokumente ---------------------------------------------------------- */
  const docMatch = /^\/DocuWare\/Platform\/FileCabinets\/FC1\/Documents\/(\w+)$/.exec(path);
  if (docMatch && method === "GET") {
    const id = docMatch[1];
    const doc = DOKUMENTE.find((d) => d.Id === id) ?? angelegt.get(id);
    if (!doc) return res({ Message: `Document ${id} not found` }, 404);
    const zusatz = (ABSCHNITTE[id] ?? []).slice(0, (ABSCHNITTE[id] ?? []).length);
    const extra = Array.from({ length: angehaengt[id] ?? 0 }, (_, i) => ({
      Id: `NEU${i + 1}`,
      ContentType: "application/pdf",
      OriginalFileName: "nachgereicht.pdf",
      FileSize: 10,
      Links: [{ rel: "self", href: `/DocuWare/Platform/FileCabinets/FC1/Sections/NEU${i + 1}` }],
    }));
    return res({
      ...doc,
      Sections: [...zusatz, ...extra],
      Links: [
        { rel: "self", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${id}` },
        { rel: "fileDownload", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${id}/FileDownload` },
        { rel: "sections", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${id}/Sections` },
      ],
    });
  }

  if (path === "/DocuWare/Platform/FileCabinets/FC1/Documents" && method === "POST") {
    const id = String(++neueDokumentId);
    const gesendet = body().Fields ?? [];
    // DocuWare verwirft, was der Ablagedialog nicht kennt — hier BETRAG mit falschem Typ.
    /*
     * DocuWare antwortet mit der Typkennung des FELDES, nicht mit der, unter der
     * geschrieben wurde: ein Datumsfeld meldet 'Date' zurück, auch wenn beim Ablegen
     * 'DateTime' geschickt wurde.
     */
    const uebernommen = gesendet.map((f) => {
      const def = FELDER_ABLAGE.find((d) => d.DBFieldName === f.FieldName);
      const art = def?.DWFieldType === "Date" ? "Date" : def?.DWFieldType === "Numeric" ? "Decimal" : "String";
      return {
        FieldName: f.FieldName,
        ItemElementName: art,
        Item: art === "Date" ? dwDate(String(f.Item).slice(0, 10)) : f.Item,
      };
    });
    const doc = {
      Id: id,
      Title: "Neu abgelegt",
      ContentType: "application/pdf",
      CreatedAt: dwDate("2026-09-10"),
      Fields: uebernommen,
    };
    angelegt.set(id, doc);
    angehaengt[id] = 0;
    ABSCHNITTE[id] = [];
    return res(
      {
        ...doc,
        Links: [
          { rel: "self", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${id}` },
          { rel: "sections", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${id}/Sections` },
        ],
      },
      201,
    );
  }

  const sectionPost = /^\/DocuWare\/Platform\/FileCabinets\/FC1\/Documents\/(\w+)\/Sections$/.exec(path);
  if (sectionPost && method === "POST") {
    const id = sectionPost[1];
    angehaengt[id] = (angehaengt[id] ?? 0) + 1;
    return res(
      {
        Id: `NEU${angehaengt[id]}`,
        ContentType: "application/pdf",
        OriginalFileName: "nachgereicht.pdf",
        FileSize: 10,
      },
      201,
    );
  }

  const sectionSelf = /^\/DocuWare\/Platform\/FileCabinets\/FC1\/Sections\/(\w+)$/.exec(path);
  if (sectionSelf && method === "GET") {
    const id = sectionSelf[1];
    const linksOf = [
      { rel: "self", href: path },
      { rel: "fileDownload", href: `${path}/Data` },
    ];
    // Nur der erste Anhang ist volltextindiziert — der zweite hat keinen textshot.
    if (id === "S1") linksOf.push({ rel: "textshot", href: `${path}/Textshot` });
    return res({ Id: id, Links: linksOf });
  }

  if (/\/Sections\/\w+\/Textshot$/.test(path)) return res(TEXTSHOT);

  if (/\/FileDownload$/.test(path) || /\/Sections\/\w+\/Data$/.test(path)) {
    return new Response(PDF_BYTES, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="rechnung-4711.pdf"',
      },
    });
  }

  return res({ Message: `unhandled ${method} ${path}` }, 404);
};

function trefferZeile(doc) {
  return {
    Id: doc.Id,
    Title: doc.Title,
    ContentType: doc.ContentType,
    FileCabinetId: "FC1",
    Fields: doc.Fields,
    Links: [{ rel: "self", href: `/DocuWare/Platform/FileCabinets/FC1/Documents/${doc.Id}` }],
  };
}

/* ── Aufbau ───────────────────────────────────────────────────────────────── */
const mod = await import(WORKER);
const env = { OAUTH_KV: new MemoryKV(), HUB_URL: "https://hub.test" };
const call = (path, init) => mod.default.fetch(new Request("https://dwmcp.test" + path, init), env);

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

async function login(url, username, password) {
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
    body: new URLSearchParams({ ...form, url, username, password }).toString(),
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
  return { access_token: tok.access_token, client_id: reg.client_id };
}

/* ── Anmeldung ────────────────────────────────────────────────────────────── */
const falsch = await login(URL_DW, USER, "falsches-passwort");
check(
  "Ein falsches Passwort wird abgewiesen, bevor ein Token entsteht",
  !falsch.access_token && String(falsch.error).includes("lehnt die Zugangsdaten ab"),
  String(falsch.error).slice(0, 200),
);
check(
  "Die Absage nennt beide Anmeldearten, nicht nur eine",
  String(falsch.error).includes("Client-ID"),
  String(falsch.error).slice(0, 200),
);

const httpVersuch = await login("http://dw.test", USER, PASSWORT);
check(
  "Eine http-URL wird abgelehnt, statt Zugangsdaten ungesichert zu verschicken",
  !httpVersuch.access_token && String(httpVersuch.error).includes("https"),
  String(httpVersuch.error).slice(0, 160),
);

const vorLogin = calls.length;
const session = await login(URL_DW, USER, PASSWORT);
check("Code-Tausch liefert ein Token", Boolean(session.access_token));

const passwortGrant = calls
  .slice(vorLogin)
  .find((c) => c.path.endsWith("/connect/token"));
check(
  "Für einen normalen Benutzernamen wird der Passwort-Grant genommen",
  new URLSearchParams(String(passwortGrant?.body)).get("grant_type") === "password",
  String(passwortGrant?.body).slice(0, 120),
);

const dump = [...env.OAUTH_KV.store.values()].map((e) => e.value).join("|");
check("Das DocuWare-Passwort steht nicht im Klartext in KV", !dump.includes(PASSWORT));
check("Auch das Access-Token von DocuWare steht nicht im Klartext in KV", !dump.includes(ACCESS_TOKEN));

const app = await login(URL_DW, CLIENT_ID, CLIENT_SECRET);
check("Eine App-Registrierung kann sich ebenso anmelden", Boolean(app.access_token));
const appGrant = [...calls].reverse().find((c) => c.path.endsWith("/connect/token"));
check(
  "Bei einer GUID als Benutzername wird direkt client_credentials genommen",
  new URLSearchParams(String(appGrant?.body)).get("grant_type") === "client_credentials",
  String(appGrant?.body).slice(0, 120),
);

/* Ab hier laufen nur noch Tool-Aufrufe. Was an Anmeldungen jetzt noch passiert, gehört
   dem Zwischenspeicher — und der soll genau eine zulassen. */
const tokenVorTools = calls.filter((c) => c.path.endsWith("/connect/token")).length;
const oidcVorTools = calls.filter((c) => c.path.includes("openid-configuration")).length;

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

/* ── Katalog ──────────────────────────────────────────────────────────────── */
const list = await (
  await call("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
  })
).json();
const names = (list.result?.tools ?? []).map((t) => t.name);
check("tools/list liefert 10 Tools", names.length === 10, String(names.length));
check(
  "Die lesenden Tools sind als lesend gekennzeichnet",
  (list.result?.tools ?? [])
    .filter((t) => t.name.startsWith("get_") || t.name.includes("search") || t.name === "system_info")
    .every((t) => t.annotations?.readOnlyHint === true),
);
check(
  "Es gibt kein Tool, das ändert oder löscht",
  !names.some((n) => /update|delete|edit|remove/i.test(n)),
  names.join(", "),
);

/* ── Struktur ─────────────────────────────────────────────────────────────── */
const info = await tool("system_info");
check(
  "system_info nennt Version, Organisation und Anmeldeart",
  info.data?.docuware_version === "7.12" &&
    info.data?.organisation === "Musterfirma GmbH" &&
    info.data?.anmeldeart.includes("Benutzerkonto"),
  info.text.slice(0, 220),
);

const vorZweitem = calls.filter((c) => c.path === "/DocuWare/Platform/Organizations").length;
const cabs = await tool("file_cabinets");
const nachZweitem = calls.filter((c) => c.path === "/DocuWare/Platform/Organizations").length;
check(
  "Die Struktur wird zwischengespeichert, nicht bei jedem Aufruf neu gelaufen",
  vorZweitem === nachZweitem,
  `${vorZweitem} -> ${nachZweitem}`,
);
check(
  "Aktenschrank und Briefkorb werden auseinandergehalten",
  cabs.data?.schraenke?.find((s) => s.name === "Eingangsrechnungen")?.art === "Aktenschrank" &&
    cabs.data?.schraenke?.find((s) => s.name === "Posteingang")?.art === "Briefkorb",
  cabs.text.slice(0, 200),
);
const ohneKoerbe = await tool("file_cabinets", { mit_briefkoerben: false });
check(
  "Briefkörbe lassen sich ausblenden",
  ohneKoerbe.data?.schraenke?.length === 1,
  ohneKoerbe.text.slice(0, 160),
);

const unbekannterSchrank = await tool("index_fields", { aktenschrank: "Gibtsnicht" });
check(
  "Ein unbekannter Aktenschrank wird mit der vorhandenen Auswahl beantwortet",
  unbekannterSchrank.isError === true && unbekannterSchrank.text.includes("Eingangsrechnungen"),
  unbekannterSchrank.text.slice(0, 200),
);

const felder = await tool("index_fields", { aktenschrank: "eingangsrechnungen" });
check(
  "Der Aktenschrank wird auch ohne genaue Schreibweise gefunden",
  felder.data?.aktenschrank === "Eingangsrechnungen",
  felder.text.slice(0, 160),
);
check(
  "index_fields nennt API-Namen und Bezeichnung nebeneinander",
  felder.data?.felder?.some((f) => f.feld === "DOCDATE" && f.bezeichnung === "Belegdatum"),
  felder.text.slice(0, 240),
);
check(
  "Ein Feld, das nur im Suchdialog steht, ist als solches gekennzeichnet",
  felder.data?.felder?.find((f) => f.feld === "DWSTOREDATETIME")?.in?.join() === "suche" &&
    felder.data?.felder?.find((f) => f.feld === "BELEGNR")?.in?.length === 2,
  JSON.stringify(felder.data?.felder?.find((f) => f.feld === "DWSTOREDATETIME")),
);
check(
  "Die mobile Kopie des Suchdialogs wird übersprungen",
  felder.data?.suchdialog === "Standardsuche" &&
    !calls.some((c) => c.path.includes("S1_mobile")),
  felder.data?.suchdialog,
);

const werte = await tool("field_values", { aktenschrank: "FC1", feld: "Dokumentart" });
check(
  "field_values liefert die Auswahlliste, auch wenn die Bezeichnung angegeben wird",
  werte.data?.werte?.includes("Lieferschein") && werte.data?.feld === "DOCTYPE",
  werte.text.slice(0, 200),
);
const ohneListe = await tool("field_values", { aktenschrank: "FC1", feld: "BELEGNR" });
check(
  "Ein Feld ohne Auswahlliste sagt das, statt eine leere Liste zu liefern",
  ohneListe.isError === true && ohneListe.text.includes("keine Auswahlliste"),
  ohneListe.text.slice(0, 160),
);

/* ── Suche ────────────────────────────────────────────────────────────────── */
const vorSuche = calls.length;
const suche = await tool("search_documents", {
  aktenschrank: "Eingangsrechnungen",
  bedingungen: { Belegdatum: ["2026-01-01", "2026-03-31"], Dokumentart: "Rechnung (Eingang)" },
  sortierung: ["Belegdatum:desc", "BELEGNR"],
  limit: 25,
});
const suchAufruf = calls.slice(vorSuche).find((c) => c.method === "POST" && c.path.includes("DialogExpression"));
const gesendet = JSON.parse(String(suchAufruf?.body));

check(
  "Bezeichnungen werden vor dem Absenden in Datenbanknamen übersetzt",
  gesendet.Condition.some((c) => c.DBName === "DOCDATE") &&
    gesendet.Condition.some((c) => c.DBName === "DOCTYPE"),
  JSON.stringify(gesendet.Condition),
);
check(
  "Klammern im Suchwert werden maskiert",
  gesendet.Condition.find((c) => c.DBName === "DOCTYPE").Value[0] === "Rechnung \\(Eingang\\)",
  JSON.stringify(gesendet.Condition.find((c) => c.DBName === "DOCTYPE")),
);
check(
  "Ein Zeitraum wird als Wertepaar geschickt",
  gesendet.Condition.find((c) => c.DBName === "DOCDATE").Value.length === 2,
  JSON.stringify(gesendet.Condition.find((c) => c.DBName === "DOCDATE")),
);
check(
  "Die Sortierung steht im Rumpf und nicht im Query-Parameter",
  gesendet.SortOrder?.length === 2 &&
    gesendet.SortOrder[0].Direction === "Desc" &&
    !("sortOrder" in (suchAufruf?.q ?? {})),
  JSON.stringify(gesendet.SortOrder),
);
check(
  "Ohne Angabe werden alle Felder des Suchdialogs angefordert",
  String(suchAufruf?.q?.fields ?? "").includes("BELEGNR") &&
    String(suchAufruf?.q?.fields ?? "").includes("FIRMA"),
  String(suchAufruf?.q?.fields),
);
check(
  "Die Suche läuft über die Folgeseite und liefert alle Treffer",
  suche.data?.geliefert === 3 && suche.data?.gefunden === 3 && suche.data?.abgeschnitten === false,
  suche.text.slice(0, 200),
);
check(
  "Datumswerte kommen als Datum zurück, nicht als /Date(…)/",
  suche.data?.treffer?.[0]?.felder?.DOCDATE === "2026-02-01",
  JSON.stringify(suche.data?.treffer?.[0]?.felder),
);
check(
  "/Date(0)/ heißt „kein Datum“ und wird nicht zum 1.1.1970",
  suche.data?.treffer?.[2]?.felder?.DOCDATE === null,
  JSON.stringify(suche.data?.treffer?.[2]?.felder),
);

const gekappt = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { FIRMA: "Müller*" },
  limit: 2,
});
check(
  "Eine gekappte Trefferliste sagt, dass sie gekappt ist",
  gekappt.data?.geliefert === 2 && gekappt.data?.abgeschnitten === true,
  gekappt.text.slice(0, 160),
);

const nurFelder = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { BELEGNR: "4711" },
  felder: ["Firma"],
  limit: 1,
});
const nurFelderAufruf = [...calls].reverse().find((c) => c.method === "POST" && c.path.includes("DialogExpression"));
check(
  "Angeforderte Felder werden übersetzt und um die Bedingungsfelder ergänzt",
  String(nurFelderAufruf?.q?.fields).split(",").sort().join(",") === "BELEGNR,FIRMA",
  String(nurFelderAufruf?.q?.fields),
);
check(
  "Auch mit eingeschränkten Feldern kommen Treffer",
  nurFelder.data?.geliefert === 1,
  nurFelder.text.slice(0, 120),
);

const vorFehler = calls.length;
const falschesFeld = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { Rechnungsnummer: "4711" },
});
check(
  "Ein unbekanntes Feld fliegt hier auf, nicht erst bei DocuWare",
  falschesFeld.isError === true &&
    falschesFeld.text.includes("BELEGNR") &&
    calls.length === vorFehler,
  falschesFeld.text.slice(0, 200),
);

const falschesDatum = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { DOCDATE: "01.02.2026" },
});
check(
  "Ein Datum in deutscher Schreibweise wird abgewiesen statt durchgereicht",
  falschesDatum.isError === true && falschesDatum.text.includes("YYYY-MM-DD"),
  falschesDatum.text.slice(0, 200),
);

const falscheVerknuepfung = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { BELEGNR: "4711" },
  verknuepfung: "vielleicht",
});
check(
  "Eine unbekannte Verknüpfung wird abgewiesen",
  falscheVerknuepfung.isError === true && falscheVerknuepfung.text.includes("und, oder"),
  falscheVerknuepfung.text.slice(0, 160),
);

const oderSuche = await tool("search_documents", {
  aktenschrank: "FC1",
  bedingungen: { BELEGNR: "4711", FIRMA: "Meier KG" },
  verknuepfung: "oder",
  limit: 3,
});
const oderAufruf = [...calls].reverse().find((c) => c.method === "POST" && c.path.includes("DialogExpression"));
check(
  "'oder' wird als Or geschickt",
  JSON.parse(String(oderAufruf?.body)).Operation === "Or" && !oderSuche.isError,
  String(oderAufruf?.body).slice(0, 120),
);

const briefkorbSuche = await tool("search_documents", { aktenschrank: "Posteingang" });
check(
  "Ein Briefkorb ohne Suchdialog erklärt das, statt einen Pfad zu raten",
  briefkorbSuche.isError === true && briefkorbSuche.text.includes("Suchdialog"),
  briefkorbSuche.text.slice(0, 200),
);

/* ── Dokument, Volltext, Download ─────────────────────────────────────────── */
const doc = await tool("get_document", { aktenschrank: "FC1", dokument_id: "1" });
check(
  "get_document liefert Felder und Anhänge",
  doc.data?.anhaenge?.length === 2 &&
    doc.data?.felder?.BELEGNR === "4711" &&
    doc.data?.angelegt === "2026-02-03 00:00:00",
  doc.text.slice(0, 240),
);

const fehlend = await tool("get_document", { aktenschrank: "FC1", dokument_id: "999" });
check(
  "Ein Dokument, das es nicht gibt, wird als 404 erklärt",
  fehlend.isError === true && fehlend.text.includes("404"),
  fehlend.text.slice(0, 160),
);

const text = await tool("document_text", { aktenschrank: "FC1", dokument_id: "1" });
check(
  "Der Volltext wird aus Wörtern, Zeilen und Zonen zusammengesetzt",
  text.data?.anhaenge?.[0]?.text === "Rechnung 4711\nMüller GmbH\nSumme 1190,50",
  JSON.stringify(text.data?.anhaenge?.[0]?.text),
);
check(
  "Ein Anhang ohne Volltextindex sagt das, statt einen Fehler zu werfen",
  text.data?.anhaenge?.[1]?.text === null && text.data?.anhaenge?.[1]?.hinweis?.includes("volltextindiziert"),
  JSON.stringify(text.data?.anhaenge?.[1]),
);
const gekuerzt = await tool("document_text", {
  aktenschrank: "FC1",
  dokument_id: "1",
  anhang_id: "S1",
  max_zeichen: 500,
});
check(
  "Ein einzelner Anhang lässt sich gezielt lesen",
  gekuerzt.data?.anhaenge?.length === 1 && gekuerzt.data?.anhaenge?.[0]?.anhang_id === "S1",
  gekuerzt.text.slice(0, 160),
);
const falscherAnhang = await tool("document_text", {
  aktenschrank: "FC1",
  dokument_id: "1",
  anhang_id: "S9",
});
check(
  "Ein Anhang, den es nicht gibt, wird mit den vorhandenen beantwortet",
  falscherAnhang.isError === true && falscherAnhang.text.includes("S1"),
  falscherAnhang.text.slice(0, 160),
);

const dl = await tool("download_link", { aktenschrank: "FC1", dokument_id: "1" });
check("download_link liefert einen Link auf Zeit", /\/f\/dwmcp_dl_/.test(dl.data?.link ?? ""), dl.text.slice(0, 200));

const linkKv = [...env.OAUTH_KV.store.entries()].filter(([k]) => k.startsWith("dl:"));
check(
  "Im Link-Eintrag stehen die Zugangsdaten nur verschlüsselt",
  linkKv.length > 0 && !linkKv.map(([, v]) => v.value).join("|").includes(PASSWORT),
);

const datei = await call(new URL(dl.data.link).pathname);
check(
  "Der Link liefert die Datei mit Typ und Dateinamen aus",
  datei.status === 200 &&
    datei.headers.get("content-type") === "application/pdf" &&
    datei.headers.get("content-disposition").includes("rechnung-4711.pdf"),
  `${datei.status} ${datei.headers.get("content-disposition")}`,
);
check(
  "Der Download-Link wird nirgends zwischengespeichert",
  datei.headers.get("cache-control") === "private, no-store",
  datei.headers.get("cache-control"),
);
const dlCall = [...calls].reverse().find((c) => /FileDownload/.test(c.path));
check(
  "Anmerkungen werden mit angefordert und dafür nach PDF gewandelt",
  dlCall?.q?.keepAnnotations === "true" && dlCall?.q?.targetFileType === "PDF",
  JSON.stringify(dlCall?.q),
);

const dlAnhang = await tool("download_link", {
  aktenschrank: "FC1",
  dokument_id: "1",
  anhang_id: "S2",
  mit_anmerkungen: false,
});
check(
  "Auch ein einzelner Anhang bekommt einen Link",
  dlAnhang.data?.dateiname === "anlage.jpg" && dlAnhang.data?.mit_anmerkungen === false,
  dlAnhang.text.slice(0, 200),
);
const kaputt = await call("/f/dwmcp_dl_gibtsnicht");
check("Ein unbekannter Link endet in 404, nicht in einem Fehler", kaputt.status === 404);

/* ── Ablegen ──────────────────────────────────────────────────────────────── */
const vorAblage = calls.length;
const nurSuchfeld = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { Ablagedatum: "2026-09-10" },
});
check(
  "Ein Feld, das der Ablagedialog nicht führt, wird abgewiesen, bevor abgelegt wird",
  nurSuchfeld.isError === true &&
    nurSuchfeld.text.includes("verfallen") &&
    calls.length === vorAblage,
  nurSuchfeld.text.slice(0, 220),
);

const ohneFelder = await tool("store_document", { aktenschrank: "FC1", felder: {} });
check(
  "Ohne Indexfelder wird nichts abgelegt",
  ohneFelder.isError === true && ohneFelder.text.includes("wiederfinden"),
  ohneFelder.text.slice(0, 160),
);

const textZuLang = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { BELEGNR: "x".repeat(30) },
});
check(
  "Ein zu langer Wert wird abgewiesen, statt von DocuWare abgeschnitten zu werden",
  textZuLang.isError === true && textZuLang.text.includes("20 Zeichen"),
  textZuLang.text.slice(0, 200),
);

const zahlAlsText = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { Betrag: "ungefähr hundert" },
});
check(
  "Text in ein Zahlenfeld fliegt vor dem Absenden auf",
  zahlAlsText.isError === true && zahlAlsText.text.includes("Zahlenfeld"),
  zahlAlsText.text.slice(0, 200),
);

const abgelegt = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { Belegnummer: "5000", Belegdatum: "2026-09-01", Betrag: 119.9, DOCTYPE: "Rechnung (Eingang)" },
});
const ablageAufruf = calls.find(
  (c) => c.method === "POST" && c.path === "/DocuWare/Platform/FileCabinets/FC1/Documents",
);
const ablageFelder = JSON.parse(String(ablageAufruf?.body)).Fields;
check(
  "Beim Ablegen wird jedes Feld mit Name, Wert und Typkennung geschickt",
  ablageFelder.every((f) => f.FieldName && "Item" in f && f.ItemElementName),
  JSON.stringify(ablageFelder),
);
check(
  "Ein Datumsfeld bekommt die Kennung DateTime, ein Betrag Decimal",
  ablageFelder.find((f) => f.FieldName === "DOCDATE").ItemElementName === "DateTime" &&
    ablageFelder.find((f) => f.FieldName === "BETRAG").ItemElementName === "Decimal",
  JSON.stringify(ablageFelder),
);
check(
  "Nach dem Ablegen wird zurückgelesen und der Stand aus dem Schrank gemeldet",
  abgelegt.data?.angelegt === true &&
    abgelegt.data?.felder?.BELEGNR === "5000" &&
    abgelegt.data?.felder?.DOCDATE === "2026-09-01",
  abgelegt.text.slice(0, 260),
);
check(
  "Ohne Datei wird gesagt, dass bisher nur der Datensatz da ist",
  String(abgelegt.data?.hinweis ?? "").includes("nur der Datensatz"),
  abgelegt.text.slice(0, 200),
);

const neueId = abgelegt.data.dokument_id;

const mitDatei = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { BELEGNR: "5001" },
  dateiname: "beleg.pdf",
  inhalt_base64: Buffer.from("%PDF-1.4 test").toString("base64"),
});
check(
  "Ablegen mit Datei hängt sie in einem Aufwasch an",
  mitDatei.data?.anhang?.dateiname === "nachgereicht.pdf" && !mitDatei.isError,
  mitDatei.text.slice(0, 220),
);

const kaputtesBase64 = await tool("store_document", {
  aktenschrank: "FC1",
  felder: { BELEGNR: "5002" },
  dateiname: "x.pdf",
  inhalt_base64: "!!! kein base64 !!!",
});
check(
  "Ungültiges base64 wird als solches benannt",
  kaputtesBase64.isError === true && kaputtesBase64.text.includes("base64"),
  kaputtesBase64.text.slice(0, 160),
);

const anhang = await tool("attach_file", {
  aktenschrank: "FC1",
  dokument_id: neueId,
  dateiname: "lieferschein.pdf",
  inhalt_base64: Buffer.from("%PDF-1.4 zwei").toString("base64"),
});
check(
  "attach_file zählt die Anhänge vorher und nachher nach",
  anhang.data?.angehaengt === true &&
    anhang.data?.anhaenge_vorher === 0 &&
    anhang.data?.anhaenge_jetzt === 1,
  anhang.text.slice(0, 220),
);

/* ── Token, Zwischenspeicher, Wiederanmeldung ─────────────────────────────── */
const tokenInTools = calls.filter((c) => c.path.endsWith("/connect/token")).length - tokenVorTools;
check(
  "Über alle Tool-Aufrufe hinweg wird genau einmal ein Token geholt",
  tokenInTools === 1,
  `${tokenInTools} Token-Anfragen bei ${calls.length} Aufrufen`,
);
const oidcInTools = calls.filter((c) => c.path.includes("openid-configuration")).length - oidcVorTools;
check(
  "Auch die Discovery läuft über alle Tool-Aufrufe hinweg genau einmal",
  oidcInTools === 1,
  String(oidcInTools),
);

/* Das Token in KV verfälschen: DocuWare antwortet dann mit 401, der Client muss sich
   einmal neu anmelden und denselben Aufruf wiederholen. */
for (const [k, v] of env.OAUTH_KV.store) {
  if (k.startsWith("dw:tok:")) env.OAUTH_KV.store.set(k, { ...v, value: "kaputt.kaputt" });
}
const nachAblauf = await tool("system_info");
check(
  "Ein abgelaufenes Token führt zu genau einer stillen Wiederanmeldung",
  nachAblauf.data?.organisation === "Musterfirma GmbH",
  nachAblauf.text.slice(0, 160),
);

/* ── Vollständigkeit ──────────────────────────────────────────────────────── */
const untested = names.filter((n) => !used.has(n));
check(
  "Jedes Tool ist mindestens einmal wirklich gelaufen",
  untested.length === 0,
  `nie aufgerufen: ${untested.join(", ")}`,
);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} bestanden · ${calls.length} DocuWare-Aufrufe`);
process.exit(failed.length ? 1 : 0);
