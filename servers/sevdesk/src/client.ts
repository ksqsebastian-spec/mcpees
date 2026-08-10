/**
 * Client für die sevdesk API v1.
 *
 * Vier Eigenheiten der API prägen diesen Client — alle aus der offiziellen Beschreibung:
 *
 *  1. **Kein `Bearer`.** Der Token steht roh im Authorization-Header. Ein vorangestelltes
 *     "Bearer " führt zu 401, und die Meldung sagt nicht, warum.
 *  2. **Alles steckt in `objects`.** Listen wie Einzelobjekte antworten mit
 *     `{ "objects": [...] }`, bei `countAll=true` zusätzlich mit `total`. Wer die Antwort
 *     direkt benutzt, greift ins Leere.
 *  3. **Filter auf Fremdobjekte brauchen zwei Parameter.** `contact[id]=17` allein filtert
 *     nichts — ohne `contact[objectName]=Contact` liefert sevdesk stillschweigend die
 *     ungefilterte Liste. Das ist die gefährlichste Falle der ganzen API: die Antwort ist
 *     falsch und sieht vollkommen richtig aus. `ref()` setzt deshalb immer beide.
 *  4. **Unbekannte Query-Parameter werden ignoriert, nicht abgelehnt.** Ein Tippfehler im
 *     Filternamen kostet keinen Fehler, sondern die Filterwirkung. Deshalb prüft `call()`
 *     jeden Aufruf gegen die eingefrorene API-Beschreibung (api.generated.ts), bevor er
 *     rausgeht: unbekannter Endpunkt, unbekannter Parameter oder ein Wert außerhalb der
 *     erlaubten Liste werfen hier und nicht irgendwo in den Daten.
 *
 * Ratenbegrenzung: sevdesk begrenzt pro Minute, veröffentlicht die Grenze aber nicht. Der
 * Client hält deshalb einen konservativen Mindestabstand ein und wiederholt 429 mit
 * wachsender Wartezeit, statt eine Zahl zu erfinden, die falsch sein könnte.
 */
import { OPERATIONS, type OperationSpec } from "./api.generated";

export const SEVDESK_BASE = "https://my.sevdesk.de/api/v1";

/**
 * Ohne veröffentlichte Grenze ist jede Zahl geraten. 250 ms (4/s) ist langsam genug, dass
 * ein einzelnes Tool nicht ins Limit läuft, und schnell genug, dass eine Auswertung über
 * mehrere Seiten nicht zäh wird. Der 429-Retry darunter ist die eigentliche Absicherung.
 */
const MIN_INTERVAL_MS = 250;
const MAX_RETRIES = 3;

/**
 * Global gültig, aber nicht pro Operation dokumentiert — sevdesk beschreibt sie einmal in
 * der Einleitung. Sie stehen deshalb nicht in der eingefrorenen Beschreibung und müssen
 * hier gesondert erlaubt werden.
 */
const GLOBAL_QUERY = new Set(["limit", "offset", "countAll", "embed"]);

/**
 * Parameter, die sevdesk selbst benutzt, aber nicht beschreibt.
 *
 * `/ContactAddress` hat in der Beschreibung überhaupt keine Query-Parameter — die Adressen
 * eines Kontakts wären damit nur zu bekommen, indem man alle Adressen des Mandanten holt.
 * Der Filter existiert und funktioniert, er steht bloß nirgends.
 *
 * Solche Parameter werden hier einzeln freigegeben, nicht pauschal. Bedingung: der Aufrufer
 * muss das Ergebnis zusätzlich selbst prüfen. Denn genau das ist die Gefahr — würde sevdesk
 * den Filter doch ignorieren, kämen fremde Adressen zurück und sähen richtig aus.
 */
const UNDOCUMENTED_QUERY: Record<string, string[]> = {
  "GET /ContactAddress": ["contact[id]", "contact[objectName]"],
};

/** sevdesk begrenzt limit auf 1..1000, empfiehlt für die Antwortzeit aber 10–100. */
export const MAX_LIMIT = 1000;
const PAGE_SIZE = 100;

export class SevdeskError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "SevdeskError";
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export interface CallOptions {
  /** Werte für die Platzhalter im Pfad, z. B. { invoiceId: 42 }. */
  path?: Record<string, string | number>;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** multipart statt JSON — für den Beleg-Upload. */
  form?: FormData;
  accept?: string;
}

/**
 * Verweis auf ein anderes sevdesk-Objekt. In Filtern wie in Bodies verlangt sevdesk immer
 * id UND objectName; fehlt der Name, wird der Verweis ignoriert.
 */
export const ref = (objectName: string, id: string | number) => ({
  id: typeof id === "string" ? id : String(id),
  objectName,
});

/** Dasselbe als Query-Paar: contact[id] + contact[objectName]. */
export function refQuery(
  field: string,
  objectName: string,
  id: string | number | undefined | null,
): Record<string, QueryValue> {
  if (id === undefined || id === null || id === "") return {};
  return { [`${field}[id]`]: id, [`${field}[objectName]`]: objectName };
}

