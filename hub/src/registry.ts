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
 * Tarifcheck ist ein eigener Dienst, keine fremde Marke. Das Zeichen ist trotzdem nicht
 * frei gewählt, sondern das, was die Anwendung selbst führt: zwei versetzte Blätter mit
 * Häkchen — ein geprüfter Vertrag. Hier stand vorher ein anderes (drei Balken auf
 * #1F7A5C); zwei Zeichen für einen Dienst sind eines zu viel.
 *
 * Übernommen sind nur die drei Formen, ohne die Fläche darunter — die baut composeLogo.
 * viewBox und fill sind aus dem Original abgemessen (Elemente von 9/9 bis 51/55, im
 * Original mit scale .62 auf 64), damit die Kachel dieselben Proportionen hat wie das
 * Zeichen im Browser-Tab und nicht nur so ähnlich aussieht.
 */
const TARIF_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="9 9 42 46">' +
    '<rect x="9" y="9" width="32" height="40" rx="5" fill="#fff" opacity=".62"/>' +
    '<rect x="19" y="15" width="32" height="40" rx="5" fill="#fff"/>' +
    '<path fill="none" stroke="#0E7A55" stroke-width="6.5" stroke-linecap="round" ' +
    'stroke-linejoin="round" d="M26 35.5l6 6 12-12.5"/></svg>',
  bg: "#0E7A55",
  accent: "#0E7A55",
  fill: 0.446,
};

/**
 * Mikdaten ist ein eigener Dienst. Das Zeichen ist die Bildmarke der Anwendung selbst:
 * zwei Giebel mit Fenstern und Tor, die zusammen ein M ergeben — dasselbe 12x10-Raster
 * wie in der Anwendung. Dort nimmt das Dach die Textfarbe an; auf der Kachel ist es fest
 * weiß, weil ein Data-URI die Variablen der Seite nicht kennt.
 */
const MIKDATEN_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10" shape-rendering="crispEdges">' +
    '<g fill="#ffffff">' +
    '<rect x="2" y="0" width="2" height="1"/><rect x="8" y="0" width="2" height="1"/>' +
    '<rect x="1" y="1" width="4" height="1"/><rect x="7" y="1" width="4" height="1"/>' +
    '<rect x="0" y="2" width="12" height="1"/><rect x="0" y="3" width="12" height="1"/>' +
    '<rect x="2" y="5" width="2" height="1"/><rect x="8" y="5" width="2" height="1"/>' +
    '<rect x="2" y="6" width="2" height="1"/><rect x="8" y="6" width="2" height="1"/>' +
    '<rect x="5" y="8" width="2" height="1"/><rect x="5" y="9" width="2" height="1"/></g>' +
    '<g fill="#FF4A1C">' +
    '<rect x="0" y="4" width="12" height="1"/>' +
    '<rect x="0" y="5" width="2" height="1"/><rect x="4" y="5" width="4" height="1"/>' +
    '<rect x="10" y="5" width="2" height="1"/>' +
    '<rect x="0" y="6" width="2" height="1"/><rect x="4" y="6" width="4" height="1"/>' +
    '<rect x="10" y="6" width="2" height="1"/>' +
    '<rect x="0" y="7" width="12" height="1"/>' +
    '<rect x="0" y="8" width="5" height="1"/><rect x="7" y="8" width="5" height="1"/>' +
    '<rect x="0" y="9" width="5" height="1"/><rect x="7" y="9" width="5" height="1"/></g></svg>',
  bg: "#0A0A0A",
  accent: "#FF4A1C",
  fill: 0.6,
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
  {
    id: "mikdaten",
    name: "Mikdaten",
    tagline: "Immobilienverwaltung",
    description:
      "Kanban-Board, Objektakten, Kontakte, Termine und Dokumente der Immobilienverwaltung. " +
      "Lesen, Neues anlegen und Aufgaben durchs Board bewegen.",
    origin: "https://mikdaten.ksqsebastian.workers.dev",
    mcpUrl: "https://mikdaten.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: MIKDATEN_MARK,
    accent: MIKDATEN_MARK.accent,
    icon: "M",
    catalog: "tools.json",
    binding: "MIKDATEN",
    notes: [
      "Eigene Anmeldung mit Benutzername und Passwort — dieselbe wie auf der Seite. " +
        "Kein externer Anbieter dahinter.",
      "Der Server läuft im Worker der Anwendung selbst, nicht als eigener Dienst. Er sieht " +
        "dieselben Daten, ohne Kopie und ohne Zwischenschicht.",
      "Jede Anfrage läuft mit den Rechten der angemeldeten Person; Kommentare erscheinen " +
        "unter deren Namen.",
      "Anlegen und Fortschreiben ist erlaubt: Aufgaben verschieben, erledigen, " +
        "kommentieren, Checklisten abhaken, Objektdaten fortschreiben. Gelöscht wird nichts.",
      "Personen und Objekte dürfen als Name, Benutzername oder Objektnummer angegeben " +
        "werden, nicht nur als ID.",
      "Verbundene Anwendungen stehen in Mikdaten unter Einstellungen → KI-Anbindung und " +
        "lassen sich dort einzeln trennen.",
    ],
  },
];

export const byId = new Map(REGISTRY.map((s) => [s.id, s]));
