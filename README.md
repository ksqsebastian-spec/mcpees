# mcpees

OAuth-geschützte MCP-Server auf Cloudflare Workers — plus die Übersichtsseite, die sie auflistet.

| | URL |
|---|---|
| Übersicht aller Server | https://mcp-hub.ksqsebastian.workers.dev |
| HERO MCP (Endpoint für Claude) | https://hero-mcp.ksqsebastian.workers.dev/mcp |
| sevdesk MCP | https://sevdesk-mcp.ksqsebastian.workers.dev/mcp |
| Tarifcheck MCP | https://tarifcheck.ksqsebastian.workers.dev/mcp |
| Mikdaten MCP | https://mikdaten.ksqsebastian.workers.dev/mcp |
| Türwerk MCP | https://tuerwerk.ksqsebastian.workers.dev/mcp |
| Plausible MCP | https://plausible-mcp.ksqsebastian.workers.dev/mcp |

Der Vorgänger auf Vercel (`hero-mcp.vercel.app`) ist am 06.08.2026 abgeschaltet worden und
antwortet auf jeden Aufruf mit HTTP 410 samt Verweis auf den neuen Endpoint. Aus der Übersicht
ist er entfernt; der 410-Stub bleibt für alle, die noch die alte URL eingetragen haben.

## Was hier drin ist

```
shared/           OAuth-Server, MCP-Protokoll, Gestaltung — von allen Servern benutzt
servers/hero/     HERO-Handwerkersoftware, 34 Tools
servers/sevdesk/  sevdesk-Buchhaltung, 21 Tools
servers/plausible/ Plausible-Web-Statistik, 5 Tools, nur lesend
hub/              Übersichtsseite: alle Server, alle Tools, live vom Server geholt
scripts/          Build, Schema-Validierung, Tests, Deployment
```

Ein neuer Server besteht aus drei Dingen: Tools schreiben, Zugangsdaten prüfen, Kontext
bauen. OAuth, MCP-Protokoll, Anmeldeseite und Routing kommen aus `shared` — siehe
`shared/src/types.ts` für den Vertrag und `servers/sevdesk/src/index.ts` als Beispiel.

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

## sevdesk MCP

