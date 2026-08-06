/**
 * Die Liste der MCP-Server, die diese Seite zeigt.
 *
 * Neuen Server aufnehmen = hier einen Eintrag ergänzen. Die Tools werden NICHT hier
 * gepflegt, sondern zur Laufzeit vom Server selbst geholt (`catalog`), damit die Übersicht
 * nicht auseinanderläuft, sobald jemand ein Tool ändert.
 */
import { HERO_MARK, LEXWARE_MARK, type Mark } from "../../shared/src/marks";

export interface ServerEntry {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Basis-URL ohne Pfad. */
  origin: string;
  /** Der Endpoint, den man in Claude einträgt. */
  mcpUrl: string;
  auth: "oauth" | "none";
  status: "aktiv" | "abgeschaltet";
  /** Offizielles Herstellerzeichen. Fehlt es, wird der Buchstabe genommen. */
  mark?: Mark;
  accent: string;
  icon: string;
  /**
   * Woher der Tool-Katalog kommt:
   *   "tools.json" — GET {origin}/tools.json (unser Format, kein Login nötig)
   *   "mcp"        — POST {mcpUrl} mit tools/list (nur bei Servern ohne Auth möglich)
   *   "none"       — nicht abfragen (abgeschaltete Server)
   */
  catalog: "tools.json" | "mcp" | "none";
  /**
   * Name eines Service-Bindings auf denselben Worker. Cloudflare lässt einen Worker nicht
   * per fetch() an einen anderen Worker derselben Zone (beide auf workers.dev) — solche
   * Aufrufe scheitern mit Fehler 1042. Das Service-Binding ist der vorgesehene Weg und
   * spart obendrein den Umweg übers Netz.
   */
  binding?: string;
  notes?: string[];
}

export const REGISTRY: ServerEntry[] = [
  {
    id: "hero",
    name: "HERO",
    tagline: "Handwerkersoftware",
    description:
      "Projekte, Kunden, Angebote, Rechnungen, Termine, Zeiten und Field-Service aus HERO " +
      "direkt im Chat. Lesen und Anlegen — kein Bearbeiten, kein Löschen.",
    origin: "https://hero-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://hero-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: HERO_MARK,
    accent: HERO_MARK.accent,
    icon: "H",
    catalog: "tools.json",
    binding: "HERO",
    notes: [
      "OAuth 2.1 mit PKCE — jeder Nutzer hinterlegt beim Verbinden seinen eigenen HERO-API-Key.",
      "Mehrmandantenfähig: dieselbe URL funktioniert für mehrere Betriebe.",
      "Der API-Key wird verschlüsselt abgelegt; entschlüsseln kann ihn nur der Token-Inhaber.",
    ],
  },
  {
    id: "lexware",
    name: "Lexware Office",
    tagline: "Buchhaltung",
    description:
      "Kontakte, Rechnungen, Angebote, Mahnungen, Buchungsbelege und Auswertungen aus " +
      "Lexware Office. Lesen und Anlegen — kein Ändern, kein Löschen.",
    origin: "https://lexware-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://lexware-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: LEXWARE_MARK,
    accent: LEXWARE_MARK.accent,
    icon: "L",
    catalog: "tools.json",
    binding: "LEXWARE",
    notes: [
      "OAuth 2.1 mit PKCE — jeder Nutzer hinterlegt beim Verbinden seinen eigenen Lexware-API-Key.",
      "Die Public API von Lexware setzt Lexware Office XL voraus; kleinere Tarife " +
        "antworten mit HTTP 402.",
      "Lexware erlaubt nur 2 Anfragen pro Sekunde. Der Server hält den Abstand selbst ein, " +
        "große Auswertungen dauern deshalb spürbar.",
      "PDFs bekommen einen zeitlich begrenzten Link von diesem Server — Lexware selbst " +
        "kennt keine öffentlichen Dokumentlinks.",
      "Der API-Katalog stammt aus github.com/JannikWempe/mcp-lexware-office (MIT).",
    ],
  },
];

export const byId = new Map(REGISTRY.map((s) => [s.id, s]));
