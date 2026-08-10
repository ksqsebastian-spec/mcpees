/**
 * FLOWWER MCP Server — Rechnungsfreigabe im Chat.
 *
 * Grundlage ist die öffentliche Doku auf hilfe.flowwer.de. Verifiziert sind dort der
 * Auth-Header `X-FLOWWER-ApiKey`, `POST /api/v1/upload`,
 * `GET|PUT /api/v1/documents/{id}/receiptsplits` und das OData-Reporting unter
 * `/odata/reporting` mit `Documents` und `DocumentsWithReceiptSplits`.
 *
 * Die Feldliste ist NICHT öffentlich dokumentiert — sie steht im `$metadata` des Kontos
 * und wird zur Laufzeit gelesen. Genauso die restlichen Endpunkte: statt Pfade zu raten,
 * liest 'api_erkunden' die OpenAPI-Beschreibung des Mandanten.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { composeLogo, FLOWWER_MARK } from "../../../shared/src/marks";
import { Flowwer, normalizeAccount } from "./client";
import { tools } from "./tools";
import type { ToolContext } from "./context";

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "FLOWWER MCP",
    system: "FLOWWER",
    tagline: "Rechnungsfreigabe für Claude",
    accent: FLOWWER_MARK.accent,
    logoSvg: composeLogo(FLOWWER_MARK),
    fields: [
      {
        name: "account",
        label: "Kontokennung",
        placeholder: "z. B. musterbau (der Teil vor .flowwer.de)",
        secret: false,
      },
      {
        name: "apiKey",
        label: "API-Key",
        placeholder: "Schlüssel des API-Benutzers",
      },
    ],
    credentialHelp:
      "Beides steht in FLOWWER: die Kontokennung in der Adresszeile " +
      "(<code>https://<b>kennung</b>.flowwer.de</code>), den Schlüssel legst du unter " +
      "<b>Benutzerverwaltung → API-Benutzer</b> an. Ein API-Benutzer kann sich nicht an der " +
      "Oberfläche anmelden und bekommt nur die Rechte, die du ihm gibst — gib ihm nur " +
      "Leserechte, dann kann über diesen Server auch nichts anderes passieren.",
    summary: "Model-Context-Protocol-Server für FLOWWER —",
    bullets: [
      "<b>Lesen</b> — Dokumente suchen, Belegaufteilungen, Auswertungen nach Lieferant, " +
        "Stufe oder Kostenstelle, Feld- und Endpunktübersicht des eigenen Kontos",
      "<b>Schreiben</b> — Dokumente hochladen, damit der Freigabe-Workflow startet",
      "<b>Nicht enthalten</b> — Ändern und Löschen. Auch das Ersetzen von " +
        "Belegaufteilungen bleibt draußen, obwohl die API es könnte.",
    ],
  },
  serverInfo: {
    name: "flowwer",
    title: "FLOWWER Rechnungsfreigabe",
    version: "1.0.0",
    websiteUrl: "https://www.flowwer.de",
  },
  scopes: "flowwer:read flowwer:write",
  instructions:
    "FLOWWER — Rechnungsfreigabe und Belegworkflow im Gespräch. 6 Tools (Lesen · Upload), " +
    "kein Ändern und kein Löschen. Drei Dinge vorweg: (1) Jedes Konto hat eigene Felder; " +
    "vor dem ersten Filtern 'felder_auflisten' aufrufen statt Feldnamen zu raten. " +
    "(2) Die Werte von currentStage und paymentState sind mandantenspezifisch — sie ergeben " +
    "sich aus den Daten, nicht aus einer festen Liste. (3) FLOWWER dokumentiert öffentlich " +
    "nur einen Teil seiner API; was das konkrete Konto sonst noch anbietet, zeigt " +
    "'api_erkunden'. Einstieg: „welche Rechnungen liegen gerade wo?\" (auswertung mit " +
    "gruppiere_nach=currentStage). Datumsangaben immer als 'YYYY-MM-DD'.",
  tools,

  async validate({ account, apiKey }) {
    const konto = normalizeAccount(account);
    const who = await new Flowwer(konto, apiKey).whoami();
    return {
      account: konto,
      user: who.entitySets.length ? `${who.entitySets.length} Collections lesbar` : "API-Benutzer",
    };
  },

  async context({ account, apiKey }, kv) {
    const konto = normalizeAccount(account);
    return { flw: new Flowwer(konto, apiKey), kv, cacheSalt: apiKey };
  },
};

export default createWorker(config);
