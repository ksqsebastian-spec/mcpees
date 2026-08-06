#!/usr/bin/env node
/**
 * Deployt einen gebündelten Worker über die Cloudflare-API — Konfiguration aus wrangler.jsonc.
 *
 * Wrangler wäre der normale Weg; dieses Skript gibt es, weil die Umgebung, in der das Projekt
 * entstanden ist, kein Wrangler-Token hatte, sondern nur API-Zugriff. Es macht dasselbe:
 * ein ES-Modul plus Metadaten als multipart/form-data an /workers/scripts/<name>.
 *
 * Die Bindings kommen bewusst aus wrangler.jsonc und nicht aus Flags: die API ersetzt bei
 * jedem Upload ALLE Bindings. Ein vergessenes Flag löscht also stillschweigend ein Binding —
 * genau das ist beim Bauen dieses Projekts einmal passiert.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… \
 *     node scripts/deploy.mjs servers/hero/wrangler.jsonc servers/hero/dist/worker.js
 */
import { readFileSync } from "node:fs";

const [configPath, file] = process.argv.slice(2);
if (!configPath || !file || configPath === "--help") {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]);
  process.exit(configPath === "--help" ? 0 : 1);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error("CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID müssen gesetzt sein.");
  process.exit(1);
}

/** jsonc: Zeilenkommentare raus, dann normales JSON. Reicht für unsere Configs. */
const config = JSON.parse(
  readFileSync(configPath, "utf8")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n"),
);

const bindings = [
  ...(config.kv_namespaces ?? []).map((k) => ({
    type: "kv_namespace",
    name: k.binding,
    namespace_id: k.id,
  })),
  ...(config.services ?? []).map((s) => ({
    type: "service",
    name: s.binding,
    service: s.service,
  })),
  ...Object.entries(config.vars ?? {}).map(([name, text]) => ({
    type: "plain_text",
    name,
    text: String(text),
  })),
];

const metadata = {
  main_module: "worker.js",
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags ?? [],
  bindings,
  observability: config.observability ?? { enabled: true },
};

const form = new FormData();
form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
form.set(
  "worker.js",
  new Blob([readFileSync(file)], { type: "application/javascript+module" }),
  "worker.js",
);

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${config.name}`,
  { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form },
);
const body = await res.json();
if (!body.success) {
  console.error("✗ Deployment fehlgeschlagen:", JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

if (config.workers_dev !== false) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${config.name}/subdomain`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true, previews_enabled: false }),
    },
  );
}

const names = bindings.map((b) => b.name).join(", ") || "keine";
console.log(`✓ ${config.name} deployt — Bindings: ${names}`);
