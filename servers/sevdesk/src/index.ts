/**
 * sevdesk MCP Server.
 *
 * Grundlage ist die offizielle OpenAPI-Beschreibung der sevdesk API v1. Sie liegt
 * eingefroren unter servers/sevdesk/schema/sevdesk-api.json und stammt aus
 * github.com/nikolausm/mcp-sevdesk (MIT, © Michael Nikolaus) — dort ein stdio-Prozess mit
 * generiertem Client und Tools zum Ändern, Buchen und Löschen. Hier ist es ein remote
 * erreichbarer Worker mit OAuth 2.1, und geschrieben wird ausschließlich Neues.
 *
 * Der Client prüft jeden Aufruf gegen diese Beschreibung, bevor er rausgeht. Das ist bei
 * sevdesk kein Luxus: unbekannte Query-Parameter werden nicht abgelehnt, sondern ignoriert.
 * Ein Tippfehler im Filternamen kostet also keine Fehlermeldung, sondern die Filterwirkung —
 * die Antwort ist falsch und sieht richtig aus.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { composeLogo, SEVDESK_MARK } from "../../../shared/src/marks";
import { Sevdesk } from "./client";
import { serveFile } from "./files";
import { readTools } from "./tools/read";
import { writeTools } from "./tools/write";
import type { ToolContext } from "./context";

const tools = [...readTools, ...writeTools];

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "sevdesk MCP",
    system: "sevdesk",
    tagline: "Buchhaltung für Claude",
    accent: SEVDESK_MARK.accent,
    logoSvg: composeLogo(SEVDESK_MARK),
    fields: [
      {
        name: "apiToken",
        label: "sevdesk-API-Token",
        placeholder: "32 Hexzeichen",
      },
    ],
    credentialHelp:
      "Den Token findest du in sevdesk unter <b>Einstellungen → Benutzer → dein Benutzer → " +
      "API-Token</b>. Er ist 32 Zeichen lang und gilt unbegrenzt. Der Token hängt am " +
      "Benutzer und erbt dessen Rechte — wer nur lesen lassen will, legt dafür einen eigenen " +
      "Benutzer an. Zurückziehen kannst du den Zugriff jederzeit, indem du in sevdesk einen " +
      "neuen Token erzeugst; der alte gilt dann nicht mehr.",
    summary: "Model-Context-Protocol-Server für sevdesk —",
    bullets: [
      "<b>Lesen</b> — Kontakte, Rechnungen, Eingangsbelege, Angebote und Aufträge, Artikel, " +
        "Bankkonten und Umsätze, Umsatzauswertung, offene Posten, erlaubte Buchungskonten, PDF-Links",
      "<b>Anlegen</b> — Kontakte, Artikel, Rechnungsentwürfe, Eingangsbelege, Belegdateien",
      "<b>Nicht enthalten</b> — Ändern, Löschen, Buchen, Versenden, Stornieren und " +
        "Festschreiben. Festschreiben ist bei sevdesk aus rechtlichen Gründen unwiderruflich.",
    ],
  },
  serverInfo: {
    name: "sevdesk",
    title: "sevdesk Buchhaltung",
    version: "1.0.0",
    websiteUrl: "https://sevdesk.de",
  },
  scopes: "sevdesk:read sevdesk:write",
  instructions:
    "sevdesk — Buchhaltung im Gespräch. 21 Tools (Lesen · Anlegen · Upload · Download), " +
    "kein Ändern, kein Löschen, kein Buchen und kein Versenden. Vier Dinge vorweg: " +
    "(1) 'system_info' zuerst — seit dem sevdesk-Update 2.0 heißt die Steuerregel taxRule " +
    "statt taxType, und davon hängt jedes Anlegen ab. (2) sevdesk trennt Ausgangsrechnungen " +
    "(Invoice) von Eingangsbelegen (Voucher); „Rechnung vom Lieferanten\" ist ein Voucher. " +
    "(3) Vor create_voucher immer 'booking_accounts' aufrufen — passen Konto, Steuerregel " +
    "und Steuersatz nicht zusammen, lehnt sevdesk mit 422 ab. (4) Rechnungen entstehen hier " +
    "immer als Entwurf; verschickt und gebucht wird in sevdesk selbst. " +
    "Einstieg: „wer schuldet uns noch was?\" (open_items) oder „Umsatz letztes Quartal\" " +
    "(revenue). Datumsangaben immer als 'YYYY-MM-DD'.",
  tools,

  async validate({ apiToken }) {
    const token = String(apiToken ?? "").trim();
    // sevdesk-Tokens sind 32 Hexzeichen. Das hier abzufangen spart einen Aufruf und
    // erklärt den Fehler besser, als es ein 401 könnte.
    if (!/^[0-9a-fA-F]{32}$/.test(token)) {
      throw new Error(
        "Der sevdesk-API-Token besteht aus genau 32 Hexzeichen (0–9, a–f). " +
          "Er steht in sevdesk unter Einstellungen → Benutzer → API-Token.",
      );
    }
    const who = await new Sevdesk(token).whoami();
    return {
      account: `sevdesk ${who.version}`,
      user: who.accounts === 1 ? "1 Bankkonto" : `${who.accounts} Bankkonten`,
    };
  },

  async context({ apiToken }, kv, origin) {
    const token = String(apiToken).trim();
    return { sev: new Sevdesk(token), credential: token, kv, origin };
  },

  extraRoutes: serveFile,
};

export default createWorker(config);
