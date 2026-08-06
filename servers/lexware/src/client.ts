/**
 * Client für die Lexware Office Public API.
 *
 * Zwei Dinge prägen diesen Client, beide aus der offiziellen Doku:
 *
 *  1. **2 Requests pro Sekunde.** Das ist kein weicher Richtwert — darüber kommt 429, und der
 *     Authorization-Server sperrt bei Übermut für Sekunden bis Minuten. Ein Tool, das über
 *     mehrere Seiten paginiert, reißt das Limit sofort. Deshalb serialisiert dieser Client
 *     alle Aufrufe und hält den Mindestabstand selbst ein, statt sich auf Glück zu verlassen.
 *  2. **Nullbasierte Seiten mit `content`.** Listen liefern LexwarePage<T>; wer bei Seite 1
 *     anfängt, überspringt stillschweigend die erste Seite.
 *
 * Beim Abschneiden von Ergebnissen wird das IMMER mitgeteilt (`truncated`), nie stillschweigend
 * getan — eine gekappte Liste, die wie eine vollständige aussieht, ist eine falsche Antwort.
 */

export const LEXWARE_BASE = "https://api.lexware.io";

/** Doku: "A client can make up to 2 requests per second to the Lexware API." */
const MIN_INTERVAL_MS = 550;
const MAX_RETRIES = 3;

export class LexwareError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LexwareError";
  }
}

export interface LexwarePage<T> {
  content: T[];
  page?: number;
  number?: number;
  size?: number;
  totalPages?: number;
  totalElements?: number;
  last?: boolean;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** multipart statt JSON — für POST /v1/files. */
  form?: FormData;
  accept?: string;
  /** Antwort roh zurückgeben (Binärdaten) statt JSON zu parsen. */
  raw?: boolean;
}

/**
 * Die Drossel lebt auf Modulebene, nicht am Client-Objekt.
 *
 * Grund: pro Tool-Aufruf entsteht ein frischer Client. Läge der Zähler dort, würde er bei
 * jedem Aufruf neu starten und zwei aufeinanderfolgende Tools würden ihre Requests direkt
 * hintereinander abfeuern — genau das Verhalten, das Lexware mit 429 und zeitweiser Sperre
 * beantwortet. Geschlüsselt wird nach API-Key, weil das Limit pro Zugang gilt.
 *
 * Was das NICHT kann: über Isolate-Grenzen hinweg koordinieren. Cloudflare kann denselben
 * Key in mehreren Isolaten bedienen; dafür gibt es den 429-Retry weiter unten.
 */
interface Slot {
  nextAt: number;
  chain: Promise<unknown>;
  touched: number;
}
const slots = new Map<string, Slot>();

