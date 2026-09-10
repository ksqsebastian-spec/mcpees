/**
 * Client für die DocuWare Platform API.
 *
 * Die Erkenntnisse über diese API stammen aus dem Quelltext von
 * sniner/docuware-client (BSD-3-Clause, © Stefan Schönberger) — einer gepflegten
 * Python-Bibliothek samt CLI. Deren Code ist die Beschreibung, die DocuWare selbst nicht
 * veröffentlicht: die offizielle Doku nennt weder Endpunktpfade noch die Gestalt der
 * Suchanfrage. Übernommen ist nichts als das Wissen; geschrieben ist hier alles neu, in
 * TypeScript, für einen Worker ohne Dateisystem.
 *
 * Vier Eigenheiten der API prägen diesen Client:
 *
 *  1. **Nichts hat einen festen Pfad.** Die Platform-API ist durchgehend HATEOAS: jede
 *     Antwort trägt `Links: [{rel, href}]`, und der nächste Aufruf geht an ein `href`
 *     daraus. Deshalb wird hier kein Pfad zusammengebaut — es wird gefolgt. Fehlt eine
 *     Beziehung, sagt der Client das mit Namen, statt einen Pfad zu raten, der auf einem
 *     anderen DocuWare-Stand oder in der Cloud anders aussieht.
 *  2. **Anmelden heißt zweimal nachfragen.** Das Token kommt nicht von DocuWare selbst,
 *     sondern von einem Identity Service, der bei der Cloud auf einem ganz anderen Host
 *     liegt (login-emea.docuware.cloud). Wo er liegt, sagt `/Home/IdentityServiceInfo`;
 *     welchen Token-Endpunkt er hat, sagt dessen `.well-known/openid-configuration`.
 *  3. **Datumswerte sind kein ISO-Datum.** DocuWare antwortet mit `/Date(1700000000000)/`
 *     — Millisekunden seit 1970, in eine Zeichenkette gewickelt. Wer das durchreicht,
 *     legt eine unlesbare Zeichenfolge ins Gespräch. `dwDate()` macht ein Datum daraus.
 *  4. **Der Zeichensatz der Suche kennt Sonderzeichen.** In einem Suchwert sind `(`, `)`,
 *     `*` und `?` Syntax, nicht Text. Ein Wert wie „Rechnung (Eingang)" sucht ohne
 *     Maskierung etwas anderes als das, was dasteht — ohne Fehlermeldung. Siehe
 *     `quoteValue()` in search.ts.
 */
import { sealJSON, openJSON, sha256hex } from "../../../shared/src/crypto";

/** Ein Zugang, so wie er auf der Anmeldeseite eingegeben wird. */
export interface Credentials {
  /** Basis-URL der DocuWare-Installation, schon normalisiert (siehe platformUrl). */
  url: string;
  /** Benutzername oder — bei einer App-Registrierung — die Client-ID. */
  username: string;
  /** Passwort oder Client-Secret. */
  password: string;
}

export class DocuwareError extends Error {
  /** Gesetzt, wenn DocuWare die Zugangsdaten abgelehnt hat (400/401 beim Token). */
  rejected?: boolean;

  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "DocuwareError";
  }
}

/**
 * Eingabe zu einer Platform-URL machen.
 *
 * Gedacht ist das für den Fall, dass jemand nur „firma" eintippt — bei DocuWare Cloud ist
 * das der Mandantenname unter docuware.cloud. Ein Punkt in der Eingabe heißt: das ist
 * schon ein Hostname, dann wird nichts angehängt.
 */
export function platformUrl(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) throw new DocuwareError("Es fehlt die DocuWare-URL.");

  let base = v.replace(/\/DocuWare\/Platform\/?$/i, "");
  if (!/^https?:\/\//i.test(base)) {
    if (!base.includes(".")) base = `${base}.docuware.cloud`;
    base = `https://${base}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new DocuwareError(`'${value}' ergibt keine gültige URL.`);
  }
  if (parsed.protocol !== "https:") {
    // Zugangsdaten und Dokumente über eine ungesicherte Verbindung: nicht in diesem Server.
    throw new DocuwareError("Die DocuWare-URL muss https sein.");
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path}/DocuWare/Platform`;
}