21 Tools für [sevdesk](https://sevdesk.de): Kontakte, Ausgangsrechnungen, Eingangsbelege,
Angebote und Aufträge, Artikel, Bankkonten und Umsätze, Umsatzauswertung, offene Posten,
erlaubte Buchungskonten, PDF-Links. Angelegt werden Kontakte, Artikel, Rechnungsentwürfe,
Eingangsbelege und Belegdateien.

Nicht enthalten sind Ändern und Löschen — und darüber hinaus alles, was den Zustand eines
bestehenden Belegs verschiebt: buchen, versenden, stornieren, zurücksetzen, festschreiben.
Festschreiben ist bei sevdesk laut eigener Doku aus rechtlichen Gründen unwiderruflich; so
etwas gehört nicht in einen Chatverlauf.

Auth ist ein eigener API-Token pro Nutzer: 32 Hexzeichen aus *Einstellungen → Benutzer*.
Der Token hängt am Benutzer und erbt dessen Rechte — wer nur lesen lassen will, legt in
sevdesk einen Benutzer mit Leserechten an und nimmt dessen Token.

Vier Eigenheiten prägen die Umsetzung:

- **Unbekannte Filter werden ignoriert, nicht abgelehnt.** Ein Tippfehler in einem
  Query-Parameter kostet bei sevdesk keine Fehlermeldung, sondern die Filterwirkung: die
  Antwort kommt ungefiltert zurück und sieht völlig richtig aus. Deshalb prüft der Client
  jeden Aufruf gegen die eingefrorene API-Beschreibung, bevor er rausgeht — Pfad, Methode,
  Parametername und erlaubte Werte.
- **Filter auf Fremdobjekte brauchen zwei Parameter.** `contact[id]=17` allein filtert
  nichts; ohne `contact[objectName]=Contact` liefert sevdesk die ganze Liste. Dieselbe
  Falle, dieselbe Wirkung. `refQuery()` setzt grundsätzlich beide.
- **Datumsfilter sind Zeitstempel.** Bei Rechnungen, Belegen und Aufträgen heißen sie
  `startDate`/`endDate` und wollen Unix-Sekunden. Ein durchgereichtes `YYYY-MM-DD` ergibt
  keine Fehlermeldung, sondern eine unbrauchbare Liste.
- **taxRule oder taxType, je nach Konto.** Mit dem sevdesk-Update 2.0 hat `taxRule` das
  alte `taxType` abgelöst. Welche Welt gilt, sagt `/Tools/bookkeepingSystemVersion`; der
  Server fragt das ab und schickt die passende Angabe. Die falsche bedeutet 422 — oder
  einen Beleg mit falscher Steuerregel.

Dazu eine Lücke, die man nicht wegdiskutieren kann: sevdesk verlangt beim Anlegen
`contactPerson` (ein SevUser), `unity` (eine Einheit) und `addressCountry` (ein Land), hat
aber **für keines dieser drei Objekte einen Endpunkt zum Nachschlagen**. Es gibt kein
`/SevUser`, kein `/Unity`, kein `/StaticCountry`. Statt undokumentierte Pfade zu raten,
liest `servers/sevdesk/src/defaults.ts` die IDs mit `embed` aus dem neuesten vorhandenen
Beleg des Kontos und legt sie 12 Stunden ab — wie bei HERO die Mandanten-IDs. In einem
frischen Konto ohne jeden Beleg fehlt die Grundlage; dann sagt der Server das, statt eine
ID zu erfinden.

Die eingefrorene API-Beschreibung (`servers/sevdesk/schema/sevdesk-api.json`, 151
Operationen) stammt aus der offiziellen OpenAPI-Datei im Repo
[nikolausm/mcp-sevdesk](https://github.com/nikolausm/mcp-sevdesk) (MIT, © Michael
Nikolaus), auf Pfade, Methoden und Parameter eingedampft. Dessen Server ist ein
stdio-Prozess mit generiertem Client und Tools zum Ändern, Buchen und Löschen; hier ist es
ein remote erreichbarer Worker mit OAuth 2.1, und geschrieben wird ausschließlich Neues.

Vorher stand an dieser Stelle ein Server für **Lexware Office** (17 Tools). Er ist am
10.08.2026 abgelöst und samt Worker und KV-Namensraum gelöscht worden. Ein
**FLOWWER**-Server (Rechnungsfreigabe) lag hier ebenfalls und ist am selben Tag entfernt
worden. Was von FLOWWER bleibt: `Brand.fields` nimmt seither eine *Liste* von
Eingabefeldern statt eines einzelnen.

## Plausible MCP

Ein Server für die [Stats API v2](https://plausible.io/docs/stats-api) von Plausible
Analytics. Fünf Tools, **alle lesend** — anders als bei HERO und sevdesk fehlt das
Schreiben hier nicht aus Vorsicht, sondern weil die Stats API nichts anbietet, was etwas
verändern könnte.

| Tool | Wofür |
|---|---|
| `overview` | Eckwerte eines Zeitraums als eine Zeile |
| `timeseries` | dieselben Kennzahlen über die Zeit (Stunde/Tag/Woche/Monat) |
| `breakdown` | nach Seite, Herkunft, Kanal, Land, Gerät, UTM oder eigener Eigenschaft |
| `conversions` | Zielerreichungen mit Rate, wahlweise je Seite |
| `compare` | zwei beliebige Zeiträume nebeneinander, mit Differenz |

**Zwei Zugangsfelder — aber nur eine Verbindung, egal wie viele Seiten.** Die hinterlegte
Domain ist die *Vorgabe* für Fragen ohne Ortsangabe; jedes Tool nimmt daneben ein
optionales `site` und beantwortet damit jede Seite, die der Key sehen darf. Zehn Seiten
brauchen also keine zehn Verbindungen.

Dass die Vorgabe trotzdem Pflicht ist, hat zwei Gründe: die Stats API kennt keinen Aufruf
ohne Seitenangabe, und die [Sites API](https://plausible.io/docs/sites-api), mit der sich
die Seiten eines Kontos auflisten ließen, ist **Enterprise-only**. Der Server kann die
Domains also weder erraten noch abfragen. Beim Verbinden wird die Vorgabe mitgeprüft: eine
Seite, die es im Konto nicht gibt, fällt sofort auf statt beim ersten Tool-Aufruf.
`https://` und ein Schrägstrich am Ende werden abgeschnitten — das ist der häufigste
Tippfehler.

**Vier Fallen der API**, alle in `servers/plausible/src/client.ts` eingebaut statt
kommentiert:

1. Ein absoluter Zeitraum ist ein **Array**, kein `"von,bis"`. Die naheliegende
   Zeichenkette ergibt einen 400er, dessen Text die Ursache nicht nennt.
2. Ergebnisse sind **Parallel-Arrays** — die Namen stehen nur in der Anfrage. `zip()` setzt
   sie wieder an die Werte, sonst müsste der Leser Spalten zählen.
3. `conversion_rate` braucht einen **Ziel-Bezug**; ohne ihn lehnt Plausible ab, ohne zu
   sagen, was fehlt.
4. Ziele lassen sich **filtern, aber nicht ausschließen** — `is_not` auf `event:goal` ist
   ein 400er.

Dazu eine Eigenheit, die kein Fehler ist und trotzdem stört: Land, Region und Stadt führt
Plausible doppelt, als ISO-Code (`visit:country` → `"DE"`) und als Klarname
(`visit:country_name` → `"Germany"`). Gefragt wird immer die Namensfassung; die Antwort
sagt dazu, dass getauscht wurde.

Der Zuschnitt ist an [getsentry/plausible-mcp](https://github.com/getsentry/plausible-mcp)
(MIT) angelehnt — dort ein Node-Prozess mit dem offiziellen MCP-SDK, zod und
Sentry-Telemetrie, wahlweise über stdio oder als Worker hinter Cloudflare Access.
Übernommen sind die Einteilung der Tools und das Wissen um die Fallen, kein Quelltext.

Plausible begrenzt die Stats API auf 600 Anfragen pro Stunde und Konto. Eine Drossel wie im
sevdesk-Client wäre dort nur Ballast; 429 wird gemeldet, nicht wiederholt.

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
- **76 Prüfungen sevdesk** — dazu die Rechenlogik (Umsatz gestellt/bezahlt, offene Posten
  mit Teilzahlung, Überfälligkeit), die vier Fallen von oben, die Paginierung über mehrere
  Seiten, der Download-Link samt base64-Dekodierung, das Zurücklesen nach dem Anlegen und
  ein zweites Konto, das keinerlei Belege hat.
- **41 Prüfungen Plausible** — die vier Fallen der Stats API, der Tausch von ISO-Code auf
  Klarnamen, die Filter-Kurzformen, und für jede Fehlbedienung zusätzlich die Zusicherung,
  dass sie *vor* dem Netzaufruf auffliegt. Die Attrappe ist dabei so streng wie Plausible
  selbst: sie lehnt einen Zeitraum als Zeichenkette ab, sonst würde der Test die Falle gar
  nicht sehen.

Zwei Dinge daran sind mehr als Zierde. Erstens prüft eine Zusicherung, dass **jedes** Tool
mindestens einmal wirklich läuft — weil der Client jeden Aufruf gegen die API-Beschreibung
prüft, fliegt ein falsch geschriebener Pfad oder Parameter damit im Test auf und nicht beim
Nutzer. Zweitens hat genau diese Prüfung beim ersten Lauf einen echten Fund gemacht:
`/ContactAddress` hat in der offiziellen Beschreibung **überhaupt keine** Query-Parameter,
der Filter nach Kontakt ist also nirgends dokumentiert. Er ist jetzt einzeln freigegeben —
und `get_contact` prüft zusätzlich selbst nach, ob jede zurückgegebene Adresse wirklich zu
dem Kontakt gehört.

Ein früherer Ratenbegrenzungs-Test hat einen anderen echten Fehler gefunden: die Drossel lag
am Client-Objekt und startete bei jedem Tool-Aufruf neu, sodass zwei Tools nacheinander ihre
Requests im Abstand von 4 ms abgefeuert hätten. Sie liegt seither auf Modulebene, pro Token.

## Bauen und deployen

```bash
npm install
npm run build     # generiert, validiert, typisiert, bündelt alle Worker
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
| sevdesk | `my.sevdesk.de/images/logo.svg` — nur das Zeichen, ohne Schriftzug |
| Plausible | `plausible.io/assets/images/icon/plausible_logo.svg` — dito |

Vorher standen dort Nachbauten. Das ist die schlechteste Variante: es sieht aus wie die
Marke, ist aber keine. Entweder das echte Zeichen oder ein neutrales.

Neben dem SVG liegt jede Marke gerastert als PNG und ICO in `shared/src/icons.generated.ts`
und wird unter `/favicon.ico`, `/icon.png` und `/apple-touch-icon.png` ausgeliefert. Das SVG
allein reicht nicht: Connector-Listen, Lesezeichen und Startbildschirme holen sich eine
dieser Dateien und zeigen sonst gar nichts. Erzeugt mit `npm run gen:icons` — das braucht
einmalig Playwright, weil die Herstellerzeichen echte Pfade sind und kein Pixelraster. Das
Ergebnis ist eingecheckt, der normale Build kommt ohne aus. Passt das installierte
Playwright nicht zum vorhandenen Browser, zeigt `CHROMIUM_PATH=/pfad/zu/chrome` auf ein
beliebiges Chromium.

`composeLogo()` setzt ein Zeichen mittig auf eine abgerundete Fläche — dasselbe Bild dient
als Favicon und als Kachel. HERO steht auf seinem Gelb, sevdesk weiß auf seinem Rot
(#FB523B), Plausible mit seinem Farbverlauf auf Weiß mit Haarlinie — so, wie die Anbieter
es selbst zeigen. Bei sevdesk sind Ausschnitt und Größe aus der Originaldatei abgemessen,
damit die Kachel dieselben Proportionen hat wie das App-Icon; dafür beachtet
`composeLogo()` jetzt auch einen viewBox-Ursprung ungleich null. Beim Plausible-Zeichen
ist der Ausschnitt nicht abgemessen, sondern ausgerechnet: die beiden Pfade füllen genau
0/0 bis 45.36/60, und diese viewBox behält das ursprüngliche Koordinatensystem — nötig,
weil die Farbverläufe `gradientUnits="userSpaceOnUse"` benutzen und beim Normalisieren
verrutschen würden.

Die Logos kennzeichnen das angebundene System, mehr nicht. Der Fuß jeder Seite sagt, dass
es fremde Marken sind und dass dies keine offiziellen Integrationen der Anbieter sind.

## Gestaltung

Ein Stylesheet für alles: `shared/src/style.ts`. Viel Weiß, wenige Farben, harte Kontraste
bei der Schrift, Haarlinien statt Schatten. Die Akzentfarbe gehört dem jeweiligen System
(HERO gelb, sevdesk rot, Plausible indigo) und kommt nur in kleinen Flächen vor — die Seiten selbst bleiben
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

Der Server muss nicht aus diesem Repo kommen — **Tarifcheck** und **Mikdaten** liegen in
eigenen Repos und werden nur eingetragen. Bei Mikdaten steckt der MCP-Server sogar im
Worker der Anwendung selbst, nicht in einem eigenen Dienst; für den Hub macht das keinen
Unterschied. Nötig ist von ihm nur ein `/tools.json` im bekannten Format;
`auth` und `mcpUrl` darin sind optional, der Hub nutzt sie nicht.

Trägt ein Server nur lesende oder nur schreibende Tools, fällt der jeweils leere Abschnitt
auf der Detailseite weg, und die Übersicht schreibt „nur lesend" statt „6 lesend,
0 schreibend". Der Markenhinweis im Fuß nennt die Anbieter, die in der Registry als
`thirdPartyBrand` markiert sind — eigene Dienste stehen dort nicht.
