#!/usr/bin/env node
/**
 * Bündelt einen Worker zu genau einer ESM-Datei.
 *
 * Kein Wrangler im Spiel: das Deployment läuft über die Cloudflare-API (siehe
 * scripts/deploy.md), und die will ein einzelnes Modul. esbuild ist reine Bauzeit-
 * Abhängigkeit, zur Laufzeit hat der Worker keine.
 *
 *   node scripts/bundle.mjs <entry.ts> <out.js>
 */
import { build } from "esbuild";
import { statSync } from "node:fs";

const [entry, outfile] = process.argv.slice(2);
if (!entry || !outfile) {
  console.error("Aufruf: node scripts/bundle.mjs <entry.ts> <out.js>");
  process.exit(1);
}

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  minify: false, // lesbar halten: der Bundle ist das, was live läuft
  legalComments: "none",
  conditions: ["worker", "browser"],
});

console.log(`✓ ${outfile} — ${(statSync(outfile).size / 1024).toFixed(1)} KB`);