/** Die Herkunft (Schema + Host) einer Platform-URL — Links kommen als absolute Pfade. */
export function originOf(platform: string): string {
  return new URL(platform).origin;
}

/**
 * `Links: [{rel, href}]` als Karte, Schlüssel kleingeschrieben.
 *
 * Kleingeschrieben, weil die Schreibweise der Beziehungsnamen zwischen den
 * DocuWare-Ständen wechselt: mal `fileCabinets`, mal `filecabinets`. Ein Vergleich auf
 * Gleichheit würde bei einem Stand funktionieren und beim nächsten stumm ins Leere greifen.
 */
export function links(config: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const list = (config as any)?.Links;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const rel = entry?.rel ?? entry?.Rel;
      const href = entry?.href ?? entry?.Href;
      if (typeof rel === "string" && typeof href === "string") out[rel.toLowerCase()] = href;
    }
  }
  return out;
}

/** Eine Beziehung holen — oder mit Namen sagen, dass es sie nicht gibt. */
export function link(config: unknown, rel: string, was: string): string {
  const table = links(config);
  const found = table[rel.toLowerCase()];
  if (!found) {
    const bekannt = Object.keys(table).sort().join(", ") || "keine";
    throw new DocuwareError(
      `${was} hat keine Beziehung '${rel}'. DocuWare gibt die Folgeadressen selbst vor; ` +
        `hier ist sie nicht dabei. Vorhanden: ${bekannt}.`,
    );
  }
  return found;
}

/**
 * `/Date(1700000000000+0200)/` -> `2023-11-14`.
 *
 * Die Zeitzonenangabe hinten beschreibt nur, in welcher Zone der Wert einmal angezeigt
 * wurde; die Millisekunden sind immer UTC. Null oder negativ heißt bei DocuWare „kein
 * Datum" — dann kommt null zurück und nicht der 1.1.1970.
 */
export function dwDate(value: unknown, withTime = false): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  const m = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(s);
  if (m) {
    const ms = Number(m[1]);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const iso = new Date(ms).toISOString();
    return withTime ? iso.slice(0, 19).replace("T", " ") : iso.slice(0, 10);
  }
  // Manche Felder kommen bereits als ISO-Zeichenkette zurück.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return withTime ? s.slice(0, 19).replace("T", " ") : s.slice(0, 10);
  }
  return null;
}

/**
 * DocuWare veröffentlicht keine Ratengrenze. Ohne veröffentlichte Zahl ist jede geraten;
 * 150 ms Mindestabstand ist langsam genug, dass eine Suche über mehrere Seiten nicht ins
 * Limit läuft, und schnell genug, dass niemand darauf wartet. Die Wiederholung bei 429
 * darunter ist die eigentliche Absicherung.
 *
 * Die Drossel liegt auf Modulebene und pro Zugang, nicht am Client-Objekt: pro Tool-Aufruf
 * entsteht ein frischer Client, ein Zähler am Objekt finge jedes Mal wieder bei null an.
 */
const MIN_INTERVAL_MS = 150;
const MAX_RETRIES = 3;

interface Slot {
  nextAt: number;
  chain: Promise<unknown>;
  touched: number;
}
const slots = new Map<string, Slot>();

function slotFor(key: string): Slot {
  const now = Date.now();
  if (slots.size > 64) {
    for (const [k, v] of slots) if (now - v.touched > 60_000) slots.delete(k);
  }
  let slot = slots.get(key);
  if (!slot) {
    slot = { nextAt: 0, chain: Promise.resolve(), touched: now };
    slots.set(key, slot);
  }
  slot.touched = now;
  return slot;
}

