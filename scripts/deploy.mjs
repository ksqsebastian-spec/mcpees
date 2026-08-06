#!/usr/bin/env node
/**
 * Deployt einen gebündelten Worker über die Cloudflare-API.
 *
 * Wrangler wäre der normale Weg; dieses Skript gibt es, weil die Umgebung, in der das
 * Projekt entstanden ist, kein Wrangler-Token hatte, sondern nur API-Zugriff. Es macht
 * genau dasselbe: ein ES-Modul plus Metadaten (Bindings, compatibility_date) als
 * multipart/form-data an /workers/scripts/<name>.
 *
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     node scripts/deploy.mjs hero-mcp servers/hero/dist/worker.js \
 *       --kv OAUTH_KV=<namespace-id> --var HUB_URL=https://…
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (!args.length || args[0] === "--help") {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]);
  process.exit(0);
}

const [name, file] = args;
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error("CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID müssen gesetzt sein.");
  process.exit(1);
}

const bindings = [];
for (let i = 2; i < args.length; i += 2) {
  const [key, value] = String(args[i + 1] ?? "").split(/=(.*)/s);
  if (args[i] === "--kv") bindings.push({ type: "kv_namespace", name: key, namespace_id: value });
  else if (args[i] === "--var") bindings.push({ type: "plain_text", name: key, text: value });
}

const metadata = {
  main_module: "worker.js",
  compatibility_date: "2026-08-01",
  bindings,
  observability: { enabled: true },
};

const form = new FormData();
form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
form.set(
  "worker.js",
  new Blob([readFileSync(file)], { type: "application/javascript+module" }),
  "worker.js",
);

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${name}`,
  { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form },
);
const body = await res.json();
if (!body.success) {
  console.error("✗ Deployment fehlgeschlagen:", JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

// workers.dev-Subdomain aktivieren, sonst ist der Worker nicht erreichbar.
await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${name}/subdomain`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  },
);

console.log(`✓ ${name} deployt`);
