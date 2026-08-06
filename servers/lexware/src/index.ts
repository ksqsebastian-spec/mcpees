/**
 * Lexware Office MCP Server.
 *
 * Der API-Katalog (Endpunkte, Statussemantik, Fallen) stammt inhaltlich aus
 * github.com/JannikWempe/mcp-lexware-office (MIT, © Jannik Wempe) und der offiziellen
 * Doku auf developers.lexware.io. Die Umsetzung hier ist eine andere: dort ein
 * stdio-Prozess mit QuickJS-Sandbox und zwei generischen Tools, hier ein remote
 * erreichbarer Worker mit OAuth 2.1 und benannten Tools — passend zum Rest dieses Repos.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { Lexware } from "./client";
import { serveFile } from "./files";
import { readTools } from "./tools/read";
import { writeTools } from "./tools/write";
import type { ToolContext } from "./context";

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#00A03C"/>
<path fill="#fff" d="M152 128 h64 v198 h124 v58 H152 Z"/>
<path fill="#fff" d="M300 128 h68 l-44 74 44 74 h-68 l-44-74 Z" opacity=".55"/></svg>`;

const tools = [...readTools, ...writeTools];

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "Lexware Office MCP",
    system: "Lexware",
    tagline: "Buchhaltung für Claude",
    accent: "#00A03C",
    logoSvg: LOGO,
    credentialLabel: "Lexware-API-Key",
    credentialPlaceholder: "Public-API-Key aus Lexware Office",
    credentialHelp:
      'Den Key erzeugst du in Lexware Office unter <b>Einstellungen → Public API</b> ' +
      '(<a href="https://app.lexware.de/addons/public-api">app.lexware.de/addons/public-api</a>). ' +
      "Die Public API setzt <b>Lexware Office XL</b> voraus. Widerrufen kannst du den Zugriff " +
      "jederzeit, indem du den Key dort löschst.",
    summary: "Model-Context-Protocol-Server für Lexware Office —",
    bullets: [
      "<b>Lesen</b> — Firmenprofil, Kontakte, Belege aller Art, Belegdetails, PDF-Links, " +
        "Artikel, Zahlungen, offene Posten, Umsatzauswertung, Stammdaten",
      "<b>Schreiben</b> — Kontakte, Artikel, Rechnungen, Angebote, Auftragsbestätigungen, " +
        "Gutschriften, Lieferscheine, Mahnungen, Buchungsbelege, Dateien",
      "<b>Nicht enthalten</b> — Ändern und Löschen. Lexware sperrt Änderungen optimistisch " +
        "über ein version-Feld; wer es falsch mitschickt, überschreibt fremde Änderungen.",
    ],
  },
  serverInfo: {
    name: "lexware-office",
    title: "Lexware Office",
    version: "1.0.0",
    websiteUrl: "https://www.lexware.de/lexware-office/",
  },
  scopes: "lexware:read lexware:write",
  instructions:
    "Lexware Office — Buchhaltung und Rechnungswesen im Gespräch. 17 Tools (Lesen · Anlegen · " +
    "Upload · Download), kein Ändern und kein Löschen. Drei Dinge, die man wissen muss: " +
    "(1) Rechnungen und andere Belege listet man über list_vouchers, nicht über eine eigene " +
    "Rechnungsliste. (2) Die erlaubten Statuswerte hängen von der Belegart ab; ein falscher " +
    "Wert liefert bei Lexware keine Fehlermeldung, sondern eine leere Liste — dieser Server " +
    "prüft ihn deshalb vorher. (3) Lexware erlaubt nur 2 Anfragen pro Sekunde, große " +
    "Auswertungen dauern also spürbar; Zeiträume lieber eingrenzen. " +
    "Einstieg: „wer schuldet uns noch was?\" (open_items) oder „Umsatz letztes Quartal\" (revenue). " +
    "Datumsangaben immer als 'YYYY-MM-DD'.",
  tools,

  async validate(credential) {
    const who = await new Lexware(credential).whoami();
    return { account: who.company, user: who.user };
  },

  async context(credential, kv, origin) {
    return { lex: new Lexware(credential), credential, kv, origin };
  },

  extraRoutes: serveFile,
};

export default createWorker(config);
