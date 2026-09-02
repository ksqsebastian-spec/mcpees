/**
 * Plausible MCP Server.
 *
 * Grundlage ist die Stats API v2 von Plausible Analytics (plausible.io/docs/stats-api).
 * Der Zuschnitt der Tools ist an getsentry/plausible-mcp angelehnt (MIT) — dort ein
 * Node-Prozess mit dem offiziellen MCP-SDK, zod und Sentry-Telemetrie, wahlweise über
 * stdio oder als Worker hinter Cloudflare Access. Übernommen ist davon die Einteilung
 * (Verlauf, Aufschlüsselung, Ziele, Vergleich) und das Wissen um die Fallen der API,
 * kein Quelltext: hier läuft alles auf dem gemeinsamen Gerüst aus `shared`, ohne
 * Laufzeit-Abhängigkeiten und mit eigenem OAuth statt Cloudflare Access.
 *
 * Ausschließlich lesend. Die Stats API kann nichts verändern, also gibt es hier auch
 * nichts abzusichern — anders als bei HERO und sevdesk fehlt tools/write.ts nicht aus
 * Vorsicht, sondern weil es nichts zu schreiben gibt.
 */
import { createWorker } from "../../../shared/src/worker";
import type { ServerConfig } from "../../../shared/src/types";
import { composeLogo, PLAUSIBLE_MARK } from "../../../shared/src/marks";
import { PLAUSIBLE_ICON } from "../../../shared/src/icons.generated";
import { Plausible, PlausibleError } from "./client";
import { readTools } from "./tools/read";
import type { ToolContext } from "./context";

