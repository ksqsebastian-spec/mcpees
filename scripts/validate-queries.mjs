#!/usr/bin/env node
/**
 * Prüft jede GraphQL-Operation im Quelltext gegen HEROs eingefrorenes Introspection-Schema.
 *
 * Warum das hier steht: ohne HERO-Key lässt sich kein Tool live ausführen. Ein Tippfehler in
 * einer Selection (`duration` statt `duration_in_seconds`) würde sonst erst beim Kunden
 * auffallen — als GraphQL-Fehler zur Laufzeit. Dieser Check fängt genau diese Klasse ab,
 * bevor irgendetwas deployt wird: Feldnamen, Argumentnamen und Inline-Fragmente.
 *
 *   node scripts/validate-queries.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = join(ROOT, "servers/hero/schema/hero-schema.json");
const SRC_DIR = join(ROOT, "servers/hero/src");

const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")).data.__schema;
const TYPES = new Map(schema.types.map((t) => [t.name, t]));
const QUERY_TYPE = schema.queryType.name;
const MUTATION_TYPE = schema.mutationType?.name;

/** Wrapper (NON_NULL/LIST) abschälen und den benannten Typ zurückgeben. */
function unwrap(ref) {
  let t = ref;
  while (t && (t.kind === "NON_NULL" || t.kind === "LIST")) t = t.ofType;
  return t?.name ?? null;
}

function fieldsOf(typeName) {
  const t = TYPES.get(typeName);
  if (!t) return null;
  if (t.kind === "UNION") return "union";
  if (!t.fields) return null;
  return new Map(t.fields.map((f) => [f.name, f]));
}

/* ── Ein absichtlich kleiner GraphQL-Parser: nur so viel, wie zum Prüfen nötig ist ── */

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s|,/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if ("{}()[]:!$=".includes(c)) { out.push({ t: c }); i++; continue; }
    if (src.startsWith("...", i)) { out.push({ t: "..." }); i += 3; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && (src[j] !== '"' || src[j - 1] === "\\")) j++;
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*|^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (!m) { i++; continue; }
    out.push({ t: "name", v: m[0] });
    i += m[0].length;
  }
  return out;
}

const errors = [];

/** Selection-Set ab pos (Token nach '{') prüfen. Gibt die Position nach '}' zurück. */
function checkSelection(tokens, pos, typeName, where) {
  const fields = fieldsOf(typeName);
  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (!tok) break;
    if (tok.t === "}") return pos + 1;

    // Inline-Fragment:  ... on TypeName { … }
    if (tok.t === "...") {
      pos++;
      if (tokens[pos]?.v === "on") {
        pos++;
        const frag = tokens[pos]?.v;
        pos++;
        if (!TYPES.has(frag)) {
          errors.push(`${where}: Typ '${frag}' im Inline-Fragment gibt es nicht.`);
        }
        if (tokens[pos]?.t === "{") {
          pos = checkSelection(tokens, pos + 1, frag, where);
        }
        continue;
      }
      continue;
    }

    if (tok.t !== "name") { pos++; continue; }

    // Alias?  alias: feld
    let name = tok.v;
    if (tokens[pos + 1]?.t === ":") {
      pos += 2;
      name = tokens[pos]?.v;
    }
    pos++;

    let def = null;
    if (fields === "union") {
      // Auf Unions ist nur __typename direkt erlaubt; Rest via Inline-Fragment.
      if (name !== "__typename") {
        errors.push(`${where}: '${name}' direkt auf Union '${typeName}' — Inline-Fragment nötig.`);
      }
    } else if (fields) {
      def = fields.get(name);
      if (!def && name !== "__typename") {
        const near = [...fields.keys()].filter((k) =>
          k.replace(/_/g, "").includes(name.replace(/_/g, "").slice(0, 6)),
        );
        errors.push(
          `${where}: '${typeName}.${name}' gibt es nicht.` +
            (near.length ? ` Gemeint: ${near.slice(0, 4).join(", ")}?` : ""),
        );
      } else if (def?.isDeprecated) {
        console.warn(`  ⚠ ${where}: ${typeName}.${name} ist deprecated: ${def.deprecationReason}`);
      }
    }

    // Argumente
    if (tokens[pos]?.t === "(") {
      pos++;
      let depth = 1;
      while (pos < tokens.length && depth > 0) {
        const a = tokens[pos];
        if (a.t === "(") depth++;
        else if (a.t === ")") { depth--; pos++; continue; }
        else if (depth === 1 && a.t === "name" && tokens[pos + 1]?.t === ":") {
          if (def && !def.args.some((x) => x.name === a.v)) {
            errors.push(
              `${where}: '${typeName}.${name}' kennt kein Argument '${a.v}'. ` +
                `Erlaubt: ${def.args.map((x) => x.name).join(", ")}`,
            );
          }
        }
        pos++;
      }
    }

    // Untergeordnete Selection
    if (tokens[pos]?.t === "{") {
      const child = def ? unwrap(def.type) : null;
      pos = checkSelection(tokens, pos + 1, child ?? "__unknown__", where);
    }
  }
  return pos;
}

function checkOperation(src, where) {
  const tokens = tokenize(src);
  let pos = 0;
  let rootType = QUERY_TYPE;
  if (tokens[0]?.t === "name" && (tokens[0].v === "query" || tokens[0].v === "mutation")) {
    if (tokens[0].v === "mutation") rootType = MUTATION_TYPE;
    pos = 1;
    // Operationsname und Variablendeklarationen überspringen
    if (tokens[pos]?.t === "name") pos++;
    if (tokens[pos]?.t === "(") {
      let depth = 1;
      pos++;
      while (pos < tokens.length && depth > 0) {
        if (tokens[pos].t === "(") depth++;
        if (tokens[pos].t === ")") depth--;
        pos++;
      }
    }
  }
  if (tokens[pos]?.t !== "{") {
    errors.push(`${where}: konnte die Operation nicht lesen.`);
    return;
  }
  checkSelection(tokens, pos + 1, rootType, where);
}

/* ── Operationen aus dem TypeScript-Quelltext ziehen ─────────────────────────── */

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

let count = 0;
for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, "utf8");
  // Template-Literale, die wie eine GraphQL-Operation aussehen.
  for (const m of src.matchAll(/`([^`]*?)`/gs)) {
    const body = m[1];
    if (!/^\s*(query|mutation)\s*[({]/.test(body)) continue;
    if (body.includes("${")) {
      errors.push(`${file}: GraphQL-Literal mit \${}-Interpolation — Werte gehören in Variablen.`);
      continue;
    }
    const line = src.slice(0, m.index).split("\n").length;
    checkOperation(body, `${file.replace(ROOT + "/", "")}:${line}`);
    count++;
  }
}

console.log(`\nGeprüfte GraphQL-Operationen: ${count}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} Problem(e):\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("✓ Alle Felder und Argumente existieren im HERO-Schema.\n");
