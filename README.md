# mcpees

OAuth-geschützte MCP-Server auf Cloudflare Workers — plus die Übersichtsseite, die sie auflistet.

| | URL |
|---|---|
| Übersicht aller Server | https://mcp-hub.ksqsebastian.workers.dev |
| HERO MCP (Endpoint für Claude) | https://hero-mcp.ksqsebastian.workers.dev/mcp |
| Lexware Office MCP | https://lexware-mcp.ksqsebastian.workers.dev/mcp |
| Tarifcheck MCP | https://tarifcheck.ksqsebastian.workers.dev/mcp |

Der Vorgänger auf Vercel (`hero-mcp.vercel.app`) ist am 06.08.2026 abgeschaltet worden und
antwortet auf jeden Aufruf mit HTTP 410 samt Verweis auf den neuen Endpoint. Aus der Übersicht
ist er entfernt; der 410-Stub bleibt für alle, die noch die alte URL eingetragen haben.

## Was hier drin ist

```
shared/           OAuth-Server, MCP-Protokoll, Gestaltung — von allen Servern benutzt
servers/hero/     HERO-Handwerkersoftware, 34 Tools
servers/lexware/  Lexware Office, 17 Tools
hub/              Übersichtsseite: alle Server, alle Tools, live vom Server geholt
scripts/          Build, Schema-Validierung, Tests, Deployment
```

Ein neuer Server besteht aus drei Dingen: Tools schreiben, Zugangsdaten prüfen, Kontext
bauen. OAuth, MCP-Protokoll, Anmeldeseite und Routing kommen aus `shared` — siehe
`shared/src/types.ts` für den Vertrag und `servers/lexware/src/index.ts` als kürzestes Beispiel.

## HERO MCP

