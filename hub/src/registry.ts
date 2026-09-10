/**
 * Die Liste der MCP-Server, die diese Seite zeigt.
 *
 * Neuen Server aufnehmen = hier einen Eintrag ergänzen. Die Tools werden NICHT hier
 * gepflegt, sondern zur Laufzeit vom Server selbst geholt (`catalog`), damit die Übersicht
 * nicht auseinanderläuft, sobald jemand ein Tool ändert.
 */
import { HERO_MARK, SEVDESK_MARK, DOCUWARE_MARK, type Mark } from "../../shared/src/marks";

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

/**
 * Türwerk führt ein eigenes Zeichen: das Türsymbol aus dem Grundriss — Wand, offen stehendes
 * Blatt, Schwenkbogen. Wer Baupläne liest, erkennt es sofort; als Bildmarke führt es sonst
 * niemand. Dieselben drei Pfade stehen im Worker selbst, damit Kachel und Favicon übereinstimmen.
 */
const TUERWERK_MARK: Mark = {
  inner:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52">' +
    '<g fill="none" stroke="#fff">' +
    '<path stroke-width="9" stroke-linecap="butt" d="M0 46h14M50 46h14"/>' +
    '<path stroke-width="9" stroke-linecap="round" d="M14 46V10"/>' +
    '<path stroke-width="5" stroke-linecap="round" opacity=".85" d="M14 10a36 36 0 0 1 36 36"/>' +
    '</g></svg>',
  bg: "#1B54D6",
  accent: "#1B54D6",
  fill: 0.72,
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
    id: "docuware",
    name: "DocuWare",
    tagline: "Dokumentenarchiv",
    description:
      "Aktenschränke durchsuchen, Dokumente samt Indexfeldern ansehen, den OCR-Volltext " +
      "lesen und Neues ablegen. Kein Ändern, kein Löschen.",
    origin: "https://docuware-mcp.ksqsebastian.workers.dev",
    mcpUrl: "https://docuware-mcp.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: DOCUWARE_MARK,
    thirdPartyBrand: true,
    accent: DOCUWARE_MARK.accent,
    icon: "D",
    catalog: "tools.json",
    binding: "DOCUWARE",
    notes: [
      "OAuth 2.1 mit PKCE — jeder Nutzer hinterlegt beim Verbinden seinen eigenen Zugang: " +
        "entweder ein DocuWare-Benutzerkonto oder eine App-Registrierung mit Client-ID und " +
        "Secret. Beides ist von DocuWare vorgesehen, beides geht über dasselbe Formular.",
      "Der Zugang erbt die Rechte, die in DocuWare vergeben sind. Ein Aktenschrank, den der " +
        "Benutzer nicht sehen darf, taucht hier gar nicht erst auf.",
      "Es wird kein Endpunktpfad zusammengebaut. Die Platform-API gibt jeden nächsten " +
        "Schritt als Link in der vorigen Antwort vor; gefolgt wird genau dem — ein " +
        "geratener Pfad funktioniert auf einem DocuWare-Stand und auf dem nächsten nicht.",
      "Feldnamen dürfen der API-Name (DOCDATE) oder die Bezeichnung (Belegdatum) sein. Wer " +
        "die Bezeichnung an DocuWare durchreicht, bekommt sonst 400 ohne Hinweis, welcher " +
        "Name es hätte sein sollen.",
      "Klammern in einem Suchwert werden maskiert. Ohne das sind sie Syntax, und die " +
        "Trefferliste wäre falsch, ohne dass eine Fehlermeldung darauf hinweist.",
      "Dateien kommen nie als base64 ins Gespräch, sondern über einen Link auf Zeit von " +
        "diesem Server. Für den Inhalt gibt es den OCR-Volltext ohne Umweg über die Datei.",
      "Das Wissen über diese API stammt aus github.com/sniner/docuware-client (BSD-3-Clause).",
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
  {
    id: "tuerwerk",
    name: "Türwerk",
    tagline: "Türenwartung",
    description:
      "Die Türenwartung von Seehafer Elemente — vor Ort diktiert, hier gesammelt, am Ende " +
      "fertige Wartungsprotokolle als PDF. Drehflügeltüren, Fenster, Feststellanlagen.",
    origin: "https://tuerwerk.ksqsebastian.workers.dev",
    mcpUrl: "https://tuerwerk.ksqsebastian.workers.dev/mcp",
    auth: "oauth",
    status: "aktiv",
    mark: TUERWERK_MARK,
    accent: TUERWERK_MARK.accent,
    icon: "T",
    catalog: "tools.json",
    binding: "TUERWERK",
    notes: [
      "Eigene Anmeldung mit Benutzer und Passwort — dieselbe wie auf der Seite. " +
        "Kein externer Anbieter dahinter.",
      "Gedacht fürs Diktat am Handy: der Monteur spricht, jede Tür wird sofort geschrieben. " +
        "Bricht das Gespräch ab, ist nichts verloren — weiter geht es mit derselben Kennung.",
      "Standard ist „alles in Ordnung“; genannt werden nur die Abweichungen, als Punkt-Nummer " +
        "aus der jeweiligen Vorlage. Was eine Nummer bedeutet, liefert 'pruefpunkte'.",
      "Die Protokolle entstehen im Worker selbst: die Original-Formulare werden mit den " +
        "erfassten Werten überdruckt und in R2 abgelegt, einzeln oder als ZIP abrufbar.",
      "Die Unterschrift kommt aus dem Konto dessen, der die Wartung angelegt hat. Fehlt sie, " +
        "bleibt das Feld leer — der Bericht entsteht trotzdem.",
      "Gelöscht wird über den Server nichts.",
    ],
  },
];

export const byId = new Map(REGISTRY.map((s) => [s.id, s]));
