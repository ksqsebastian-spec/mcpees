# mcpees

OAuth-geschützte MCP-Server auf Cloudflare Workers — plus die Übersichtsseite, die sie auflistet.

| | URL |
|---|---|
| Übersicht aller Server | https://mcp-hub.ksqsebastian.workers.dev |
| HERO MCP (Endpoint für Claude) | https://hero-mcp.ksqsebastian.workers.dev/mcp |
| sevdesk MCP | https://sevdesk-mcp.ksqsebastian.workers.dev/mcp |
| DocuWare MCP | https://docuware-mcp.ksqsebastian.workers.dev/mcp |
| Tarifcheck MCP | https://tarifcheck.ksqsebastian.workers.dev/mcp |
| Mikdaten MCP | https://mikdaten.ksqsebastian.workers.dev/mcp |

Der Vorgänger auf Vercel (`hero-mcp.vercel.app`) ist am 06.08.2026 abgeschaltet worden und
antwortet auf jeden Aufruf mit HTTP 410 samt Verweis auf den neuen Endpoint. Aus der Übersicht
ist er entfernt; der 410-Stub bleibt für alle, die noch die alte URL eingetragen haben.

## Was hier drin ist

```
shared/           OAuth-Server, MCP-Protokoll, Gestaltung — von allen Servern benutzt
servers/hero/     HERO-Handwerkersoftware, 34 Tools
servers/sevdesk/  sevdesk-Buchhaltung, 21 Tools
servers/docuware/ DocuWare-Dokumentenarchiv, 10 Tools
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

## DocuWare MCP

10 Tools für [DocuWare](https://docuware.com): Aktenschränke und Indexfelder anzeigen,
Auswahllisten nachschlagen, Dokumente über ihre Indexfelder suchen, ein Dokument samt
Anhängen ansehen, den OCR-Volltext lesen und Dateien über einen Link auf Zeit
herunterladen. Geschrieben wird ausschließlich Neues: ablegen und anhängen.

Kein Ändern, kein Löschen — wie bei den anderen Servern. Bei einem Archiv wiegt das
schwerer als anderswo: es lebt davon, dass niemand nachträglich daran dreht. Indexfelder
korrigieren und Dokumente entfernen geht in DocuWare selbst, mit Protokoll und Rechten.

**Zwei Anmeldearten, ein Formular.** DocuWare lässt beides zu: ein Benutzerkonto
(Passwort-Grant, `client_id` ist der eingebaute `docuware.platform.net.client`) oder eine
App-Registrierung aus *DocuWare Konfiguration → Integrationen* mit Client-ID und Secret.
Zwei Formulare für dieselbe Sache wären eines zu viel, also stehen beide im selben
Feldpaar. Welche gemeint ist, verrät die Gestalt — Client-IDs sind GUIDs, Benutzernamen
nie —, und passt die erste nicht, wird die zweite versucht. Geraten wird also nichts.
Das Token holt der Server nicht bei DocuWare, sondern bei einem Identity Service, der in
der Cloud auf einem ganz anderen Host liegt: `/Home/IdentityServiceInfo` sagt, wo er ist,
dessen `.well-known/openid-configuration` sagt, wie sein Token-Endpunkt heißt.

**Es wird gefolgt, nicht gebaut.** Die Platform-API ist durchgehend HATEOAS: jede Antwort
trägt `Links: [{rel, href}]`, und der nächste Schritt steht dort drin. Dieser Server setzt
deshalb keinen einzigen Pfad zusammen. Das ist kein Purismus — DocuWare veröffentlicht die
Pfade nirgends, und was in der Cloud gilt, gilt on premises schon nicht mehr. Fehlt eine
Beziehung, sagt der Server, welche; er rät keine Adresse.

Fünf Eigenheiten prägen die Umsetzung:

- **Der Feldname auf dem Bildschirm ist nicht der Feldname der API.** Was in DocuWare
  „Belegdatum“ heißt, kennt die API nur als `DOCDATE`. Wer die Bezeichnung durchreicht,
  bekommt 400 — ohne Hinweis, welcher Name es hätte sein sollen. Der Server löst beides
  gegen die Feldliste des Schranks auf und nennt bei einem Treffer ins Leere alle
  vorhandenen Felder.
- **Klammern in einem Suchwert sind Syntax.** „Rechnung (Eingang)“ sucht unmaskiert etwas
  anderes als das, was dasteht, und meldet keinen Fehler, sondern liefert die falsche
  Treffermenge. Sie werden maskiert; `*` und `?` bleiben stehen, die sind als Platzhalter
  gemeint, wenn jemand sie schreibt.
- **Die Sortierung gehört in den Rumpf.** Es gibt auch einen Query-Parameter `sortOrder`,
  der nimmt aber nur ein Feld und verwirft den Rest stillschweigend.
- **Ein Feld, das der Ablagedialog nicht führt, verfällt beim Ablegen still.** DocuWare
  nimmt die Angabe entgegen, legt ab und schreibt sie nicht. Deshalb wird vorher geprüft
  und hinterher zurückgelesen — was der Server meldet, ist der Stand im Schrank und nicht
  die Antwort auf das POST.
- **Datumswerte sind kein ISO-Datum.** DocuWare antwortet mit `/Date(1700000000000+0100)/`;
  `/Date(0)/` heißt „kein Datum“ und nicht 1.1.1970.

Dazu eine Unsicherheit, die nicht wegdiskutiert wird: für Datumsfelder schickt der Server
beim Ablegen die Kennung `DateTime` samt ISO-Wert. Eine eigene Kennung `Date` wäre
naheliegend, ist aber nirgends belegt — deshalb bleibt es bei dem, was nachweislich
funktioniert.

Dateien kommen nie als base64 ins Gespräch. Wer den Inhalt wissen will, bekommt mit
`document_text` den OCR-Volltext; wer die Datei braucht, bekommt einen nicht erratbaren
Link auf Zeit von diesem Server, der die Auslieferung selbst übernimmt.

Die Erkenntnisse über diese API stammen aus dem Quelltext von
[sniner/docuware-client](https://github.com/sniner/docuware-client) (BSD-3-Clause,
© Stefan Schönberger) — einer gepflegten Python-Bibliothek samt CLI. Deren Code ist die
Beschreibung, die DocuWare selbst nicht veröffentlicht: die offizielle Doku nennt
Postman-Sammlungen und ein XSD, aber weder Endpunktpfade noch die Gestalt einer
Suchanfrage. Übernommen ist das Wissen, nicht der Code — dort ein Python-Paket mit CLI und
Anmeldedatei auf der Platte, hier ein remote erreichbarer Worker mit OAuth 2.1 und ohne
Dateisystem.

Vor dem ersten Deploy fehlt noch ein KV-Namensraum; seine Id gehört in
`servers/docuware/wrangler.jsonc`:

```bash
npx wrangler kv namespace create docuware-mcp-oauth
```

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

`npm test` fährt die Server gegen Attrappen von KV und Fremdsystem:

- **19 Prüfungen HERO** — kompletter OAuth-Flow: Code-Tausch, PKCE, Einmalgebrauch des Codes,
  Refresh-Rotation, Widerruf, ein echter `tools/call`, und dass weder Key noch Token im
  Klartext in KV landen.
- **76 Prüfungen sevdesk** — dazu die Rechenlogik (Umsatz gestellt/bezahlt, offene Posten
  mit Teilzahlung, Überfälligkeit), die vier Fallen von oben, die Paginierung über mehrere
  Seiten, der Download-Link samt base64-Dekodierung, das Zurücklesen nach dem Anlegen und
  ein zweites Konto, das keinerlei Belege hat.
- **67 Prüfungen DocuWare** — beide Anmeldearten samt Wahl anhand der Gestalt des
  Benutzernamens, die stille Wiederanmeldung nach einem 401, die fünf Fallen von oben, die
  Suche über die Folgeseite, das Zusammensetzen des OCR-Texts aus Wörtern, Zeilen und
  Zonen, der Download-Link samt Auslieferung, und dass weder Passwort noch DocuWare-Token
  im Klartext in KV landen.

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

Beim DocuWare-Server hat der Test denselben Dienst geleistet: eine Prüfung, die schlicht
mitzählt, wie oft ein Access-Token geholt wird, hat neun Anmeldungen dort gefunden, wo eine
genügt. Der Client holte das Token pro Request statt pro Zugang — mit KV fiel das nicht auf,
ohne KV, also genau beim Prüfen der Zugangsdaten, dreimal hintereinander. Discovery und
Token liegen seither am Objekt, und zwar als Promise, damit auch zwei gleichzeitige Aufrufe
nur in eine Anmeldung laufen.

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
| DocuWare | `start.docuware.com/hubfs/… /DocuWare Icon.svg` — das Favicon des Anbieters |

Vorher standen dort Nachbauten. Das ist die schlechteste Variante: es sieht aus wie die
Marke, ist aber keine. Entweder das echte Zeichen oder ein neutrales.

Neben dem SVG liegt jede Marke gerastert als PNG und ICO in `shared/src/icons.generated.ts`
und wird unter `/favicon.ico`, `/icon.png` und `/apple-touch-icon.png` ausgeliefert. Das SVG
allein reicht nicht: Connector-Listen, Lesezeichen und Startbildschirme holen sich eine
dieser Dateien und zeigen sonst gar nichts. Erzeugt mit `npm run gen:icons` — das braucht
einmalig Playwright, weil die Herstellerzeichen echte Pfade sind und kein Pixelraster. Das
Ergebnis ist eingecheckt, der normale Build kommt ohne aus.

`composeLogo()` setzt ein Zeichen mittig auf eine abgerundete Fläche — dasselbe Bild dient
als Favicon und als Kachel. HERO steht auf seinem Gelb, sevdesk weiß auf seinem Rot
(#FB523B) — so, wie die Anbieter es selbst zeigen. Bei sevdesk sind Ausschnitt und Größe
aus der Originaldatei abgemessen, damit die Kachel dieselben Proportionen hat wie das
App-Icon; dafür beachtet `composeLogo()` jetzt auch einen viewBox-Ursprung ungleich null.
DocuWare zeigt sein Zeichen blau (#303AB2) auf Weiß — also steht es hier auf einer weißen
Kachel mit Haarlinie, die sie auf der ebenfalls weißen Seite sonst verlöre. Geändert ist an
der Datei nur, dass die Farben statt an CSS-Klassen am Pfad hängen; die Pfade selbst sind
unangetastet.

Die Logos kennzeichnen das angebundene System, mehr nicht. Der Fuß jeder Seite sagt, dass
es fremde Marken sind und dass dies keine offiziellen Integrationen der Anbieter sind.

## Gestaltung

Ein Stylesheet für alles: `shared/src/style.ts`. Viel Weiß, wenige Farben, harte Kontraste
bei der Schrift, Haarlinien statt Schatten. Die Akzentfarbe gehört dem jeweiligen System
(HERO gelb, sevdesk rot) und kommt nur in kleinen Flächen vor — die Seiten selbst bleiben
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