function slotFor(key: string): Slot {
  const now = Date.now();
  // Alte Einträge aufräumen, damit die Map in einem langlebigen Isolat nicht wächst.
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

export class Lexware {
  calls = 0;

  constructor(private readonly apiKey: string) {}

  private async throttle(): Promise<void> {
    const slot = slotFor(this.apiKey);
    const now = Date.now();
    const wait = Math.max(0, slot.nextAt - now);
    slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  /** Ein Request gegen die Lexware-API, eingereiht und ratenbegrenzt. */
  request(path: string, opts: RequestOptions = {}): Promise<Response> {
    const run = async (): Promise<Response> => {
      const url = new URL(path.startsWith("/") ? path : `/${path}`, LEXWARE_BASE);
      for (const [k, v] of Object.entries(opts.query ?? {})) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: opts.accept ?? "application/json",
      };
      let body: BodyInit | undefined;
      if (opts.form) {
        body = opts.form; // Content-Type setzt fetch inklusive Boundary
      } else if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }

      for (let attempt = 0; ; attempt++) {
        await this.throttle();
        this.calls++;
        const res = await fetch(url.toString(), { method: opts.method ?? "GET", headers, body });

        // 429 ist bei 2 req/s realistisch, sobald noch jemand anders denselben Key nutzt.
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 1000 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return res;
      }
    };

    // An die Kette dieses Zugangs hängen, damit nie zwei Requests gleichzeitig rausgehen.
    const slot = slotFor(this.apiKey);
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => undefined);
    return queued;
  }

  /** Request + JSON-Antwort, mit lesbaren Fehlern statt roher Statuscodes. */
  async json<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.request(path, opts);
    const text = await res.text();

    if (!res.ok) {
      let detail: unknown = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
        /* Text bleibt Text */
      }
      throw new LexwareError(explain(res.status, path), detail);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new LexwareError(`Lexware lieferte kein JSON für ${path}`, text.slice(0, 300));
    }
  }

  /**
   * Alle Seiten einer Liste holen. Seiten sind nullbasiert.
   *
   * `maxItems` begrenzt bewusst und sichtbar: das Ergebnis sagt, ob abgeschnitten wurde.
   * Ohne diese Grenze kann ein einziger Aufruf hunderte Requests auslösen — bei 2 req/s
   * wären das Minuten, und der MCP-Client läuft in seinen Timeout.
   */
  async paginate<T = any>(
    path: string,
    query: Record<string, string | number | boolean | null | undefined>,
    maxItems = 500,
  ): Promise<{ items: T[]; total: number | null; truncated: boolean; pages: number }> {
    const size = Math.min(250, Math.max(1, maxItems));
    const items: T[] = [];
    let total: number | null = null;
    let pages = 0;

    for (let page = 0; ; page++) {
      const data = await this.json<LexwarePage<T>>(path, { query: { ...query, page, size } });
      pages++;
      const content = data.content ?? [];
      items.push(...content);
      if (typeof data.totalElements === "number") total = data.totalElements;

      if (items.length >= maxItems) return { items: items.slice(0, maxItems), total, truncated: true, pages };
      if (data.last === true) break;
      if (typeof data.totalPages === "number" && page + 1 >= data.totalPages) break;
      if (content.length === 0) break;
      // Reißleine: die API verweigert Traversierung über 10.000 Treffer hinaus.
      if (page > 40) return { items, total, truncated: true, pages };
    }
    return { items, total, truncated: false, pages };
  }

  /** Prüft den Key und liefert den Firmennamen zurück. */
  async whoami(): Promise<{ company: string; user: string }> {
    const p = await this.json<any>("/v1/profile");
    return {
      company: p?.companyName ?? p?.organizationId ?? "unbekannt",
      user: p?.userName ?? p?.userEmail ?? "unbekannt",
    };
  }
}

/** Statuscodes in Klartext, damit das Modell weiß, was zu tun ist. */
function explain(status: number, path: string): string {
  switch (status) {
    case 401:
      return "Lexware lehnt den API-Key ab (401). Der Key ist ungültig oder wurde widerrufen.";
    case 402:
      return (
        "Lexware verweigert den Zugriff (402). Die Public API setzt Lexware Office XL voraus — " +
        "in kleineren Tarifen ist sie nicht freigeschaltet."
      );
    case 403:
      return `Keine Berechtigung für ${path} (403).`;
    case 404:
      return `Nicht gefunden: ${path} (404).`;
    case 406:
      return `Lexware akzeptiert das angefragte Format für ${path} nicht (406).`;
    case 429:
      return (
        "Lexware drosselt (429). Das Limit sind 2 Requests pro Sekunde — auch nach mehreren " +
        "Wiederholungen noch belegt. Kleineren Zeitraum oder kleineres Limit wählen."
      );
    case 409:
      return (
        `Konflikt bei ${path} (409). Lexware nutzt optimistisches Sperren über das Feld version; ` +
        "der Datensatz wurde zwischenzeitlich geändert."
      );
    default:
      return `Lexware HTTP ${status} bei ${path}.`;
  }
}