Ein Model-Context-Protocol-Server für [HERO](https://hero-software.de). 17 lesende und
17 schreibende Tools. Bearbeiten und Löschen gibt es bewusst nicht — kein Tool kann
bestehende Daten überschreiben.

**Mehrmandantenfähig.** Der Server hat keinen HERO-Key. Beim Verbinden öffnet sich eine
Anmeldeseite, auf der jeder Nutzer seinen eigenen HERO-API-Key hinterlegt. Der Key wird
gegen HERO geprüft und dann verschlüsselt in KV abgelegt — mit einem Schlüssel, der aus
dem ausgestellten OAuth-Token abgeleitet ist. Wer nur die KV-Daten hat, sieht Chiffretext.

Die mandantenspezifischen IDs (Projekttyp, Pipeline-Stufen, Dokumenttypen,
Terminkategorien, Maßnahmen, die eigene partner_id) werden pro Zugang aus HERO abgeleitet
und 12 Stunden zwischengespeichert. Nichts davon steht im Code.

### OAuth

Vollständiger Authorization Server im Worker, ohne Fremdbibliothek:

- RFC 8414 Authorization Server Metadata, RFC 9728 Protected Resource Metadata
- RFC 7591 Dynamic Client Registration (Claude registriert sich selbst)
- RFC 7636 PKCE mit S256 — Pflicht, nicht optional
- Refresh-Token-Rotation, Einmal-Auth-Codes, RFC 7009 Revocation

## Lexware Office MCP

17 Tools für [Lexware Office](https://www.lexware.de/lexware-office/): Kontakte, Belege aller
Art, Auswertungen, Buchungsbelege, Dateien. Wie bei HERO nur Lesen und Anlegen — Lexware
sperrt Änderungen optimistisch über ein `version`-Feld, und wer das falsch mitschickt,
überschreibt fremde Änderungen.

Auth ist auch hier ein eigener API-Key pro Nutzer: Lexwares OAuth2 gibt es nur im
Partner-Programm mit bilateraler Qualifizierung, die Public API kennt nur Bearer-Keys.
Sie setzt **Lexware Office XL** voraus; kleinere Tarife antworten mit HTTP 402.

Drei Eigenheiten prägen die Umsetzung:

- **2 Anfragen pro Sekunde.** Härter, als es klingt: darüber kommt 429, und der
  Authorization-Server sperrt zeitweise. Der Client hält den Abstand selbst ein — die Drossel
  liegt auf Modulebene und pro API-Key, nicht am Client-Objekt, sonst würde sie bei jedem
  Tool-Aufruf zurückgesetzt.
- **Falscher Belegstatus = leere Liste.** `voucherStatus` ist je Belegart eine andere
  geschlossene Liste. Lexware meldet einen ungültigen Wert nicht, es kommt einfach nichts
  zurück — also eine falsche Antwort, die wie eine richtige aussieht. Der Server prüft vorher.
- **Keine öffentlichen Dokumentlinks.** PDFs gibt es nur gegen den API-Key. Statt Base64 ins
  Gespräch zu legen, erzeugt der Server einen eigenen, kurzlebigen Link und liefert die Datei
  selbst aus; der Key dahinter ist mit dem Link-Token verschlüsselt.

Der API-Katalog — welche Endpunkte es gibt, welche Statuswerte gelten, wo die Fallen liegen —
stammt aus [JannikWempe/mcp-lexware-office](https://github.com/JannikWempe/mcp-lexware-office)
(MIT, © Jannik Wempe) und der offiziellen Doku. Dessen Server ist ein stdio-Prozess mit
QuickJS-Sandbox und zwei generischen Tools (`search`, `execute`); hier sind es benannte Tools
hinter OAuth, damit er als Remote-Connector zum Rest dieses Repos passt.

Ein FLOWWER-Server (Rechnungsfreigabe) lag hier ebenfalls, ist aber am 10.08.2026 wieder
entfernt worden — samt Worker und KV-Namensraum. Die eine Sache, die davon bleibt:
`Brand.fields` nimmt seither eine *Liste* von Eingabefeldern statt eines einzelnen, weil
FLOWWERs Basis-URL dem Mandanten gehörte und die Anmeldung zwei Felder brauchte. HERO und
Lexware deklarieren dort schlicht eines.

## Korrektheit ohne Live-Zugang

Die HERO-API meldet bei mehreren Operationen Erfolg und verwirft dabei still Daten. Der
Skill `hero-api` dokumentiert diese Fallen; sie sind hier eingebaut statt kommentiert:
Mutations laufen ausnahmslos über GraphQL-Variablen, Schreibvorgänge werden zurückgelesen,
Artikel bekommen zwingend `sales_prices` + `default_sales_price` (sonst kalkuliert HERO mit
dem Einkaufspreis), Checklisten-Einträge werden nach dem Anlegen nachgezählt.

Zwei Prüfungen laufen bei jedem Build, weil ohne HERO-Key kein Tool ausführbar ist:

```bash
npm run validate   # jede GraphQL-Operation gegen HEROs Introspection-Schema
npm run typecheck
```

`scripts/validate-queries.mjs` parst die 42 Operationen im Quelltext und prüft jedes Feld
und jedes Argument gegen `servers/hero/schema/hero-schema.json`. Zusätzlich prüft der
Client zur Laufzeit die Feldnamen jedes Input-Objekts gegen eine generierte Karte
(`scripts/gen-input-fields.mjs`) — ein `productId` statt `product_id` fliegt auf, bevor
ein Request rausgeht.

`npm test` fährt beide Server gegen Attrappen von KV und Fremdsystem:

- **19 Prüfungen HERO** — kompletter OAuth-Flow: Code-Tausch, PKCE, Einmalgebrauch des Codes,
  Refresh-Rotation, Widerruf, ein echter `tools/call`, und dass weder Key noch Token im
  Klartext in KV landen.
- **30 Prüfungen Lexware** — dazu die Rechenlogik (Umsatz gestellt/bezahlt, offene Posten,
  Überfälligkeit), die Statusprüfung, die Paginierung über mehrere Seiten, der eingehaltene
  Mindestabstand von 2 Anfragen/Sekunde und der Download-Link samt Ablauf.

Der Ratenbegrenzungs-Test hat dabei einen echten Fehler gefunden: die Drossel lag anfangs am
Client-Objekt und startete bei jedem Tool-Aufruf neu, sodass zwei Tools nacheinander ihre
Requests im Abstand von 4 ms abgefeuert hätten.

## Bauen und deployen

```bash
npm install
npm run build     # generiert, validiert, typisiert, bündelt beide Worker
npm test          # kompletter OAuth-Flow gegen den Bundle, mit KV- und HERO-Attrappe

export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
node scripts/deploy.mjs servers/hero/wrangler.jsonc servers/hero/dist/worker.js
node scripts/deploy.mjs hub/wrangler.jsonc hub/dist/worker.js
```

Die Bindings liest das Deploy-Skript aus `wrangler.jsonc`, weil die Cloudflare-API bei
jedem Upload *alle* Bindings ersetzt — ein vergessenes Flag löscht sonst still ein Binding.
Mit installiertem Wrangler geht auch `npx wrangler deploy --config servers/hero/wrangler.jsonc`.

## Logos

`shared/src/marks.ts` hält die offiziellen Herstellerzeichen — unverändert, in den
Originalfarben, direkt von den Anbietern:

| | Quelle |
|---|---|
| HERO | `hero-software.de/assets/img/static/logos/hero-logomark-dark.svg` |
| Lexware | `app.lexware.de/favicon.svg` |

Vorher standen dort Nachbauten. Das ist die schlechteste Variante: es sieht aus wie die
Marke, ist aber keine. Entweder das echte Zeichen oder ein neutrales.

`composeLogo()` setzt ein Zeichen mittig auf eine abgerundete Fläche — dasselbe Bild dient
als Favicon und als Kachel. HERO steht auf seinem Gelb, Lexware auf Weiß mit Haarlinie —
so, wie die Anbieter es selbst zeigen. Nebenbefund beim Nachschlagen: Lexware ist rot
(#FF4554), nicht grün — das Grün war altes lexoffice-Branding.

Die Logos kennzeichnen das angebundene System, mehr nicht. Der Fuß jeder Seite sagt, dass
es fremde Marken sind und dass dies keine offiziellen Integrationen der Anbieter sind.

## Gestaltung

Ein Stylesheet für alles: `shared/src/style.ts`. Viel Weiß, wenige Farben, harte Kontraste
bei der Schrift, Haarlinien statt Schatten. Die Akzentfarbe gehört dem jeweiligen System
(HERO gelb, Lexware rot) und kommt nur in kleinen Flächen vor — die Seiten selbst bleiben
schwarzweiß.

Bewegung gibt es nur dort, wo sie etwas bedeutet: Inhalt tritt beim Laden gestaffelt ein,
Karten heben sich beim Überfahren, der Kopierknopf quittiert. Nichts blinkt, nichts bewegt
sich von allein weiter, und `prefers-reduced-motion` schaltet alles ab.

Die Übersichtsseite erklärt zuerst, was ein MCP überhaupt ist — sie richtet sich an Kollegen,
die den Begriff zum ersten Mal lesen, nicht an Entwickler.

## Einen Server aufnehmen

`hub/src/registry.ts` um einen Eintrag ergänzen und in `hub/wrangler.jsonc` das passende
Service-Binding eintragen. Die Tool-Liste wird nicht in der Registry gepflegt, sondern zur
Laufzeit vom Server geholt (`/tools.json` oder `tools/list`), damit die Übersicht nicht
auseinanderläuft.

Der Server muss nicht aus diesem Repo kommen — **Tarifcheck** liegt in einem eigenen Repo
und wird nur eingetragen. Nötig ist von ihm nur ein `/tools.json` im bekannten Format;
`auth` und `mcpUrl` darin sind optional, der Hub nutzt sie nicht.

Trägt ein Server nur lesende oder nur schreibende Tools, fällt der jeweils leere Abschnitt
auf der Detailseite weg, und die Übersicht schreibt „nur lesend" statt „6 lesend,
0 schreibend". Der Markenhinweis im Fuß nennt die Anbieter, die in der Registry als
`thirdPartyBrand` markiert sind — eigene Dienste stehen dort nicht.