/** Anmeldearten, die DocuWare für die Platform-API zulässt. */
export type Grant = "password" | "client_credentials";

/**
 * Der eingebaute Client der DocuWare-eigenen Anwendungen. Beim Passwort-Grant verlangt der
 * Identity Service eine `client_id`; diese hier gibt es auf jeder Installation, ohne dass
 * jemand vorher eine App registrieren müsste.
 */
const BUILTIN_CLIENT_ID = "docuware.platform.net.client";
const SCOPE = "docuware.platform";

/** GUID-Form — so sehen die Client-IDs aus App-Registrierungen aus, Benutzernamen nicht. */
const GUID = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;

/**
 * In welcher Reihenfolge die beiden Anmeldearten probiert werden.
 *
 * Beides ist von DocuWare vorgesehen: ein echtes Benutzerkonto (Passwort-Grant) oder eine
 * App-Registrierung mit Client-ID und Secret. Auf der Anmeldeseite steht dafür ein
 * Feldpaar, weil zwei Formulare für dieselbe Sache eines zu viel wären. Welche der beiden
 * gemeint ist, verrät die Gestalt: Client-IDs sind GUIDs, Benutzernamen sind es nie.
 * Geraten wird trotzdem nicht — passt die erste nicht, wird die zweite versucht.
 */
export function grantOrder(username: string): Grant[] {
  return GUID.test(String(username ?? "").trim())
    ? ["client_credentials", "password"]
    : ["password", "client_credentials"];
}

interface Discovery {
  identityUrl: string;
  tokenEndpoint: string;
}

const DISCOVERY_TTL = 12 * 60 * 60;
/** Zwei Minuten Sicherheitsabstand: ein Token, das während des Aufrufs abläuft, nützt nichts. */
const TOKEN_SKEW_SECONDS = 120;

const USER_AGENT = "mcpees-docuware-mcp (github.com/ksqsebastian-spec/mcpees)";

export interface CallOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** multipart statt JSON — für den Datei-Upload. */
  form?: FormData;
  accept?: string;
}

export class Docuware {
  calls = 0;
  /** Womit die Anmeldung zuletzt geklappt hat — für system_info. */
  grant: Grant | null = null;

  /*
   * Discovery und Token gelten für die Lebensdauer dieses Objekts, nicht für einen
   * einzelnen Aufruf. Ohne diese beiden Felder würde jeder Request die Anmeldung von vorn
   * beginnen: das Prüfen der Zugangsdaten allein sind drei Aufrufe gegen DocuWare, und
   * ohne KV — genau dann ist es der Fall — läge dahinter dreimal dieselbe Anmeldung.
   * Gespeichert wird das Promise, nicht der Wert: so laufen auch zwei gleichzeitige
   * Aufrufe nur in eine Anmeldung und nicht in zwei.
   */
  private discovery: Promise<Discovery> | null = null;
  private accessToken: Promise<string> | null = null;

  constructor(
    readonly credentials: Credentials,
    private readonly kv: KVNamespace | null = null,
  ) {}

  get platform(): string {
    return this.credentials.url;
  }

  /** Ein Schlüssel je Zugang, aus dem sich der Zugang nicht zurückrechnen lässt. */
  private async fingerprint(): Promise<string> {
    return sha256hex(this.secret);
  }

  private get secret(): string {
    return `${this.credentials.url} ${this.credentials.username} ${this.credentials.password}`;
  }

  /* ── Anmeldung ─────────────────────────────────────────────────────────── */

  /**
   * Wo der Identity Service liegt und wie sein Token-Endpunkt heißt.
   *
   * Zwei Anfragen, die sich für einen Mandanten nie ändern — deshalb zwölf Stunden in KV.
   * Es steht nichts Geheimes darin: beide Adressen sind ohne Anmeldung abrufbar.
   */
  discover(): Promise<Discovery> {
    return (this.discovery ??= this.lookupDiscovery());
  }

