# mcpees

OAuth-geschützte MCP-Server auf Cloudflare Workers — plus die Übersichtsseite, die sie auflistet.

| | URL |
|---|---|
| Übersicht aller Server | https://mcp-hub.ksqsebastian.workers.dev |
| HERO MCP (Endpoint für Claude) | https://hero-mcp.ksqsebastian.workers.dev/mcp |

## Was hier drin ist

```
servers/hero/     HERO-Handwerkersoftware als MCP-Server, 34 Tools, OAuth 2.1
hub/              Übersichtsseite: alle Server, alle Tools, live vom Server geholt
scripts/          Build, Schema-Validierung, Deployment
```

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

## Bauen und deployen

```bash
npm install
npm run build                    # generiert, validiert, typisiert, bündelt beide Worker
node scripts/deploy.mjs --help   # Deployment über die Cloudflare-API
```

Mit eigenem Cloudflare-Token geht auch der normale Weg:

```bash
npx wrangler deploy --config servers/hero/wrangler.jsonc
npx wrangler deploy --config hub/wrangler.jsonc
```

## Einen Server aufnehmen

`hub/src/registry.ts` um einen Eintrag ergänzen. Die Tool-Liste wird nicht dort gepflegt,
sondern zur Laufzeit vom Server geholt (`/tools.json` oder `tools/list`), damit die
Übersicht nicht auseinanderläuft.
