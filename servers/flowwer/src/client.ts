/**
 * Client für die FLOWWER-REST-API.
 *
 * Zwei Besonderheiten prägen ihn:
 *
 *  1. **Die Basis-URL gehört dem Mandanten.** Jedes Konto liegt unter seiner eigenen
 *     Kontokennung: `https://<kontokennung>.flowwer.de`. Deshalb fragt die Anmeldung
 *     zwei Dinge ab, nicht nur einen Schlüssel.
 *  2. **Der öffentlich dokumentierte Teil der API ist klein.** Verifiziert sind
 *     `POST /api/v1/upload`, `GET|PUT /api/v1/documents/{id}/receiptsplits` und das
 *     OData-Reporting. Alles Weitere steht nur im Swagger des jeweiligen Kontos.
 *     Dieser Server rät deshalb keine Pfade, sondern liest die Spezifikation des
 *     Mandanten und sagt, was dort wirklich angeboten wird.
 *
 * Authentifiziert wird mit dem Header `X-FLOWWER-ApiKey` (kein Bearer).
 */

export const AUTH_HEADER = "X-FLOWWER-ApiKey";

export class FlowwerError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "FlowwerError";
  }
}

/** Kontokennung säubern: erlaubt ist die Kennung, nicht die ganze URL. */
export function normalizeAccount(raw: string): string {
  const s = String(raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.flowwer\.de$/i, "")
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(s)) {
    throw new FlowwerError(
      `'${raw}' sieht nicht wie eine FLOWWER-Kontokennung aus. Erwartet wird der Teil vor ` +
        `.flowwer.de, also z. B. 'musterbau' bei https://musterbau.flowwer.de.`,
    );
  }
  return s;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  form?: FormData;
  accept?: string;
}

export class Flowwer {
  readonly base: string;
  calls = 0;

  constructor(
    readonly account: string,
    private readonly apiKey: string,
  ) {
    this.base = `https://${account}.flowwer.de`;
  }

  async request(path: string, opts: RequestOptions = {}): Promise<Response> {
    const url = new URL(path.startsWith("/") ? path : `/${path}`, this.base);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      [AUTH_HEADER]: this.apiKey,
      Accept: opts.accept ?? "application/json",
    };
    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form;
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    this.calls++;
    try {
      return await fetch(url.toString(), { method: opts.method ?? "GET", headers, body });
    } catch (e) {
      throw new FlowwerError(
        `${this.base} nicht erreichbar: ${(e as Error).message}. Stimmt die Kontokennung?`,
      );
    }
  }

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
      throw new FlowwerError(explain(res.status, path), detail);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FlowwerError(`FLOWWER lieferte kein JSON für ${path}`, text.slice(0, 300));
    }
  }

  /** Prüft Kennung und Schlüssel, indem der OData-Dienst gelesen wird. */
  async whoami(): Promise<{ account: string; entitySets: string[] }> {
    const res = await this.request("/odata/reporting/");
    if (res.status === 401 || res.status === 403) {
      throw new FlowwerError(
        `FLOWWER lehnt den API-Key für '${this.account}' ab (HTTP ${res.status}). ` +
          `Stimmen Kontokennung und Schlüssel zusammen, und darf der API-Benutzer lesen?`,
      );
    }
    if (res.status === 404) {
      throw new FlowwerError(
        `Unter https://${this.account}.flowwer.de gibt es kein OData-Reporting (404). ` +
          `Entweder ist die Kontokennung falsch oder das Reporting ist nicht freigeschaltet.`,
      );
    }
    if (!res.ok) throw new FlowwerError(explain(res.status, "/odata/reporting/"));

    const text = await res.text();
    let sets: string[] = [];
    try {
      const doc = JSON.parse(text);
      sets = (doc.value ?? []).map((v: any) => v.name ?? v.url).filter(Boolean);
    } catch {
      /* Der Servicekatalog ist nicht überall JSON — das ist kein Fehlgrund. */
    }
    return { account: this.account, entitySets: sets };
  }
}

function explain(status: number, path: string): string {
  switch (status) {
    case 401:
    case 403:
      return (
        `FLOWWER verweigert den Zugriff auf ${path} (${status}). Der API-Benutzer hat für ` +
        `diesen Aufruf keine Berechtigung — Rechte stehen in der Benutzerverwaltung.`
      );
    case 404:
      return (
        `${path} gibt es bei diesem Konto nicht (404). Welche Endpunkte das Konto anbietet, ` +
        `zeigt das Tool 'api_erkunden'.`
      );
    case 400:
      return `FLOWWER lehnt die Anfrage an ${path} ab (400) — meist ein ungültiger Filter.`;
    default:
      return `FLOWWER HTTP ${status} bei ${path}.`;
  }
}
