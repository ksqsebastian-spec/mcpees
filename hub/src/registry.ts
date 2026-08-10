/**
 * Die Liste der MCP-Server, die diese Seite zeigt.
 *
 * Neuen Server aufnehmen = hier einen Eintrag ergänzen. Die Tools werden NICHT hier
 * gepflegt, sondern zur Laufzeit vom Server selbst geholt (`catalog`), damit die Übersicht
 * nicht auseinanderläuft, sobald jemand ein Tool ändert.
 */
import { HERO_MARK, SEVDESK_MARK, type Mark } from "../../shared/src/marks";

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
  /**
   * Fremde Marke eines Drittanbieters. Steuert den Hinweis im Seitenfuß — der soll
   * genau die Namen nennen, die uns nicht gehören, und nicht fest verdrahtet sein.
   */
  thirdPartyBrand?: boolean;
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

/**
 * Tarifcheck ist ein eigener Dienst, keine fremde Marke — das Zeichen ist deshalb frei
 * gewählt: drei Balken, der letzte kürzer, wie Absätze in einem Vertragstext.
 */
const TARIF_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="#ffffff">' +
    '<rect x="10" y="16" width="44" height="7" rx="3.5"/>' +
    '<rect x="10" y="29" width="44" height="7" rx="3.5"/>' +
    '<rect x="10" y="42" width="26" height="7" rx="3.5"/></g></svg>',
  bg: "#1F7A5C",
  accent: "#1F7A5C",
  fill: 0.62,
};

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
    thirdPartyBrand: true,
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
    id: "sevdesk",
    name: "sevdesk",
    tagline: "Buchhaltung",
    description:
      "Kontakte, Ausgangsrechnungen, Eingangsbelege, Angebote, Artikel, Bankumsätze und " +
      "Auswertungen aus sevdesk. Lesen und Anlegen — kein Ändern, kein Löschen, kein Buchen.",
    origin: "https://sevdesk-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://sevdesk-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: SEVDESK_MARK,
    thirdPartyBrand: true,
    accent: SEVDESK_MARK.accent,
    icon: "S",
    catalog: "tools.json",
    binding: "SEVDESK",
    notes: [
      "OAuth 2.1 mit PKCE — jeder Nutzer hinterlegt beim Verbinden seinen eigenen " +
        "sevdesk-API-Token (32 Hexzeichen, aus Einstellungen → Benutzer).",
      "Der Token erbt die Rechte seines Benutzers. Wer nur lesen lassen will, legt in " +
        "sevdesk einen eigenen Benutzer mit Leserechten an.",
      "Jeder Aufruf wird vor dem Absenden gegen die offizielle API-Beschreibung geprüft. " +
        "sevdesk lehnt unbekannte Filter nämlich nicht ab, sondern ignoriert sie — die " +
        "Antwort wäre sonst ungefiltert und sähe richtig aus.",
      "Seit dem sevdesk-Update 2.0 heißt die Steuerregel taxRule statt taxType. Der Server " +
        "fragt die Version des Kontos ab und schickt die passende Angabe.",
      "PDFs bekommen einen zeitlich begrenzten Link von diesem Server — sevdesk liefert sie " +
        "nur als base64 gegen den Token aus.",
      "Die eingefrorene API-Beschreibung stammt aus github.com/nikolausm/mcp-sevdesk (MIT).",
    ],
  },
  {
    id: "tarifcheck",
    name: "Tarifcheck",
    tagline: "Tarifverträge",
    description:
      "Die Tarifverträge der Gruppenwerk-Gewerke — Bau, Gerüstbau, Maler, Tischler. " +
      "Täglich automatisch abgeglichen, jede Fassung archiviert. Nur lesend.",
    origin: "https://tarifcheck.ksqsebastian.workers.dev",
    mcpUrl: "https://tarifcheck.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: TARIF_MARK,
    accent: TARIF_MARK.accent,
    icon: "T",
    catalog: "tools.json",
    binding: "TARIFCHECK",
    notes: [
      "Eigene Anmeldung mit Benutzer und Passwort — dieselbe wie auf der Seite. " +
        "Kein externer Anbieter dahinter.",
      "Ausschließlich lesend. Hochladen und Quellen ändern geht nur über die Seite selbst.",
      "Jede Antwort führt mit, von wann die Fassung ist und ob sie allgemeinverbindlich " +
        "ist. Beim Maler-Rahmentarifvertrag kursieren ältere Fassungen — ohne diesen " +
        "Vorbehalt wäre eine Zahl daraus wertlos.",
      "Für das Tischlerhandwerk gibt es keine Allgemeinverbindlicherklärung und damit " +
        "keine öffentliche Volltextquelle. Überwacht wird dort nur die Downloadseite; " +
        "der Vertragstext wird von Hand hochgeladen.",
    ],
  },
];

export const byId = new Map(REGISTRY.map((s) => [s.id, s]));
