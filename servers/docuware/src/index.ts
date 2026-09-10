/**
 * DocuWare MCP Server.
 *
 * DocuWare veröffentlicht für seine Platform-API keine Beschreibung, aus der sich ein
 * Client bauen ließe: die offizielle Doku nennt Postman-Sammlungen und ein XSD, aber weder
 * Endpunktpfade noch die Gestalt einer Suchanfrage. Die Grundlage hier ist deshalb der
 * Quelltext von sniner/docuware-client (BSD-3-Clause, © Stefan Schönberger) — eine
 * gepflegte Python-Bibliothek, die genau dieses Wissen trägt. Übernommen ist das Wissen,
 * nicht der Code: dort ein Python-Paket mit CLI und Anmeldedatei auf der Platte, hier ein
 * remote erreichbarer Worker mit OAuth 2.1 und ohne Dateisystem.
 *
 * Zwei Entscheidungen prägen diesen Server:
 *
 *  - **Es wird gefolgt, nicht gebaut.** Die Platform-API ist HATEOAS; jeder nächste Schritt
 *    steht als `Links: [{rel, href}]` in der vorigen Antwort. Kein Pfad wird hier
 *    zusammengesetzt — ein geratener Pfad funktioniert auf einem Stand und auf dem
 *    nächsten nicht mehr, und in der Cloud sieht er ohnehin anders aus.
 *  - **Kein Ändern, kein Löschen.** Wie bei den anderen Servern dieses Repos. Bei einem
 *    Archiv wiegt das schwerer als anderswo: es lebt davon, dass niemand nachträglich
 *    daran dreht.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { composeLogo, DOCUWARE_MARK } from "../../../shared/src/marks";
import { DOCUWARE_ICON } from "../../../shared/src/icons.generated";
import { Docuware, platformUrl } from "./client";
import { structure } from "./structure";
import { serveFile } from "./files";
import { readTools } from "./tools/read";
import { writeTools } from "./tools/write";
import type { ToolContext } from "./context";

const tools = [...readTools, ...writeTools];

/** Die drei Eingaben der Anmeldeseite zu einem geprüften Zugang machen. */
function credentialsOf(raw: Record<string, string>) {
  return {
    url: platformUrl(raw.url),
    username: String(raw.username ?? "").trim(),
    password: String(raw.password ?? ""),
  };
}

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "DocuWare MCP",
    system: "DocuWare",
    tagline: "Das Archiv für Claude",
    accent: DOCUWARE_MARK.accent,
    logoSvg: composeLogo(DOCUWARE_MARK),
    icon: DOCUWARE_ICON,
    fields: [
      {
        name: "url",
        label: "DocuWare-URL",
        placeholder: "firma.docuware.cloud",
        // Die Adresse steht in jedem Browser-Tab; als Punktereihe hilft sie niemandem.
        secret: false,
      },
      {
        name: "username",
        label: "Benutzername oder Client-ID",
        placeholder: "m.mustermann",
        secret: false,
      },
      {
        name: "password",
        label: "Passwort oder Client-Secret",
      },
    ],
    credentialHelp:
      "Es geht beides. <b>Entweder</b> ein DocuWare-Benutzerkonto — dieselben Zugangsdaten " +
      "wie im Browser. Der Zugang erbt dann genau dessen Rechte: Aktenschränke, die dieser " +
      "Benutzer nicht sehen darf, tauchen hier gar nicht erst auf. <b>Oder</b> eine " +
      "App-Registrierung aus <b>DocuWare Konfiguration → Integrationen → App " +
      "Registrierungen</b>; dann kommen Client-ID (eine GUID) und Client-Secret in dieselben " +
      "beiden Felder. Das ist der sauberere Weg: so ein Zugang lässt sich einzeln " +
      "zurückziehen, ohne dass jemand sein Passwort ändern muss. Als URL genügt der " +
      "Mandantenname — aus „firma“ wird firma.docuware.cloud. " +
      "Vorausgesetzt ist DocuWare 7.10 oder neuer; davor gab es dort kein OAuth.",
    summary: "Model-Context-Protocol-Server für DocuWare —",
    bullets: [
      "<b>Finden</b> — Aktenschränke, Indexfelder und Auswahllisten anzeigen, Dokumente über " +
        "ihre Indexfelder suchen, einzelne Dokumente samt Anhängen ansehen",
      "<b>Lesen</b> — den OCR-Volltext eines Dokuments direkt ins Gespräch holen, ohne die " +
        "Datei herunterzuladen; für die Datei selbst gibt es einen Link auf Zeit",
      "<b>Ablegen</b> — neue Dokumente mit Indexfeldern anlegen und Dateien anhängen",
      "<b>Nicht enthalten</b> — Ändern und Löschen. Indexfelder korrigieren und Dokumente " +
        "entfernen geht in DocuWare selbst, mit Protokoll und Rechten.",
    ],
  },
  serverInfo: {
    name: "docuware",
    title: "DocuWare Dokumentenmanagement",
    version: "1.0.0",
    websiteUrl: "https://docuware.com",
  },
  scopes: "docuware:read docuware:write",
  instructions:
    "DocuWare — das Dokumentenarchiv im Gespräch. 10 Tools (Finden · Lesen · Ablegen), " +
    "kein Ändern und kein Löschen. Drei Dinge vorweg: " +
    "(1) Die Reihenfolge ist 'file_cabinets' → 'index_fields' → 'search_documents'. " +
    "Feldnamen zu raten geht schief: auf dem Bildschirm heißt das Feld „Belegdatum“, die " +
    "API kennt nur DOCDATE — 'index_fields' zeigt beide, und beide sind hier erlaubt. " +
    "(2) Ein Aktenschrank ist das Archiv, ein Briefkorb der Posteingang davor. Beide stehen " +
    "in derselben Liste; gesucht wird in Aktenschränken. " +
    "(3) Dateien kommen nie als base64 ins Gespräch, sondern als Link auf Zeit " +
    "('download_link'). Wer nur wissen will, was drinsteht, nimmt 'document_text' — das " +
    "liefert den OCR-Text ohne Umweg über die Datei. " +
    "Einstieg: „welche Aktenschränke gibt es?“ oder „finde die Rechnungen von Müller aus " +
    "dem ersten Quartal“. Datumsangaben immer als 'YYYY-MM-DD'.",
  tools,

  async validate(raw) {
    const credentials = credentialsOf(raw);
    if (!credentials.username) throw new Error("Es fehlt der Benutzername oder die Client-ID.");
    if (!credentials.password) throw new Error("Es fehlt das Passwort oder das Client-Secret.");

    // Ohne KV: beim Prüfen gibt es noch kein Token, unter dem sich etwas ablegen ließe.
    const dw = new Docuware(credentials, null);
    const struct = await structure(dw, null);
    const schraenke = struct.cabinets.filter((c) => !c.isBasket).length;

    return {
      account: `${struct.organizationName} (DocuWare ${struct.version})`,
      user:
        (dw.grant === "client_credentials" ? "App-Registrierung" : credentials.username) +
        ` · ${schraenke === 1 ? "1 Aktenschrank" : `${schraenke} Aktenschränke`}`,
    };
  },

  async context(raw, kv, origin) {
    return { dw: new Docuware(credentialsOf(raw), kv), kv, origin };
  },

  extraRoutes: serveFile,
};

export default createWorker(config);