/**
 * Die Drossel lebt auf Modulebene und pro Token, nicht am Client-Objekt: pro Tool-Aufruf
 * entsteht ein frischer Client, und ein Zähler am Objekt würde bei jedem Aufruf wieder bei
 * null anfangen. Genau dieser Fehler ist in diesem Repo schon einmal passiert und kostete zwei Tools
 * hintereinander ihren Mindestabstand.
 */
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

/** Pfadvorlage + Werte -> fertiger Pfad. Wirft, wenn ein Platzhalter unbesetzt bleibt. */
function fillPath(template: string, spec: OperationSpec, values: Record<string, string | number>): string {
  for (const name of spec.p ?? []) {
    if (values[name] === undefined || values[name] === null || values[name] === "") {
      throw new SevdeskError(`Pfadparameter '${name}' fehlt für ${template}.`);
    }
  }
  return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
    encodeURIComponent(String(values[name])),
  );
}

/** Query gegen die Beschreibung prüfen. Siehe Kopfkommentar, Punkt 4. */
function checkQuery(key: string, spec: OperationSpec, query: Record<string, QueryValue>): void {
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (GLOBAL_QUERY.has(name)) continue;
    if (UNDOCUMENTED_QUERY[key]?.includes(name)) continue;
    const def = spec.q?.[name];
    if (!def) {
      const known = [...Object.keys(spec.q ?? {}), ...GLOBAL_QUERY].sort().join(", ");
      throw new SevdeskError(
        `Query-Parameter '${name}' kennt ${key} nicht. sevdesk würde ihn stillschweigend ` +
          `ignorieren und ungefiltert antworten. Bekannt: ${known || "keine"}.`,
      );
    }
    if (def.e && !def.e.some((allowed) => String(allowed) === String(value))) {
      throw new SevdeskError(
        `'${value}' ist kein erlaubter Wert für ${name} bei ${key}. ` +
          `Erlaubt: ${def.e.join(", ")}.`,
      );
    }
  }
}

export class Sevdesk {
  calls = 0;

  constructor(private readonly token: string) {}

  private async throttle(): Promise<void> {
    const slot = slotFor(this.token);
    const now = Date.now();
    const wait = Math.max(0, slot.nextAt - now);
    slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  /**
   * Ein Aufruf gegen sevdesk. `template` ist der Pfad AUS DER BESCHREIBUNG, also mit
   * Platzhaltern ("/Invoice/{invoiceId}") — nur so lässt sich der Aufruf prüfen.
   */
  request(method: string, template: string, opts: CallOptions = {}): Promise<Response> {
    const key = `${method} ${template}`;
    const spec = OPERATIONS[key];
    if (!spec) {
      throw new SevdeskError(
        `${key} steht nicht in der sevdesk-Beschreibung. Entweder ist der Pfad falsch ` +
          `geschrieben oder der Endpunkt existiert nicht.`,
      );
    }
    const query = opts.query ?? {};
    checkQuery(key, spec, query);
    const path = fillPath(template, spec, opts.path ?? {});

    const run = async (): Promise<Response> => {
      const url = new URL(SEVDESK_BASE + path);
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }

      const headers: Record<string, string> = {
        // Ohne "Bearer" — sevdesk erwartet den nackten Token.
        Authorization: this.token,
        Accept: opts.accept ?? "application/json",
        // Die Doku bittet ausdrücklich um einen sprechenden User-Agent.
        "User-Agent": "mcpees-sevdesk-mcp (github.com/ksqsebastian-spec/mcpees)",
      };
      let body: BodyInit | undefined;
      if (opts.form) {
        body = opts.form; // Content-Type inkl. boundary setzt fetch selbst
      } else if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }

      for (let attempt = 0; ; attempt++) {
        await this.throttle();
        this.calls++;
        const res = await fetch(url.toString(), { method, headers, body });
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return res;
      }
    };

