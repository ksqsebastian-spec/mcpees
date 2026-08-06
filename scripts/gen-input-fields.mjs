#!/usr/bin/env node
/**
 * Erzeugt src/input-fields.generated.ts: eine kompakte Karte
 *   InputTypeName -> { feldname: verschachtelterInputTyp | null }
 *
 * Nur für die Input-Typen, die im Quelltext wirklich als Variable deklariert werden
 * (plus deren verschachtelte Typen). Das komplette Schema wäre 530 KB und hat im Worker
 * nichts verloren; diese Karte sind ein paar Kilobyte und erlaubt genau die lokale
 * Feldnamenprüfung, die hero.py macht: 'productId' statt 'product_id' fliegt auf,
 * bevor ein Request rausgeht.
 *
 *   node scripts/gen-input-fields.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  readFileSync(join(ROOT, "servers/hero/schema/hero-schema.json"), "utf8"),
).data.__schema;
const TYPES = new Map(schema.types.map((t) => [t.name, t]));
const SRC_DIR = join(ROOT, "servers/hero/src");

const unwrap = (ref) => {
  let t = ref;
  while (t && (t.kind === "NON_NULL" || t.kind === "LIST")) t = t.ofType;
  return t?.name ?? null;
};

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

// Alle Variablendeklarationen der Form  $name: TypeName  einsammeln.
const roots = new Set();
for (const file of walk(SRC_DIR)) {
  for (const m of readFileSync(file, "utf8").matchAll(/\$\w+\s*:\s*(\[?)(\w+)/g)) {
    roots.add(m[2]);
  }
}

const out = {};
const queue = [...roots];
while (queue.length) {
  const name = queue.pop();
  if (out[name]) continue;
  const t = TYPES.get(name);
  if (!t || t.kind !== "INPUT_OBJECT") continue;
  const fields = {};
  for (const f of t.inputFields ?? []) {
    const inner = unwrap(f.type);
    const it = TYPES.get(inner);
    const nested = it?.kind === "INPUT_OBJECT" ? inner : null;
    fields[f.name] = nested;
    if (nested) queue.push(nested);
  }
  out[name] = fields;
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
const body = `/* Automatisch erzeugt von scripts/gen-input-fields.mjs — nicht von Hand ändern. */
export const INPUT_FIELDS: Record<string, Record<string, string | null>> = ${JSON.stringify(
  sorted,
  null,
  2,
)};
`;
writeFileSync(join(SRC_DIR, "input-fields.generated.ts"), body);
console.log(
  `✓ input-fields.generated.ts: ${Object.keys(out).length} Input-Typen, ` +
    `${(body.length / 1024).toFixed(1)} KB`,
);