  private async lookupDiscovery(): Promise<Discovery> {
    const key = `dw:oidc:${await sha256hex(this.platform)}`;
    if (this.kv) {
      const cached = await this.kv.get<Discovery>(key, "json");
      if (cached?.tokenEndpoint) return cached;
    }

    const infoUrl = `${this.platform}/Home/IdentityServiceInfo`;
    const info = await this.plainJson(infoUrl, "Die Auskunft über den Identity Service");
    const identityUrl = String((info as any)?.IdentityServiceUrl ?? "").trim();
    if (!identityUrl) {
      throw new DocuwareError(
        `${infoUrl} nennt keine IdentityServiceUrl. Entweder zeigt die URL nicht auf eine ` +
          `DocuWare-Installation, oder sie ist älter als 7.10 — davor gab es dort kein OAuth.`,
        info,
      );
    }

    const wellKnown = `${identityUrl.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    const oidc = await this.plainJson(wellKnown, "Die OpenID-Connect-Beschreibung");
    const tokenEndpoint = String((oidc as any)?.token_endpoint ?? "").trim();
    if (!tokenEndpoint) {
      throw new DocuwareError(`${wellKnown} nennt keinen token_endpoint.`, oidc);
    }

    const found: Discovery = { identityUrl, tokenEndpoint };
    await this.kv?.put(key, JSON.stringify(found), { expirationTtl: DISCOVERY_TTL });
    return found;
  }

  /** Eine JSON-Antwort ohne Anmeldung holen — für die beiden Discovery-Schritte. */
  private async plainJson(url: string, was: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchThrottled(url, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
    } catch (err) {
      throw new DocuwareError(
        `${url} ist nicht erreichbar: ${(err as Error).message}. Stimmt die DocuWare-URL?`,
      );
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DocuwareError(
        `${was} ist unter ${url} nicht zu bekommen (HTTP ${res.status}). Stimmt die DocuWare-URL?`,
        text.slice(0, 300),
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DocuwareError(`${url} antwortet nicht mit JSON.`, text.slice(0, 300));
    }
  }

  /**
   * Ein gültiges Access-Token, notfalls frisch geholt.
   *
   * Zwischengespeichert wird es verschlüsselt: der Schlüssel wird aus den Zugangsdaten
   * abgeleitet, in KV steht nur Chiffretext. Wer die KV-Daten hat, aber die Zugangsdaten
   * nicht, hat nichts — dieselbe Bauart wie beim OAuth-Token dieses Servers selbst.
   */
  token(): Promise<string> {
    return (this.accessToken ??= this.fetchToken());
  }

  private async fetchToken(): Promise<string> {
    const key = `dw:tok:${await this.fingerprint()}`;
    if (this.kv) {
      const sealed = await this.kv.get(key, "text");
      if (sealed) {
        try {
          const rec = await openJSON<{ token: string; grant: Grant }>(this.secret, sealed);
          if (rec?.token) {
            this.grant = rec.grant;
            return rec.token;
          }
        } catch {
          /* Passt der Schlüssel nicht, gilt der Eintrag als nicht vorhanden. */
        }
      }
    }

    const { tokenEndpoint } = await this.discover();
    let first: DocuwareError | null = null;

    for (const grant of grantOrder(this.credentials.username)) {
      try {
        const { token, expiresIn } = await this.requestToken(tokenEndpoint, grant);
        this.grant = grant;
        const ttl = Math.max(60, Math.min(expiresIn, 12 * 60 * 60) - TOKEN_SKEW_SECONDS);
        if (this.kv) {
          await this.kv.put(key, await sealJSON(this.secret, { token, grant }), {
            expirationTtl: ttl,
          });
        }
        return token;
      } catch (err) {
        // Nur eine abgelehnte Anmeldung rechtfertigt den zweiten Versuch. Ist DocuWare
        // nicht erreichbar, hilft eine andere Anmeldeart nicht.
        if (!(err instanceof DocuwareError) || !err.rejected) throw err;
        first ??= err;
      }
    }

    throw new DocuwareError(
      `DocuWare lehnt die Zugangsdaten ab — weder als Benutzername mit Passwort noch als ` +
        `Client-ID mit Secret einer App-Registrierung. ${first?.message ?? ""}`.trim(),
      first?.detail,
    );
  }

  private async requestToken(
    tokenEndpoint: string,
    grant: Grant,
  ): Promise<{ token: string; expiresIn: number }> {
    const form = new URLSearchParams(
      grant === "password"
        ? {
            grant_type: "password",
            username: this.credentials.username,
            password: this.credentials.password,
            client_id: BUILTIN_CLIENT_ID,
            scope: SCOPE,
          }
        : {
            grant_type: "client_credentials",
            client_id: this.credentials.username,
            client_secret: this.credentials.password,
            scope: SCOPE,
          },
    );

    const res = await this.fetchThrottled(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: form.toString(),
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* bleibt null */
    }

    if (!res.ok) {
      const err = new DocuwareError(
        `Der Identity Service lehnt die Anmeldung ab (HTTP ${res.status}` +
          `${parsed?.error ? `, ${parsed.error}` : ""}).`,
        parsed ?? text.slice(0, 300),
      );
      // 400 und 401 heißen: die Zugangsdaten passen nicht. Alles andere ist etwas anderes.
      err.rejected = res.status === 400 || res.status === 401;
      throw err;
    }

    const token = String(parsed?.access_token ?? "");
    if (!token) throw new DocuwareError("Der Identity Service liefert kein access_token.", parsed);
    const expiresIn = Number(parsed?.expires_in);
    return { token, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600 };
  }

  /* ── Aufrufe gegen die Platform-API ────────────────────────────────────── */

  /**
   * Einen Link auflösen. DocuWare gibt Beziehungen als absolute Pfade an
   * (`/DocuWare/Platform/FileCabinets/…`), gelegentlich auch als vollständige URL.
   */
  resolve(href: string): string {
    return /^https?:\/\//i.test(href) ? href : new URL(href, originOf(this.platform)).toString();
  }

  async request(method: string, href: string, opts: CallOptions = {}): Promise<Response> {
    const url = new URL(this.resolve(href));
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }

    const send = async (token: string): Promise<Response> => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: opts.accept ?? "application/json",
        "User-Agent": USER_AGENT,
      };
      let body: BodyInit | undefined;
      if (opts.form) {
        body = opts.form; // Grenze samt Content-Type setzt fetch selbst
      } else if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
      return this.fetchThrottled(url.toString(), { method, headers, body });
    };

    let res: Response;
    try {
      res = await send(await this.token());
    } catch (err) {
      // Eine gescheiterte Anmeldung darf nicht als Ergebnis hängen bleiben; der nächste
      // Aufruf soll es wieder versuchen dürfen.
      this.accessToken = null;
      throw err;
    }

    /*
     * Ein abgelaufenes Token sieht aus wie ein fehlendes: 401. Das kann auch passieren,
     * während der Zwischenspeicher noch gilt — DocuWare beendet eine Sitzung etwa, wenn
     * der Benutzer sein Passwort ändert. Dann einmal frisch anmelden und denselben Aufruf
     * wiederholen. Nur einmal: wiederholt sich der 401, liegt es nicht am Token.
     */
    if (res.status === 401) {
      await this.forgetToken();
      res = await send(await this.token());
    }

    // 429 kommt selten, aber die Cloud drosselt. Warten, was sie sagt, sonst wachsend.
    for (let attempt = 0; res.status === 429 && attempt < MAX_RETRIES; attempt++) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, waitMs));
      res = await send(await this.token());
    }

    return res;
  }

  /** Aufruf mit JSON-Antwort. Wirft mit übersetzter Meldung, wenn DocuWare ablehnt. */
  async json<T = any>(method: string, href: string, opts: CallOptions = {}): Promise<T> {
    const res = await this.request(method, href, opts);
    const text = await res.text();
    if (!res.ok) throw explain(res.status, method, href, text);
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new DocuwareError(
        `DocuWare antwortet auf ${method} ${href} nicht mit JSON.`,
        text.slice(0, 300),
      );
    }
  }

  /** Aufruf mit Binärantwort — für Dokumente und Anhänge. */
  async bytes(
    href: string,
    opts: CallOptions = {},
  ): Promise<{ bytes: Uint8Array; contentType: string; filename: string | null }> {
    const res = await this.request("GET", href, { ...opts, accept: opts.accept ?? "*/*" });
    if (!res.ok) throw explain(res.status, "GET", href, await res.text());
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      filename: filenameOf(res.headers.get("content-disposition")),
    };
  }

  private async forgetToken(): Promise<void> {
    this.accessToken = null;
    if (this.kv) await this.kv.delete(`dw:tok:${await this.fingerprint()}`);
  }

  private fetchThrottled(url: string, init: RequestInit): Promise<Response> {
    const slot = slotFor(`${this.credentials.url} ${this.credentials.username}`);
    const run = async (): Promise<Response> => {
      const now = Date.now();
      const wait = Math.max(0, slot.nextAt - now);
      slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.calls++;
      return fetch(url, init);
    };
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => undefined);
    return queued;
  }
}

/** `attachment; filename="rechnung.pdf"` -> `rechnung.pdf`. */
export function filenameOf(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return sanitizeFilename(decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")));
    } catch {
      /* weiter mit der einfachen Form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? sanitizeFilename(plain[1]) : null;
}

/** Kein Pfad, keine Anführungszeichen, keine Steuerzeichen — der Name landet in einem Header. */
export function sanitizeFilename(name: string): string {
  return (
    String(name ?? "")
      .replace(/[\\/]/g, "_")
      .replace(/["\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 180) || "dokument"
  );
}

/** Statuscodes in Klartext, damit das Modell weiß, was zu tun ist. */
function explain(status: number, method: string, href: string, text: string): DocuwareError {
  let detail: unknown = text.slice(0, 800);
  let message = "";
  try {
    const parsed = JSON.parse(text);
    detail = parsed;
    message = String(parsed?.Message ?? parsed?.message ?? "");
  } catch {
    /* Text bleibt Text */
  }
  const suffix = message ? ` DocuWare sagt: ${message.slice(0, 300)}` : "";
  const op = `${method} ${href}`;
  switch (status) {
    case 400:
      return new DocuwareError(
        `DocuWare weist die Anfrage zurück (400) bei ${op}. Bei einer Suche steckt dahinter ` +
          `meist ein Feldname, den der Aktenschrank nicht kennt, oder ein Wert, der nicht ` +
          `zum Feldtyp passt — 'index_fields' zeigt beides.${suffix}`,
        detail,
      );
    case 401:
      return new DocuwareError(
        `DocuWare lehnt die Anmeldung ab (401) bei ${op}. Das Passwort wurde geändert, oder ` +
          `das Konto ist gesperrt.${suffix}`,
        detail,
      );
    case 403:
      return new DocuwareError(
        `Keine Berechtigung für ${op} (403). Der DocuWare-Benutzer hinter diesem Zugang darf ` +
          `das nicht — Rechte am Aktenschrank werden in DocuWare selbst vergeben.${suffix}`,
        detail,
      );
    case 404:
      return new DocuwareError(`Nicht gefunden: ${op} (404).${suffix}`, detail);
    case 429:
      return new DocuwareError(
        `DocuWare drosselt (429) bei ${op} — auch nach mehreren Wiederholungen.${suffix}`,
        detail,
      );
    default:
      return new DocuwareError(`DocuWare HTTP ${status} bei ${op}.${suffix}`, detail);
  }
}
