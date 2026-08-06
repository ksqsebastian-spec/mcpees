/**
 * Der Vertrag zwischen dem gemeinsamen Gerüst (OAuth, MCP-Protokoll, Seiten) und einem
 * konkreten Server. Ein neuer MCP-Server ist damit: Tools schreiben, Zugangsdaten prüfen,
 * Kontext bauen — der Rest kommt aus `shared`.
 */

export interface Env {
  OAUTH_KV: KVNamespace;
  HUB_URL?: string;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Ein Tool darf entweder Daten zurückgeben (werden als JSON-Text ausgeliefert) oder
 * fertige MCP-Content-Blöcke, wenn es etwas anderes als Text braucht.
 */
export interface ToolDef<Ctx> {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  handler: (args: Record<string, any>, ctx: Ctx) => Promise<unknown>;
}

/** Aussehen und Wortlaut der Anmeldeseite. */
export interface Brand {
  name: string;
  /** Name des Fremdsystems, wie er in Meldungen vorkommt — "HERO", "Lexware Office". */
  system: string;
  tagline: string;
  accent: string;
  /** Inline-SVG, quadratisch. Wird als Favicon und Logo benutzt. */
  logoSvg: string;
  /** Beschriftung des Eingabefelds, z. B. "HERO-API-Key". */
  credentialLabel: string;
  /** Platzhalter im Eingabefeld. */
  credentialPlaceholder: string;
  /** Erklärtext unter dem Formular — wo man den Schlüssel herbekommt. */
  credentialHelp: string;
  /** Kurzbeschreibung für die Startseite. */
  summary: string;
  /** Stichpunkte für die Startseite. */
  bullets: string[];
}

export interface ServerConfig<Ctx> {
  brand: Brand;
  serverInfo: { name: string; title: string; version: string; websiteUrl: string };
  instructions: string;
  scopes: string;
  tools: ToolDef<Ctx>[];
  /**
   * Prüft die Zugangsdaten gegen das Fremdsystem. Muss werfen, wenn sie ungültig sind —
   * die Meldung landet sichtbar auf der Anmeldeseite. Es wird NIE ein Token ausgestellt,
   * bevor das hier durchgelaufen ist.
   */
  validate(credential: string): Promise<{ account: string; user: string }>;
  /**
   * Baut den Kontext, den die Tool-Handler bekommen. Läuft pro Request.
   * `origin` ist die öffentliche Basis-URL dieses Workers — nötig, wenn ein Tool Links
   * auf sich selbst erzeugt (z. B. Datei-Downloads).
   */
  context(credential: string, kv: KVNamespace, origin: string): Promise<Ctx>;
  /** Zusätzliche Routen (z. B. Datei-Auslieferung). null = nicht zuständig. */
  extraRoutes?: (request: Request, url: URL, env: Env) => Promise<Response | null>;
}

export const str = (description: string) => ({ type: "string", description });
export const int = (description: string) => ({ type: "integer", description });
export const num = (description: string) => ({ type: "number", description });
export const bool = (description: string) => ({ type: "boolean", description });

/** Pflichtargument prüfen, bevor ein Request rausgeht. */
export function req<T>(args: Record<string, any>, name: string): T {
  const v = args[name];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Pflichtargument '${name}' fehlt.`);
  }
  return v as T;
}
