/**
 * HERO MCP Server. Alles Protokollarische (OAuth, MCP, Seiten) kommt aus `shared`;
 * hier steht nur, was HERO ausmacht.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { composeLogo, HERO_MARK } from "../../../shared/src/marks";
import { Hero } from "./hero";
import { getConfig } from "./tenant";
import { tools } from "./tools";
import type { ToolContext } from "./context";

const LOGO = composeLogo(HERO_MARK);

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "HERO MCP",
    system: "HERO",
    tagline: "Handwerkersoftware für Claude",
    accent: HERO_MARK.accent,
    logoSvg: LOGO,
    credentialLabel: "HERO-API-Key",
    credentialPlaceholder: "Bearer-Token aus HERO → Einstellungen → API",
    credentialHelp:
      "Den Key findest du in HERO unter <b>Einstellungen → API</b>. Der Zugriff gilt genau für " +
      "diesen Client und lässt sich jederzeit widerrufen, indem du den Key in HERO neu erzeugst.",
    summary:
      "Model-Context-Protocol-Server für die HERO-Handwerkersoftware —",
    bullets: [
      "<b>Lesen</b> — Dashboard, Suche, Projekte, Kunden, Dokumente, Artikel, Lager, Aufträge, " +
        "Checklisten, Termine, Zeiten, offene Posten, Zahlungsstatus, Belege, PDF-Links",
      "<b>Schreiben</b> — Kunden, Projekte, Angebote, Rechnungen, Stundenzettel, Aufträge, " +
        "Checklisten, Artikel, Termine, Aufgaben, Zeiten, Logbuch, Zahlungen, Leads, Dateien",
      "<b>Nicht enthalten</b> — Bearbeiten und Löschen. Nichts kann kaputtgehen.",
    ],
  },
  serverInfo: {
    name: "hero",
    title: "HERO Handwerkersoftware",
    version: "2.1.0",
    websiteUrl: "https://hero-software.de",
  },
  scopes: "hero:read hero:write",
  instructions:
    "HERO Handwerkersoftware — bringe deinen Betrieb direkt in den Chat. Frage Projekte, Kunden, " +
    "Termine, Aufträge und offene Posten ab, erstelle Angebote, Rechnungen, Abschlags- und " +
    "Schlussrechnungen, Stundenzettel und Aufträge, lade Dateien hoch und hole PDF-Links — alles " +
    "im Gespräch. 34 Tools (Lesen · Erstellen · Upload · Download), kein Bearbeiten oder Löschen: " +
    "nichts kann kaputtgehen. Einstieg: „was ist heute los?\" (dashboard) oder „wer schuldet uns " +
    "noch was?\" (list_open_invoices). Zeitangaben immer als ISO MIT Offset, Datumsangaben als " +
    "'YYYY-MM-DD'.",
  tools,

  async validate(credential) {
    const who = await new Hero(credential).whoami();
    return { account: who.company, user: who.user };
  },

  async context(credential, kv) {
    const hero = new Hero(credential);
    return { hero, cfg: await getConfig(kv, hero, credential), kv };
  },
};

export default createWorker(config);