    const slot = slotFor(this.token);
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => undefined);
    return queued;
  }

  /** Aufruf + JSON-Antwort, ohne die `objects`-Hülle. */
  async call<T = any>(method: string, template: string, opts: CallOptions = {}): Promise<T> {
    const res = await this.request(method, template, opts);
    const text = await res.text();

    if (!res.ok) {
      let detail: unknown = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
        /* Text bleibt Text */
      }
      throw new SevdeskError(explain(res.status, `${method} ${template}`, detail), detail);
    }
    if (!text) return undefined as T;
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SevdeskError(`sevdesk lieferte kein JSON für ${template}`, text.slice(0, 300));
    }
    return (parsed && typeof parsed === "object" && "objects" in parsed ? parsed.objects : parsed) as T;
  }

  /** Wie `call`, aber mit der Gesamtzahl aus `countAll`. */
  async callWithTotal<T = any>(
    method: string,
    template: string,
    opts: CallOptions = {},
  ): Promise<{ objects: T[]; total: number | null }> {
    const res = await this.request(method, template, opts);
    const text = await res.text();
    if (!res.ok) {
      let detail: unknown = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
        /* Text bleibt Text */
      }
      throw new SevdeskError(explain(res.status, `${method} ${template}`, detail), detail);
    }
    const parsed = text ? JSON.parse(text) : {};
    const objects = Array.isArray(parsed?.objects) ? parsed.objects : [];
    const total = parsed?.total === undefined ? null : Number(parsed.total);
    return { objects, total: Number.isFinite(total as number) ? (total as number) : null };
  }

  /**
   * Alle Seiten einer Liste holen.
   *
   * `maxItems` begrenzt sichtbar: das Ergebnis sagt, ob abgeschnitten wurde. Eine gekappte
   * Liste, die wie eine vollständige aussieht, ist eine falsche Antwort.
   */
  async paginate<T = any>(
    template: string,
    query: Record<string, QueryValue>,
    maxItems = 200,
  ): Promise<{ items: T[]; total: number | null; truncated: boolean; pages: number }> {
    const want = Math.max(1, maxItems);
    // sevdesk erlaubt bis 1000 pro Seite, empfiehlt in derselben Doku aber 10–100 und
    // begründet das mit der Antwortzeit. 100 ist der größte Wert, den sie selbst nennen.
    const size = Math.min(PAGE_SIZE, want);
    const items: T[] = [];
    let total: number | null = null;
    let pages = 0;

    for (let offset = 0; ; offset += size) {
      const page = await this.callWithTotal<T>("GET", template, {
        query: { ...query, limit: size, offset, countAll: true },
      });
      pages++;
      items.push(...page.objects);
      if (page.total !== null) total = page.total;

      if (items.length >= want) break;
      // Eine kürzere Seite als angefordert heißt: mehr gibt es nicht.
      if (page.objects.length < size) break;
      if (pages > 40) break; // Reißleine
    }

    const kept = items.slice(0, want);
    // `countAll` liefert die Gesamtzahl mit — damit ist „abgeschnitten" keine Vermutung.
    // Ohne sie bleibt nur der Rückschluss aus dem, was tatsächlich geholt wurde.
    const truncated = total !== null ? total > kept.length : items.length > kept.length || pages > 40;
    return { items: kept, total, truncated, pages };
  }

  /**
   * Prüft den Token und liefert zurück, in welcher Buchhaltungswelt das Konto lebt.
   *
   * Das ist keine Zierde: mit dem sevdesk-Update 2.0 hat `taxRule` das alte `taxType`
   * abgelöst. Wer die falsche Angabe schickt, bekommt 422 — oder, schlimmer, einen Beleg
   * mit falscher Steuerregel. Deshalb steht die Version schon beim Verbinden fest.
   */
  async whoami(): Promise<{ version: string; accounts: number }> {
    const v = await this.call<any>("GET", "/Tools/bookkeepingSystemVersion");
    const version = String(v?.version ?? "");
    if (version !== "1.0" && version !== "2.0") {
      throw new SevdeskError(
        "sevdesk antwortet auf die Versionsabfrage nicht wie erwartet. " +
          "Ist der Token vollständig (32 Hexzeichen) und aus dem richtigen Konto?",
        v,
      );
    }
    const accounts = await this.call<any[]>("GET", "/CheckAccount", { query: { limit: 100 } });
    return { version, accounts: Array.isArray(accounts) ? accounts.length : 0 };
  }
}

/** Statuscodes in Klartext, damit das Modell weiß, was zu tun ist. */
function explain(status: number, op: string, detail: unknown): string {
  const message =
    typeof detail === "object" && detail !== null
      ? ((detail as any).error?.message ?? (detail as any).message ?? "")
      : "";
  const suffix = message ? ` sevdesk sagt: ${String(message).slice(0, 300)}` : "";
  switch (status) {
    case 401:
      return `sevdesk lehnt den Token ab (401). Der Token gehört zu keinem aktiven Benutzer mehr.${suffix}`;
    case 403:
      return `Keine Berechtigung für ${op} (403). Der Benutzer hinter dem Token darf das nicht.${suffix}`;
    case 404:
      return `Nicht gefunden: ${op} (404).${suffix}`;
    case 422:
      return (
        `sevdesk weist die Daten zurück (422) bei ${op}. Typischerweise passen Steuerregel, ` +
        `Steuersatz und Buchungskonto nicht zusammen — 'booking_accounts' zeigt die erlaubten ` +
        `Kombinationen.${suffix}`
      );
    case 429:
      return (
        `sevdesk drosselt (429) bei ${op} — auch nach mehreren Wiederholungen. ` +
        `Die Grenze gilt pro Minute und ist nicht veröffentlicht; kleineres limit oder ` +
        `engerer Zeitraum hilft.${suffix}`
      );
    case 500:
      return (
        `sevdesk meldet einen internen Fehler (500) bei ${op}. Die Doku sagt selbst, dass ` +
        `dahinter oft ein nicht abgefangener Eingabefehler steckt — Werte prüfen.${suffix}`
      );
    default:
      return `sevdesk HTTP ${status} bei ${op}.${suffix}`;
  }
}
