/**
 * Die Liste der MCP-Server, die diese Seite zeigt.
 *
 * Neuen Server aufnehmen = hier einen Eintrag ergänzen. Die Tools werden NICHT hier
 * gepflegt, sondern zur Laufzeit vom Server selbst geholt (`catalog`), damit die Übersicht
 * nicht auseinanderläuft, sobald jemand ein Tool ändert.
 */
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
    accent: "#FFC400",
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
    id: "hero-vercel",
    name: "HERO (alt)",
    tagline: "abgeschaltet",
    description:
      "Die erste Fassung des HERO-Servers lief auf Vercel ohne Authentifizierung und mit " +
      "fest verdrahtetem API-Key für genau einen Mandanten. Abgeschaltet am 06.08.2026 — " +
      "der Endpoint antwortet jetzt mit HTTP 410 und verweist auf die Cloudflare-Fassung.",
    origin: "https://hero-mcp.vercel.app",
    mcpUrl: "https://hero-mcp.vercel.app/mcp",
    auth: "none",
    status: "abgeschaltet",
    accent: "#8b8b93",
    icon: "H",
    catalog: "none",
    notes: [
      "Antwortet auf jeden Aufruf mit 410 Gone und nennt den neuen Endpoint.",
      "Bewusst kein Redirect: ein MCP-Client kann dem neuen Endpoint nicht folgen, " +
        "er müsste sich dort erst per OAuth anmelden.",
      "Die alten Deployments liegen weiter im Vercel-Projekt — ein Rollback ist möglich.",
    ],
  },
];

export const byId = new Map(REGISTRY.map((s) => [s.id, s]));