const config: ServerConfig<ToolContext> = {
  brand: {
    name: "Plausible MCP",
    system: "Plausible",
    tagline: "Web-Statistik für Claude",
    accent: PLAUSIBLE_MARK.accent,
    logoSvg: composeLogo(PLAUSIBLE_MARK),
    icon: PLAUSIBLE_ICON,
    /*
     * Zwei Felder, nicht eines: die Stats API kennt keinen Endpunkt, der ohne Angabe
     * einer Seite antwortet, und die Sites API — die die Seiten eines Kontos auflisten
     * könnte — gibt es nur im Enterprise-Tarif. Ohne eine Domain wüsste der Server also
     * weder, wogegen er den Key prüfen soll, noch was er ohne nähere Angabe abfragen soll.
     *
     * Es ist aber eine VORGABE, keine Bindung: jedes Tool nimmt ein optionales 'site'.
     * Wer zehn Seiten hat, braucht trotzdem nur diese eine Verbindung. Das muss die
     * Beschriftung hergeben — stand hier nur „Domain der Seite", las sich das wie eine
     * Verbindung je Seite.
     */
    fields: [
      {
        name: "apiKey",
        label: "Plausible-API-Key",
        placeholder: "beginnt mit  plausible-",
        secret: true,
      },
      {
        name: "site",
        label: "Standard-Seite (Domain)",
        placeholder: "example.com",
      },
    ],
    credentialHelp:
      "Den Key erzeugst du in Plausible unter <b>Account Settings → API Keys → New API " +
      "Key</b> (Typ <b>Stats API</b>). Er wird nur einmal angezeigt. " +
      "<b>Eine Verbindung reicht für alle deine Seiten.</b> Die Domain hier ist bloß die " +
      "Vorgabe für Fragen ohne Ortsangabe — jede andere Seite, die der Key sehen darf, " +
      "fragst du einfach mit Namen ab („Besucher von kunde-b.de letzte Woche\"). Trag sie " +
      "genau so ein, wie sie in Plausible steht: ohne <code>https://</code> und ohne " +
      "Schrägstrich am Ende, also <code>example.com</code>. Welche Seiten es in deinem " +
      "Konto gibt, kann dieser Server nicht auflisten — dafür bräuchte es die Sites API, " +
      "und die gibt Plausible nur im Enterprise-Tarif frei. Der Key liest nur; schreibende " +
      "Aufrufe bietet die Stats API gar nicht an. Zurückziehen kannst du den Zugriff " +
      "jederzeit, indem du den Key in Plausible löschst.",
    summary: "Model-Context-Protocol-Server für Plausible Analytics —",
    bullets: [
      "<b>Überblick</b> — Besucher, Seitenaufrufe, Absprungrate und Verweildauer für " +
        "jeden Zeitraum, wahlweise auf eine Seite oder ein Ziel eingegrenzt",
      "<b>Verlauf</b> — dieselben Kennzahlen über die Zeit, in Stunden, Tagen, Wochen " +
        "oder Monaten; dafür da, Ausschläge einem Datum zuzuordnen",
      "<b>Aufschlüsselung</b> — nach Seite, Herkunft, Kanal, Land, Gerät, Browser, " +
        "UTM-Parametern oder einer eigenen Ereignis-Eigenschaft",
      "<b>Ziele und Vergleich</b> — Zielerreichungen mit Rate, und zwei beliebige " +
        "Zeiträume nebeneinander samt Differenz",
      "<b>Mehrere Seiten</b> — eine Verbindung genügt. Die hinterlegte Domain ist nur die " +
        "Vorgabe; jedes Tool nimmt daneben eine beliebige andere Seite entgegen, die der " +
        "Key sehen darf.",
      "<b>Nicht enthalten</b> — alles Schreibende. Die Stats API von Plausible ist " +
        "ausschließlich lesend; es gibt nichts, was dieser Server verändern könnte.",
    ],
  },
  serverInfo: {
    name: "plausible",
    title: "Plausible Web-Statistik",
    version: "1.0.0",
    websiteUrl: "https://plausible.io",
  },
  scopes: "plausible:read",
  instructions:
    "Plausible — Web-Statistik im Gespräch. 5 Tools, alle lesend. Der Einstieg ist fast " +
    "immer 'overview' (die Eckwerte), danach 'breakdown' für das Warum und 'timeseries' " +
    "für das Wann. Vier Dinge vorweg: (1) Zeiträume sind entweder Kürzel ('7d', '30d', " +
    "'12mo', 'day', 'month', 'year', 'all') oder absolut als " +
    "'YYYY-MM-DD,YYYY-MM-DD' — dazwischen gibt es nichts. (2) Eine Vorgabe-Seite steckt " +
    "in den Zugangsdaten und gilt, wenn keine genannt wird; derselbe Key kann aber " +
    "mehrere Seiten sehen — für eine andere Domain einfach 'site' setzen, eine zweite " +
    "Verbindung braucht es nie. Welche Seiten es gibt, kann der Server nicht auflisten " +
    "(dafür wäre die Sites API nötig, die nur Enterprise hat) — im Zweifel nachfragen. " +
    "(3) conversion_rate rechnet gegen ein Ziel — ohne Ziel-Aufschlüsselung oder " +
    "Zielfilter ist sie nicht zu haben, dafür gibt es 'conversions'. (4) Ziele lassen " +
    "sich filtern, aber nicht ausschließen. " +
    "Absprungrate und Verweildauer sind Besuchs-Kennzahlen: zusammen mit einer " +
    "Seiten-Dimension beziehen sie sich auf den Besuch, der die Seite enthielt, nicht " +
    "auf die Seite allein.",
  tools: readTools,

  /**
   * Zugangsdaten prüfen.
   *
   * Beide Angaben werden gegen Plausible geprüft, nicht nur der Key: eine Abfrage auf die
   * genannte Domain scheitert mit 404, wenn es sie im Konto nicht gibt. Genau das ist der
   * häufigste Tippfehler beim Verbinden — 'https://example.com' oder 'www.example.com'
   * statt 'example.com' — und es würde sonst erst beim ersten Tool-Aufruf auffallen.
   */
  async validate({ apiKey, site }) {
    const key = String(apiKey ?? "").trim();
    const domain = String(site ?? "")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    if (!key) throw new PlausibleError("Ohne API-Key geht es nicht.");
    if (!domain) throw new PlausibleError("Die Domain der Plausible-Seite fehlt.");
    if (domain.includes("/")) {
      throw new PlausibleError(
        `'${domain}' enthält einen Pfad. Gemeint ist nur die Domain, also z. B. 'example.com'.`,
      );
    }

    const who = await new Plausible(key, domain).whoami();
    return {
      account: who.site,
      user: who.visitorsToday === 1 ? "1 Besucher heute" : `${who.visitorsToday} Besucher heute`,
    };
  },

  async context({ apiKey, site }) {
    const domain = String(site).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return { pl: new Plausible(String(apiKey).trim(), domain) };
  },
};

export default createWorker(config);
