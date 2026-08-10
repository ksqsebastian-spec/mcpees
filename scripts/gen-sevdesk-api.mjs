#!/usr/bin/env node
/**
 * Erzeugt aus der eingefrorenen sevdesk-Beschreibung die Karte, gegen die der Client zur
 * Laufzeit jeden Aufruf prüft.
 *
 * Warum generiert und nicht von Hand gepflegt: die Karte ist der einzige Ort, an dem steht,
 * welche Endpunkte es gibt und welche Query-Parameter sie kennen. Von Hand gepflegt würde
 * sie beim ersten Tippfehler still falsch — und ein Tippfehler in einem Query-Parameter ist
 * bei sevdesk kein Fehler, sondern ein ignorierter Filter. Die Antwort sieht dann richtig
 * aus und ist es nicht.
 *
 *   node scripts/gen-sevdesk-api.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA = new URL("../servers/sevdesk/schema/sevdesk-api.json", import.meta.url);
const OUT = new URL("../servers/sevdesk/src/api.generated.ts", import.meta.url);

const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
const entries = Object.entries(schema.operations);

const lines = [];
for (const [key, op] of entries) {
  const parts = [];
  if (op.pathParams.length) parts.push(`p:[${op.pathParams.map((s) => JSON.stringify(s)).join(",")}]`);
  const q = Object.entries(op.query);
  if (q.length) {
    const fields = q.map(([name, def]) => {
      const bits = [`t:${JSON.stringify(def.type)}`];
      if (def.enum) bits.push(`e:[${def.enum.map((v) => JSON.stringify(v)).join(",")}]`);
      if (def.required) bits.push("r:1");
      return `${JSON.stringify(name)}:{${bits.join(",")}}`;
    });
    parts.push(`q:{${fields.join(",")}}`);
  }
  lines.push(`  ${JSON.stringify(key)}: {${parts.join(",")}},`);
}

const out = `/**
 * ERZEUGT — nicht von Hand ändern. Quelle: servers/sevdesk/schema/sevdesk-api.json,
 * erzeugt von scripts/gen-sevdesk-api.mjs.
 *
 * ${schema._source.upstream}
 * eingefroren am ${schema._source.frozen}, Commit ${schema._source.commit}
 *
 * Schlüssel ist "METHODE /Pfad" mit den Platzhaltern der Beschreibung, also
 * "GET /Invoice/{invoiceId}". p = Pfadparameter, q = Query-Parameter (t = Typ,
 * e = erlaubte Werte, r = Pflicht).
 */

export interface QueryParamSpec {
  t: string;
  e?: (string | number)[];
  r?: 1;
}

export interface OperationSpec {
  p?: string[];
  q?: Record<string, QueryParamSpec>;
}

export const OPERATIONS: Record<string, OperationSpec> = {
${lines.join("\n")}
};
`;

writeFileSync(OUT, out);
console.log(`✓ servers/sevdesk/src/api.generated.ts — ${entries.length} Operationen`);
