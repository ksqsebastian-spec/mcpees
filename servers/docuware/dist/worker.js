// shared/src/crypto.ts
var enc = new TextEncoder();
var dec = new TextDecoder();
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - pad.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randomToken(prefix) {
  return prefix + b64url(crypto.getRandomValues(new Uint8Array(32)));
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function deriveKey(secret) {
  const material = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, [
    "deriveKey"
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("hero-mcp/kv"), info: enc.encode("props-v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function sealJSON(secret, data) {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  return b64url(iv) + "." + b64url(new Uint8Array(ct));
}
async function openJSON(secret, sealed) {
  const [ivPart, ctPart] = sealed.split(".");
  if (!ivPart || !ctPart) throw new Error("malformed ciphertext");
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(ivPart) },
    key,
    fromB64url(ctPart)
  );
  return JSON.parse(dec.decode(pt));
}
async function verifyPkceS256(verifier, challenge) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return timingSafeEqual(b64url(new Uint8Array(d)), challenge);
}

// shared/src/style.ts
var BASE_CSS = `
:root {
  --ink: #131316;
  --ink-2: #6e6e78;
  --ink-3: #9b9ba4;
  --bg: #ffffff;
  --surface: #ffffff;
  --line: #e7e7ea;
  --line-strong: #d2d2d8;
  --wash: #f7f7f8;
  --focus: #131316;
  --radius: 18px;
  --ease: cubic-bezier(.22,.61,.25,1);
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #f4f4f6;
    --ink-2: #a0a0aa;
    --ink-3: #70707a;
    --bg: #0b0b0d;
    --surface: #131316;
    --line: #26262c;
    --line-strong: #3a3a42;
    --wash: #17171b;
    --focus: #f4f4f6;
  }
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 400 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

a { color: inherit; text-decoration: none; }
h1, h2, h3 { margin: 0; font-weight: 640; letter-spacing: -.028em; line-height: 1.12; }
p { margin: 0; }

/* \u2500\u2500 Typografische Stufen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.display { font-size: clamp(2.3rem, 6.2vw, 3.65rem); letter-spacing: -.042em; line-height: 1.03; font-weight: 660; }
.lede { font-size: clamp(1.05rem, 1.9vw, 1.28rem); color: var(--ink-2); line-height: 1.5; max-width: 34ch; }
.eyebrow {
  font-size: .74rem; font-weight: 620; letter-spacing: .13em; text-transform: uppercase;
  color: var(--ink-3);
}
.meta { font-size: .9rem; color: var(--ink-2); }
.mono, code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; }

/* \u2500\u2500 Raster \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 28px; }
.narrow { max-width: 720px; }

/* \u2500\u2500 Bewegung: nur beim Eintreten und bei Interaktion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.rise { animation: rise .62s var(--ease) both; }
.d1 { animation-delay: .04s } .d2 { animation-delay: .09s } .d3 { animation-delay: .14s }
.d4 { animation-delay: .19s } .d5 { animation-delay: .24s } .d6 { animation-delay: .29s }

/* \u2500\u2500 Kachel mit dem Systemk\xFCrzel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.tile {
  width: 44px; height: 44px; border-radius: 13px; flex: 0 0 auto;
  display: grid; place-items: center;
  font-weight: 700; font-size: 19px; letter-spacing: -.03em;
}

/* \u2500\u2500 Karten \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 26px;
  transition: transform .28s var(--ease), box-shadow .28s var(--ease), border-color .28s var(--ease);
}
a.card:hover, .card.hoverable:hover {
  transform: translateY(-3px);
  border-color: var(--line-strong);
  box-shadow: 0 14px 34px -14px rgba(0,0,0,.18);
}

/* \u2500\u2500 Links mit Pfeil \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.go { display: inline-flex; align-items: center; gap: .42em; font-weight: 560; font-size: .96rem; }
.go .arrow { transition: transform .28s var(--ease); }
.go:hover .arrow { transform: translateX(4px); }

/* \u2500\u2500 URL-Feld mit Kopierknopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.urlbar {
  display: flex; align-items: stretch; gap: 8px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--wash);
  padding: 5px 5px 5px 14px; transition: border-color .28s var(--ease);
}
.urlbar:focus-within { border-color: var(--line-strong); }
.urlbar input {
  flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink);
  font: 500 13.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 7px 0; outline: none;
}
.copy {
  border: 0; border-radius: 9px; padding: 7px 14px; cursor: pointer;
  background: var(--ink); color: var(--bg);
  font: 620 13px/1.4 inherit; letter-spacing: -.01em;
  transition: opacity .2s var(--ease), transform .2s var(--ease);
}
.copy:hover { opacity: .84; }
.copy:active { transform: scale(.96); }
.copy.done { background: #12833f; color: #fff; }

/* \u2500\u2500 Eingabefelder \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.field {
  width: 100%; padding: 13px 15px; font: 400 16px/1.5 inherit;
  border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface); color: var(--ink);
  transition: border-color .2s var(--ease), box-shadow .2s var(--ease);
}
.field::placeholder { color: var(--ink-3); }
.field:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 14%, transparent); }

/* \u2500\u2500 Knopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.btn {
  display: block; width: 100%; padding: 14px 18px; border: 0; border-radius: 12px;
  background: var(--ink); color: var(--bg); cursor: pointer;
  font: 620 15.5px/1.4 inherit; letter-spacing: -.011em;
  transition: opacity .2s var(--ease), transform .2s var(--ease);
}
.btn:hover { opacity: .86; }
.btn:active { transform: scale(.988); }

/* \u2500\u2500 Hinweise und Fehler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.note { background: var(--wash); border-radius: 14px; padding: 18px 20px; font-size: .94rem; color: var(--ink-2); }
.note strong, .note b { color: var(--ink); font-weight: 600; }
.err {
  border-left: 2px solid #c8382f; background: color-mix(in srgb, #c8382f 7%, transparent);
  border-radius: 0 10px 10px 0; padding: 12px 16px; font-size: .93rem; color: var(--ink);
}

/* \u2500\u2500 Trennlinien \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rule { height: 1px; background: var(--line); border: 0; margin: 0; }

:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
var COPY_JS = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () {
    var old = b.textContent;
    b.textContent = 'Kopiert';
    b.classList.add('done');
    setTimeout(function () { b.textContent = old; b.classList.remove('done'); }, 1500);
  });
});`;

// shared/src/ui.ts
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var PAGE_CSS = `
body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 40px 24px; }
main { width: 100%; max-width: 460px; }
.brand { display: flex; align-items: center; gap: 13px; margin-bottom: 38px; }
.brand .name { font-weight: 620; font-size: 16.5px; letter-spacing: -.02em; }
.brand .sub { font-size: 13.5px; color: var(--ink-3); margin-top: 1px; }
h1 { font-size: 1.72rem; letter-spacing: -.035em; margin-bottom: 12px; }
.body { color: var(--ink-2); font-size: 1rem; line-height: 1.62; }
.body + .body { margin-top: 12px; }
label { display: block; font-weight: 600; font-size: .88rem; margin: 26px 0 8px; letter-spacing: -.008em; }
.client {
  display: flex; align-items: center; gap: 12px;
  border: 1px solid var(--line); border-radius: 14px; padding: 15px 17px; margin: 24px 0;
}
.client .dot { width: 8px; height: 8px; border-radius: 50%; background: #12833f; flex: 0 0 auto; }
.client .who { font-weight: 600; font-size: .96rem; letter-spacing: -.012em; }
.client .uri { font-size: .82rem; color: var(--ink-3); margin-top: 1px; }
.foot { margin-top: 30px; padding-top: 22px; border-top: 1px solid var(--line); font-size: .86rem; color: var(--ink-3); line-height: 1.6; }
.foot a { color: var(--ink-2); text-decoration: underline; text-underline-offset: 2px; }
ul.points { list-style: none; padding: 0; margin: 26px 0 0; }
ul.points li { position: relative; padding-left: 20px; margin: 11px 0; color: var(--ink-2); font-size: .96rem; line-height: 1.55; }
ul.points li::before { content: ""; position: absolute; left: 2px; top: .62em; width: 5px; height: 5px; border-radius: 50%; background: var(--ink-3); }
ul.points li b { color: var(--ink); font-weight: 600; }
`;
var dataUri = (svg) => `data:image/svg+xml;base64,${btoa(svg)}`;
function page(brand, title, body, status = 200) {
  const logo = dataUri(brand.logoSvg);
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="${logo}">
<style>${BASE_CSS}${PAGE_CSS}</style></head><body>
<main class="rise">
<div class="brand"><img class="tile" src="${logo}" alt="" width="44" height="44">
<div><div class="name">${esc(brand.name)}</div><div class="sub">${esc(brand.tagline)}</div></div></div>
${body}</main>
<script>${COPY_JS}</script></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
function consentPage(opts) {
  const hidden = Object.entries(opts.params).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
  return page(
    opts.brand,
    `${opts.brand.name} verbinden`,
    `${opts.error ? `<div class="err" style="margin-bottom:20px">${esc(opts.error)}</div>` : ""}
<h1>Zugriff erlauben</h1>
<p class="body">${opts.brand.fields.length > 1 ? "Gib deine Zugangsdaten ein. Sie werden" : `Gib deinen ${esc(opts.brand.fields[0].label)} ein. Er wird`} gegen ${esc(opts.brand.system)} gepr\xFCft und dann verschl\xFCsselt gespeichert \u2014 lesen kann
${opts.brand.fields.length > 1 ? "sie" : "ihn"} nur der Client, der das ausgestellte Token h\xE4lt.</p>
<div class="client"><span class="dot"></span>
<div><div class="who">${esc(opts.clientName)}</div>
${opts.clientUri ? `<div class="uri">${esc(opts.clientUri)}</div>` : ""}</div></div>
<form method="post">${hidden}
${opts.brand.fields.map(
      (f, i) => `<label for="f_${esc(f.name)}">${esc(f.label)}</label>
<input id="f_${esc(f.name)}" class="field" name="${esc(f.name)}"
  type="${f.secret === false ? "text" : "password"}" autocomplete="off" spellcheck="false"
  placeholder="${esc(f.placeholder ?? "")}" required${i === 0 ? " autofocus" : ""}>`
    ).join("")}
<button class="btn" style="margin-top:20px" type="submit">Verbinden</button></form>
<div class="foot">${opts.brand.credentialHelp}</div>`
  );
}
function errorPage(brand, title, message, status = 400) {
  return page(
    brand,
    title,
    `<h1>${esc(title)}</h1><div class="err" style="margin-top:16px">${esc(message)}</div>`,
    status
  );
}
function landingPage(brand, origin, toolCount, hubUrl) {
  return page(
    brand,
    brand.name,
    `<h1>${esc(brand.tagline)}</h1>
<p class="body">${brand.summary} <b style="color:var(--ink);font-weight:600">${toolCount} Tools</b>,
gesch\xFCtzt mit OAuth. Jeder Nutzer verbindet seinen eigenen Zugang.</p>
<label>Server-URL f\xFCr Claude</label>
<div class="urlbar"><input readonly value="${esc(origin)}/mcp" onclick="this.select()">
<button class="copy" data-copy="${esc(origin)}/mcp">Kopieren</button></div>
<ul class="points">${brand.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
<div class="foot"><a href="${esc(hubUrl)}">Alle MCP-Server im \xDCberblick</a></div>`
  );
}

// shared/src/oauth.ts
var CODE_TTL = 600;
var ACCESS_TTL = 60 * 60;
var REFRESH_TTL = 60 * 60 * 24 * 30;
var json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    ...headers
  }
});
var oauthError = (error, description, status = 400) => json({ error, error_description: description }, status);
function authServerMetadata(origin, scopes) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    revocation_endpoint: `${origin}/revoke`,
    scopes_supported: scopes.split(" "),
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: `${origin}/`
  };
}
function protectedResourceMetadata(origin, scopes) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: scopes.split(" "),
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/`
  };
}
function unauthorized(origin, realm, description) {
  return json(
    { error: "invalid_token", error_description: description },
    401,
    {
      "www-authenticate": `Bearer realm="${realm}", resource_metadata="${origin}/.well-known/oauth-protected-resource"`
    }
  );
}
async function handleRegister(req2, env) {
  let body;
  try {
    body = await req2.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body ist kein JSON.");
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length) {
    return oauthError("invalid_redirect_uri", "redirect_uris fehlt oder ist leer.");
  }
  for (const uri of redirectUris) {
    let u;
    try {
      u = new URL(uri);
    } catch {
      return oauthError("invalid_redirect_uri", `'${uri}' ist keine g\xFCltige URL.`);
    }
    const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !isLocal && !u.protocol.includes(".")) {
      return oauthError("invalid_redirect_uri", `'${uri}' muss https, localhost oder ein App-Scheme sein.`);
    }
  }
  const method = body.token_endpoint_auth_method ?? "client_secret_post";
  const clientId = randomToken("hmcp_c_");
  const record = {
    client_id: clientId,
    client_name: String(body.client_name ?? "Unbenannter MCP-Client").slice(0, 120),
    client_uri: body.client_uri ? String(body.client_uri).slice(0, 300) : void 0,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: method,
    created: Date.now()
  };
  let secret;
  if (method !== "none") {
    secret = randomToken("hmcp_cs_");
    record.client_secret_hash = await sha256hex(secret);
  }
  await env.OAUTH_KV.put(`client:${clientId}`, JSON.stringify(record));
  return json(
    {
      client_id: clientId,
      ...secret ? { client_secret: secret } : {},
      client_id_issued_at: Math.floor(record.created / 1e3),
      ...secret ? { client_secret_expires_at: 0 } : {},
      client_name: record.client_name,
      redirect_uris: record.redirect_uris,
      token_endpoint_auth_method: method,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"]
    },
    201
  );
}
function readAuthParams(src, defaultScope) {
  const get = (k) => String(src.get(k) ?? "");
  const client_id = get("client_id");
  const redirect_uri = get("redirect_uri");
  const response_type = get("response_type");
  const code_challenge = get("code_challenge");
  const method = get("code_challenge_method");
  if (!client_id) return { error: "client_id fehlt." };
  if (!redirect_uri) return { error: "redirect_uri fehlt." };
  if (response_type !== "code") return { error: "Nur response_type=code wird unterst\xFCtzt." };
  if (!code_challenge) return { error: "PKCE ist Pflicht: code_challenge fehlt." };
  if (method !== "S256") return { error: "Nur code_challenge_method=S256 wird unterst\xFCtzt." };
  return {
    client_id,
    redirect_uri,
    state: get("state"),
    code_challenge,
    scope: get("scope") || defaultScope
  };
}
async function loadClient(env, clientId) {
  return env.OAUTH_KV.get(`client:${clientId}`, "json");
}
async function handleAuthorizeGet(url, env, config2) {
  const parsed = readAuthParams(url.searchParams, config2.scopes);
  if ("error" in parsed) return errorPage(config2.brand, "Ung\xFCltige Anfrage", parsed.error);
  const client = await loadClient(env, parsed.client_id);
  if (!client) return errorPage(config2.brand, "Unbekannter Client", "Diese client_id ist nicht registriert.");
  if (!client.redirect_uris.includes(parsed.redirect_uri)) {
    return errorPage(
      config2.brand,
      "Ung\xFCltige redirect_uri",
      "Die redirect_uri geh\xF6rt nicht zu diesem Client. Aus Sicherheitsgr\xFCnden wird nicht weitergeleitet."
    );
  }
  return consentPage({
    brand: config2.brand,
    clientName: client.client_name,
    clientUri: client.client_uri,
    params: {
      client_id: parsed.client_id,
      redirect_uri: parsed.redirect_uri,
      state: parsed.state,
      code_challenge: parsed.code_challenge,
      scope: parsed.scope,
      response_type: "code",
      code_challenge_method: "S256"
    }
  });
}
async function handleAuthorizePost(req2, env, config2) {
  const form = await req2.formData();
  const parsed = readAuthParams(form, config2.scopes);
  if ("error" in parsed) return errorPage(config2.brand, "Ung\xFCltige Anfrage", parsed.error);
  const client = await loadClient(env, parsed.client_id);
  if (!client) return errorPage(config2.brand, "Unbekannter Client", "Diese client_id ist nicht registriert.");
  if (!client.redirect_uris.includes(parsed.redirect_uri)) {
    return errorPage(config2.brand, "Ung\xFCltige redirect_uri", "Die redirect_uri geh\xF6rt nicht zu diesem Client.");
  }
  const credentials = {};
  let fehlend = "";
  for (const f of config2.brand.fields) {
    const v = String(form.get(f.name) ?? "").trim();
    if (!v) fehlend = fehlend || f.label;
    credentials[f.name] = v;
  }
  const retry = (msg) => consentPage({
    brand: config2.brand,
    clientName: client.client_name,
    clientUri: client.client_uri,
    error: msg,
    params: {
      client_id: parsed.client_id,
      redirect_uri: parsed.redirect_uri,
      state: parsed.state,
      code_challenge: parsed.code_challenge,
      scope: parsed.scope,
      response_type: "code",
      code_challenge_method: "S256"
    }
  });
  if (fehlend) return retry(`Bitte ${fehlend} eingeben.`);
  let who;
  try {
    who = await config2.validate(credentials);
  } catch (e) {
    return retry(`${config2.brand.system} hat den Zugang abgelehnt: ${e.message}`);
  }
  const grantId = randomToken("hmcp_g_");
  const grant = {
    clientId: client.client_id,
    clientName: client.client_name,
    account: who.account,
    user: who.user,
    created: Date.now()
  };
  await env.OAUTH_KV.put(`grant:${grantId}`, JSON.stringify(grant), {
    expirationTtl: REFRESH_TTL
  });
  const code = randomToken("hmcp_ac_");
  await env.OAUTH_KV.put(
    `ac:${await sha256hex(code)}`,
    JSON.stringify({
      clientId: client.client_id,
      redirectUri: parsed.redirect_uri,
      codeChallenge: parsed.code_challenge,
      grantId,
      scope: parsed.scope,
      sealed: await sealJSON(code, { credentials })
    }),
    { expirationTtl: CODE_TTL }
  );
  const to = new URL(parsed.redirect_uri);
  to.searchParams.set("code", code);
  if (parsed.state) to.searchParams.set("state", parsed.state);
  return Response.redirect(to.toString(), 302);
}
async function authenticateClient(req2, form, env) {
  let clientId = String(form.get("client_id") ?? "");
  let clientSecret = String(form.get("client_secret") ?? "");
  const basic = req2.headers.get("authorization");
  if (basic?.toLowerCase().startsWith("basic ")) {
    try {
      const [id, secret] = atob(basic.slice(6)).split(":");
      clientId = clientId || decodeURIComponent(id ?? "");
      clientSecret = clientSecret || decodeURIComponent(secret ?? "");
    } catch {
      return oauthError("invalid_client", "Basic-Auth-Header ist unlesbar.", 401);
    }
  }
  if (!clientId) return oauthError("invalid_client", "client_id fehlt.", 401);
  const client = await loadClient(env, clientId);
  if (!client) return oauthError("invalid_client", "Unbekannte client_id.", 401);
  if (client.client_secret_hash) {
    if (!clientSecret) return oauthError("invalid_client", "client_secret fehlt.", 401);
    const given = await sha256hex(clientSecret);
    if (!timingSafeEqual(given, client.client_secret_hash)) {
      return oauthError("invalid_client", "client_secret stimmt nicht.", 401);
    }
  }
  return client;
}
async function issueTokens(env, grantId, clientId, credentials, scope) {
  const accessToken = randomToken("hmcp_at_");
  const refreshToken = randomToken("hmcp_rt_");
  await Promise.all([
    env.OAUTH_KV.put(
      `at:${await sha256hex(accessToken)}`,
      JSON.stringify({ grantId, clientId, sealed: await sealJSON(accessToken, { credentials }) }),
      { expirationTtl: ACCESS_TTL }
    ),
    env.OAUTH_KV.put(
      `rt:${await sha256hex(refreshToken)}`,
      JSON.stringify({ grantId, clientId, sealed: await sealJSON(refreshToken, { credentials }) }),
      { expirationTtl: REFRESH_TTL }
    )
  ]);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refreshToken,
    scope
  };
}
async function handleToken(req2, env, config2) {
  let form;
  try {
    form = await req2.formData();
  } catch {
    return oauthError("invalid_request", "Body muss application/x-www-form-urlencoded sein.");
  }
  const client = await authenticateClient(req2, form, env);
  if (client instanceof Response) return client;
  const grantType = String(form.get("grant_type") ?? "");
  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const verifier = String(form.get("code_verifier") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    if (!code) return oauthError("invalid_request", "code fehlt.");
    if (!verifier) return oauthError("invalid_request", "code_verifier fehlt (PKCE ist Pflicht).");
    const kvKey = `ac:${await sha256hex(code)}`;
    const rec = await env.OAUTH_KV.get(kvKey, "json");
    if (!rec) return oauthError("invalid_grant", "Code unbekannt, abgelaufen oder schon benutzt.");
    await env.OAUTH_KV.delete(kvKey);
    if (rec.clientId !== client.client_id) {
      return oauthError("invalid_grant", "Der Code geh\xF6rt zu einem anderen Client.");
    }
    if (redirectUri && redirectUri !== rec.redirectUri) {
      return oauthError("invalid_grant", "redirect_uri stimmt nicht mit der Autorisierung \xFCberein.");
    }
    if (!await verifyPkceS256(verifier, rec.codeChallenge)) {
      return oauthError("invalid_grant", "code_verifier passt nicht zur code_challenge.");
    }
    const { credentials } = await openJSON(code, rec.sealed);
    return json(
      await issueTokens(env, rec.grantId, client.client_id, credentials, rec.scope ?? config2.scopes)
    );
  }
  if (grantType === "refresh_token") {
    const token = String(form.get("refresh_token") ?? "");
    if (!token) return oauthError("invalid_request", "refresh_token fehlt.");
    const kvKey = `rt:${await sha256hex(token)}`;
    const rec = await env.OAUTH_KV.get(kvKey, "json");
    if (!rec) return oauthError("invalid_grant", "refresh_token unbekannt oder abgelaufen.");
    if (rec.clientId !== client.client_id) {
      return oauthError("invalid_grant", "Das Token geh\xF6rt zu einem anderen Client.");
    }
    const grant = await env.OAUTH_KV.get(`grant:${rec.grantId}`, "json");
    if (!grant || grant.revoked) {
      return oauthError("invalid_grant", "Die Freigabe wurde widerrufen.");
    }
    await env.OAUTH_KV.delete(kvKey);
    const { credentials } = await openJSON(token, rec.sealed);
    return json(await issueTokens(env, rec.grantId, client.client_id, credentials, config2.scopes));
  }
  return oauthError("unsupported_grant_type", `grant_type '${grantType}' wird nicht unterst\xFCtzt.`);
}
async function handleRevoke(req2, env) {
  let form;
  try {
    form = await req2.formData();
  } catch {
    return oauthError("invalid_request", "Body muss application/x-www-form-urlencoded sein.");
  }
  const token = String(form.get("token") ?? "");
  if (token) {
    const hash = await sha256hex(token);
    const rec = await env.OAUTH_KV.get(`at:${hash}`, "json") ?? await env.OAUTH_KV.get(`rt:${hash}`, "json");
    await Promise.all([env.OAUTH_KV.delete(`at:${hash}`), env.OAUTH_KV.delete(`rt:${hash}`)]);
    if (rec?.grantId) {
      const grant = await env.OAUTH_KV.get(`grant:${rec.grantId}`, "json");
      if (grant) {
        await env.OAUTH_KV.put(
          `grant:${rec.grantId}`,
          JSON.stringify({ ...grant, revoked: true }),
          { expirationTtl: REFRESH_TTL }
        );
      }
    }
  }
  return json({});
}
async function authenticate(req2, env) {
  const header = req2.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const rec = await env.OAUTH_KV.get(`at:${await sha256hex(token)}`, "json");
  if (!rec) return null;
  const grant = await env.OAUTH_KV.get(`grant:${rec.grantId}`, "json");
  if (!grant || grant.revoked) return null;
  try {
    const { credentials } = await openJSON(token, rec.sealed);
    return {
      credentials,
      grantId: rec.grantId,
      clientId: rec.clientId,
      account: grant.account,
      user: grant.user
    };
  } catch {
    return null;
  }
}

// shared/src/mcp.ts
var PROTOCOL_VERSION = "2025-06-18";
var SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
var result = (id, res) => ({ jsonrpc: "2.0", id, result: res });
var rpcError = (id, code, message) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message }
});
function publicToolList(tools2) {
  return tools2.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations
  }));
}
async function handleRpc(body, session, kv, origin, config2) {
  if (Array.isArray(body)) {
    return rpcError(null, -32600, "JSON-RPC-Batches werden von MCP nicht mehr unterst\xFCtzt.");
  }
  const req2 = body;
  if (!req2 || req2.jsonrpc !== "2.0" || typeof req2.method !== "string") {
    return rpcError(req2?.id, -32600, "Kein g\xFCltiger JSON-RPC-2.0-Request.");
  }
  const isNotification = req2.id === void 0 || req2.id === null;
  switch (req2.method) {
    case "initialize": {
      const wanted = req2.params?.protocolVersion;
      return result(req2.id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(wanted) ? wanted : PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false }
        },
        serverInfo: {
          ...config2.serverInfo,
          /*
           * PNG zuerst: eine data:-URI mit SVG lässt sich zwar überall einbetten, wird aber
           * von etlichen Clients nicht als Bild angenommen. Nur wenn keine Rasterfassung
           * vorliegt, bleibt das SVG die einzige Angabe.
           */
          icons: config2.brand.icon ? [
            { src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["512x512"] },
            { src: `${origin}/icon.svg`, mimeType: "image/svg+xml", sizes: ["any"] }
          ] : [
            {
              src: `data:image/svg+xml;base64,${btoa(config2.brand.logoSvg)}`,
              mimeType: "image/svg+xml",
              sizes: ["any"]
            }
          ]
        },
        instructions: config2.instructions
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null;
    case "ping":
      return result(req2.id, {});
    case "tools/list":
      return result(req2.id, { tools: publicToolList(config2.tools) });
    case "resources/list":
      return result(req2.id, { resources: [] });
    case "resources/templates/list":
      return result(req2.id, { resourceTemplates: [] });
    case "prompts/list":
      return result(req2.id, { prompts: [] });
    case "tools/call": {
      const name = req2.params?.name;
      const tool = config2.tools.find((t) => t.name === name);
      if (!tool) return rpcError(req2.id, -32602, `Unbekanntes Tool '${name}'.`);
      try {
        const ctx = await config2.context(session.credentials, kv, origin);
        const data = await tool.handler(req2.params?.arguments ?? {}, ctx);
        return result(req2.id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false
        });
      } catch (e) {
        const err = e;
        const detail = err.detail ? `
${JSON.stringify(err.detail).slice(0, 600)}` : "";
        return result(req2.id, {
          content: [{ type: "text", text: `Fehler in ${name}: ${err.message}${detail}` }],
          isError: true
        });
      }
    }
    default:
      if (isNotification) return null;
      return rpcError(req2.id, -32601, `Methode '${req2.method}' wird nicht unterst\xFCtzt.`);
  }
}

// shared/src/worker.ts
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-protocol-version",
  "access-control-max-age": "86400"
};
var json2 = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS }
});
var ICON_CACHE = /* @__PURE__ */ new Map();
function iconResponse(b64, type) {
  let bytes = ICON_CACHE.get(b64);
  if (!bytes) {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    ICON_CACHE.set(b64, bytes);
  }
  return new Response(bytes, {
    headers: { "content-type": type, "cache-control": "public, max-age=86400", ...CORS }
  });
}
function createWorker(config2) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const origin = `${url.protocol}//${url.host}`;
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const hub = env.HUB_URL ?? "https://mcp-hub.ksqsebastian.workers.dev";
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
      }
      switch (`${request.method} ${path}`) {
        case "GET /":
          return landingPage(config2.brand, origin, config2.tools.length, hub);
        case "GET /favicon.svg":
        case "GET /icon.svg":
          return new Response(config2.brand.logoSvg, {
            headers: {
              "content-type": "image/svg+xml",
              "cache-control": "public, max-age=86400",
              ...CORS
            }
          });
        /* Rasterfassungen. Ohne sie bleibt jede Stelle leer, die kein SVG liest. */
        case "GET /favicon.ico":
          if (!config2.brand.icon) break;
          return iconResponse(config2.brand.icon.ico, "image/x-icon");
        case "GET /icon.png":
          if (!config2.brand.icon) break;
          return iconResponse(config2.brand.icon.png512, "image/png");
        case "GET /apple-touch-icon.png":
        case "GET /apple-touch-icon-precomposed.png":
          if (!config2.brand.icon) break;
          return iconResponse(config2.brand.icon.png180, "image/png");
        case "GET /.well-known/oauth-authorization-server":
        case "GET /.well-known/oauth-authorization-server/mcp":
          return json2(authServerMetadata(origin, config2.scopes));
        case "GET /.well-known/oauth-protected-resource":
        case "GET /.well-known/oauth-protected-resource/mcp":
          return json2(protectedResourceMetadata(origin, config2.scopes));
        case "POST /register":
          return handleRegister(request, env);
        case "GET /authorize":
          return handleAuthorizeGet(url, env, config2);
        case "POST /authorize":
          return handleAuthorizePost(request, env, config2);
        case "POST /token":
          return handleToken(request, env, config2);
        case "POST /revoke":
          return handleRevoke(request, env);
        /** Öffentlicher Katalog — die Übersichtsseite baut sich daraus, ohne Zugangsdaten. */
        case "GET /tools.json":
          return json2({
            server: {
              name: config2.serverInfo.name,
              version: config2.serverInfo.version,
              protocolVersion: PROTOCOL_VERSION
            },
            mcpUrl: `${origin}/mcp`,
            auth: "oauth2",
            tools: publicToolList(config2.tools)
          });
        case "GET /mcp":
          return json2(
            { error: "method_not_allowed", error_description: "MCP l\xE4uft hier \xFCber POST /mcp." },
            405
          );
        case "DELETE /mcp":
          return new Response(null, { status: 204, headers: CORS });
        case "POST /mcp": {
          const session = await authenticate(request, env);
          if (!session) {
            return unauthorized(
              origin,
              config2.serverInfo.name,
              "G\xFCltiges Bearer-Token erforderlich."
            );
          }
          let body;
          try {
            body = await request.json();
          } catch {
            return json2(
              { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
              400
            );
          }
          const res = await handleRpc(body, session, env.OAUTH_KV, origin, config2);
          if (res === null) return new Response(null, { status: 202, headers: CORS });
          return json2(res);
        }
      }
      const extra = await config2.extraRoutes?.(request, url, env);
      if (extra) return extra;
      return errorPage(
        config2.brand,
        "Nicht gefunden",
        `${request.method} ${path} gibt es hier nicht.`,
        404
      );
    }
  };
}

// shared/src/marks.ts
var DOCUWARE_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 172.51 172.5"><circle fill="#ffffff" cx="86.25" cy="86" r="58.21"/><path fill="#303ab2" d="M113.48,86a32.84,32.84,0,0,1-32.86,32.86h-.06V97H58.63V75.08H80.56V53.15h.06A32.89,32.89,0,0,1,113.48,86"/><path fill="#303ab2" d="M147.24,25a86.24,86.24,0,1,0,25.27,61,86,86,0,0,0-25.27-61M119.79,125.17a55.05,55.05,0,0,1-39.17,16.22h-.06V118.88H58.63V97H36.69V75.08H58.63V53.15H80.56V30.62h.06a55.39,55.39,0,0,1,39.17,94.55"/></svg>',
  bg: "#ffffff",
  border: true,
  accent: "#303AB2",
  /* Ein Kreis füllt seine Umschreibung ganz aus und wirkt auf der Kachel darum kleiner
     als ein Zeichen, das Ecken hat — deshalb hier deutlich über der Voreinstellung. */
  fill: 0.7
};
var FILL = 0.56;
function composeLogo(mark, size = 512) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(mark.inner)?.[1]?.trim().split(/\s+/).map(Number);
  const [minX, minY, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 1, 1];
  const box = size * (mark.fill ?? FILL);
  const scale = Math.min(box / vw, box / vh);
  const tx = (size - vw * scale) / 2 - minX * scale;
  const ty = (size - vh * scale) / 2 - minY * scale;
  const body = mark.inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const radius = Math.round(size * 0.219);
  const stroke = mark.border ? `<rect x=".5" y=".5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="none" stroke="#dcdce2" stroke-width="${Math.max(1, size / 170)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${mark.bg}"/>${stroke}<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(4)})">${body}</g></svg>`;
}

// shared/src/icons.generated.ts
var DOCUWARE_ICON = {
  png512: "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",
  png180: "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",
  ico: "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"
};

// servers/docuware/src/client.ts
var DocuwareError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "DocuwareError";
  }
  /** Gesetzt, wenn DocuWare die Zugangsdaten abgelehnt hat (400/401 beim Token). */
  rejected;
};
function platformUrl(value) {
  const v = String(value ?? "").trim();
  if (!v) throw new DocuwareError("Es fehlt die DocuWare-URL.");
  let base = v.replace(/\/DocuWare\/Platform\/?$/i, "");
  if (!/^https?:\/\//i.test(base)) {
    if (!base.includes(".")) base = `${base}.docuware.cloud`;
    base = `https://${base}`;
  }
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new DocuwareError(`'${value}' ergibt keine g\xFCltige URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new DocuwareError("Die DocuWare-URL muss https sein.");
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path}/DocuWare/Platform`;
}
function originOf(platform) {
  return new URL(platform).origin;
}
function links(config2) {
  const out = {};
  const list = config2?.Links;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const rel = entry?.rel ?? entry?.Rel;
      const href = entry?.href ?? entry?.Href;
      if (typeof rel === "string" && typeof href === "string") out[rel.toLowerCase()] = href;
    }
  }
  return out;
}
function link(config2, rel, was) {
  const table = links(config2);
  const found = table[rel.toLowerCase()];
  if (!found) {
    const bekannt = Object.keys(table).sort().join(", ") || "keine";
    throw new DocuwareError(
      `${was} hat keine Beziehung '${rel}'. DocuWare gibt die Folgeadressen selbst vor; hier ist sie nicht dabei. Vorhanden: ${bekannt}.`
    );
  }
  return found;
}
function dwDate(value, withTime = false) {
  if (value === null || value === void 0) return null;
  const s = String(value);
  const m = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(s);
  if (m) {
    const ms = Number(m[1]);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const iso = new Date(ms).toISOString();
    return withTime ? iso.slice(0, 19).replace("T", " ") : iso.slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return withTime ? s.slice(0, 19).replace("T", " ") : s.slice(0, 10);
  }
  return null;
}
var MIN_INTERVAL_MS = 150;
var MAX_RETRIES = 3;
var slots = /* @__PURE__ */ new Map();
function slotFor(key) {
  const now = Date.now();
  if (slots.size > 64) {
    for (const [k, v] of slots) if (now - v.touched > 6e4) slots.delete(k);
  }
  let slot = slots.get(key);
  if (!slot) {
    slot = { nextAt: 0, chain: Promise.resolve(), touched: now };
    slots.set(key, slot);
  }
  slot.touched = now;
  return slot;
}
var BUILTIN_CLIENT_ID = "docuware.platform.net.client";
var SCOPE = "docuware.platform";
var GUID = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;
function grantOrder(username) {
  return GUID.test(String(username ?? "").trim()) ? ["client_credentials", "password"] : ["password", "client_credentials"];
}
var DISCOVERY_TTL = 12 * 60 * 60;
var TOKEN_SKEW_SECONDS = 120;
var USER_AGENT = "mcpees-docuware-mcp (github.com/ksqsebastian-spec/mcpees)";
var Docuware = class {
  constructor(credentials, kv = null) {
    this.credentials = credentials;
    this.kv = kv;
  }
  calls = 0;
  /** Womit die Anmeldung zuletzt geklappt hat — für system_info. */
  grant = null;
  /*
   * Discovery und Token gelten für die Lebensdauer dieses Objekts, nicht für einen
   * einzelnen Aufruf. Ohne diese beiden Felder würde jeder Request die Anmeldung von vorn
   * beginnen: das Prüfen der Zugangsdaten allein sind drei Aufrufe gegen DocuWare, und
   * ohne KV — genau dann ist es der Fall — läge dahinter dreimal dieselbe Anmeldung.
   * Gespeichert wird das Promise, nicht der Wert: so laufen auch zwei gleichzeitige
   * Aufrufe nur in eine Anmeldung und nicht in zwei.
   */
  discovery = null;
  accessToken = null;
  get platform() {
    return this.credentials.url;
  }
  /** Ein Schlüssel je Zugang, aus dem sich der Zugang nicht zurückrechnen lässt. */
  async fingerprint() {
    return sha256hex(this.secret);
  }
  get secret() {
    return `${this.credentials.url}\0${this.credentials.username}\0${this.credentials.password}`;
  }
  /* ── Anmeldung ─────────────────────────────────────────────────────────── */
  /**
   * Wo der Identity Service liegt und wie sein Token-Endpunkt heißt.
   *
   * Zwei Anfragen, die sich für einen Mandanten nie ändern — deshalb zwölf Stunden in KV.
   * Es steht nichts Geheimes darin: beide Adressen sind ohne Anmeldung abrufbar.
   */
  discover() {
    return this.discovery ??= this.lookupDiscovery();
  }
  async lookupDiscovery() {
    const key = `dw:oidc:${await sha256hex(this.platform)}`;
    if (this.kv) {
      const cached = await this.kv.get(key, "json");
      if (cached?.tokenEndpoint) return cached;
    }
    const infoUrl = `${this.platform}/Home/IdentityServiceInfo`;
    const info = await this.plainJson(infoUrl, "Die Auskunft \xFCber den Identity Service");
    const identityUrl = String(info?.IdentityServiceUrl ?? "").trim();
    if (!identityUrl) {
      throw new DocuwareError(
        `${infoUrl} nennt keine IdentityServiceUrl. Entweder zeigt die URL nicht auf eine DocuWare-Installation, oder sie ist \xE4lter als 7.10 \u2014 davor gab es dort kein OAuth.`,
        info
      );
    }
    const wellKnown = `${identityUrl.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    const oidc = await this.plainJson(wellKnown, "Die OpenID-Connect-Beschreibung");
    const tokenEndpoint = String(oidc?.token_endpoint ?? "").trim();
    if (!tokenEndpoint) {
      throw new DocuwareError(`${wellKnown} nennt keinen token_endpoint.`, oidc);
    }
    const found = { identityUrl, tokenEndpoint };
    await this.kv?.put(key, JSON.stringify(found), { expirationTtl: DISCOVERY_TTL });
    return found;
  }
  /** Eine JSON-Antwort ohne Anmeldung holen — für die beiden Discovery-Schritte. */
  async plainJson(url, was) {
    let res;
    try {
      res = await this.fetchThrottled(url, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT }
      });
    } catch (err) {
      throw new DocuwareError(
        `${url} ist nicht erreichbar: ${err.message}. Stimmt die DocuWare-URL?`
      );
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DocuwareError(
        `${was} ist unter ${url} nicht zu bekommen (HTTP ${res.status}). Stimmt die DocuWare-URL?`,
        text.slice(0, 300)
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DocuwareError(`${url} antwortet nicht mit JSON.`, text.slice(0, 300));
    }
  }
  /**
   * Ein gültiges Access-Token, notfalls frisch geholt.
   *
   * Zwischengespeichert wird es verschlüsselt: der Schlüssel wird aus den Zugangsdaten
   * abgeleitet, in KV steht nur Chiffretext. Wer die KV-Daten hat, aber die Zugangsdaten
   * nicht, hat nichts — dieselbe Bauart wie beim OAuth-Token dieses Servers selbst.
   */
  token() {
    return this.accessToken ??= this.fetchToken();
  }
  async fetchToken() {
    const key = `dw:tok:${await this.fingerprint()}`;
    if (this.kv) {
      const sealed = await this.kv.get(key, "text");
      if (sealed) {
        try {
          const rec = await openJSON(this.secret, sealed);
          if (rec?.token) {
            this.grant = rec.grant;
            return rec.token;
          }
        } catch {
        }
      }
    }
    const { tokenEndpoint } = await this.discover();
    let first = null;
    for (const grant of grantOrder(this.credentials.username)) {
      try {
        const { token, expiresIn } = await this.requestToken(tokenEndpoint, grant);
        this.grant = grant;
        const ttl = Math.max(60, Math.min(expiresIn, 12 * 60 * 60) - TOKEN_SKEW_SECONDS);
        if (this.kv) {
          await this.kv.put(key, await sealJSON(this.secret, { token, grant }), {
            expirationTtl: ttl
          });
        }
        return token;
      } catch (err) {
        if (!(err instanceof DocuwareError) || !err.rejected) throw err;
        first ??= err;
      }
    }
    throw new DocuwareError(
      `DocuWare lehnt die Zugangsdaten ab \u2014 weder als Benutzername mit Passwort noch als ` + `Client-ID mit Secret einer App-Registrierung. ${first?.message ?? ""}`.trim(),
      first?.detail
    );
  }
  async requestToken(tokenEndpoint, grant) {
    const form = new URLSearchParams(
      grant === "password" ? {
        grant_type: "password",
        username: this.credentials.username,
        password: this.credentials.password,
        client_id: BUILTIN_CLIENT_ID,
        scope: SCOPE
      } : {
        grant_type: "client_credentials",
        client_id: this.credentials.username,
        client_secret: this.credentials.password,
        scope: SCOPE
      }
    );
    const res = await this.fetchThrottled(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": USER_AGENT
      },
      body: form.toString()
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
    }
    if (!res.ok) {
      const err = new DocuwareError(
        `Der Identity Service lehnt die Anmeldung ab (HTTP ${res.status}${parsed?.error ? `, ${parsed.error}` : ""}).`,
        parsed ?? text.slice(0, 300)
      );
      err.rejected = res.status === 400 || res.status === 401;
      throw err;
    }
    const token = String(parsed?.access_token ?? "");
    if (!token) throw new DocuwareError("Der Identity Service liefert kein access_token.", parsed);
    const expiresIn = Number(parsed?.expires_in);
    return { token, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600 };
  }
  /* ── Aufrufe gegen die Platform-API ────────────────────────────────────── */
  /**
   * Einen Link auflösen. DocuWare gibt Beziehungen als absolute Pfade an
   * (`/DocuWare/Platform/FileCabinets/…`), gelegentlich auch als vollständige URL.
   */
  resolve(href) {
    return /^https?:\/\//i.test(href) ? href : new URL(href, originOf(this.platform)).toString();
  }
  async request(method, href, opts = {}) {
    const url = new URL(this.resolve(href));
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== void 0 && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const send = async (token) => {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: opts.accept ?? "application/json",
        "User-Agent": USER_AGENT
      };
      let body;
      if (opts.form) {
        body = opts.form;
      } else if (opts.body !== void 0) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
      return this.fetchThrottled(url.toString(), { method, headers, body });
    };
    let res;
    try {
      res = await send(await this.token());
    } catch (err) {
      this.accessToken = null;
      throw err;
    }
    if (res.status === 401) {
      await this.forgetToken();
      res = await send(await this.token());
    }
    for (let attempt = 0; res.status === 429 && attempt < MAX_RETRIES; attempt++) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1e3 : 1e3 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, waitMs));
      res = await send(await this.token());
    }
    return res;
  }
  /** Aufruf mit JSON-Antwort. Wirft mit übersetzter Meldung, wenn DocuWare ablehnt. */
  async json(method, href, opts = {}) {
    const res = await this.request(method, href, opts);
    const text = await res.text();
    if (!res.ok) throw explain(res.status, method, href, text);
    if (!text) return void 0;
    try {
      return JSON.parse(text);
    } catch {
      throw new DocuwareError(
        `DocuWare antwortet auf ${method} ${href} nicht mit JSON.`,
        text.slice(0, 300)
      );
    }
  }
  /** Aufruf mit Binärantwort — für Dokumente und Anhänge. */
  async bytes(href, opts = {}) {
    const res = await this.request("GET", href, { ...opts, accept: opts.accept ?? "*/*" });
    if (!res.ok) throw explain(res.status, "GET", href, await res.text());
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      filename: filenameOf(res.headers.get("content-disposition"))
    };
  }
  async forgetToken() {
    this.accessToken = null;
    if (this.kv) await this.kv.delete(`dw:tok:${await this.fingerprint()}`);
  }
  fetchThrottled(url, init) {
    const slot = slotFor(`${this.credentials.url}\0${this.credentials.username}`);
    const run = async () => {
      const now = Date.now();
      const wait = Math.max(0, slot.nextAt - now);
      slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.calls++;
      return fetch(url, init);
    };
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => void 0);
    return queued;
  }
};
function filenameOf(header) {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return sanitizeFilename(decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")));
    } catch {
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? sanitizeFilename(plain[1]) : null;
}
function sanitizeFilename(name) {
  return String(name ?? "").replace(/[\\/]/g, "_").replace(/["\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "dokument";
}
function explain(status, method, href, text) {
  let detail = text.slice(0, 800);
  let message = "";
  try {
    const parsed = JSON.parse(text);
    detail = parsed;
    message = String(parsed?.Message ?? parsed?.message ?? "");
  } catch {
  }
  const suffix = message ? ` DocuWare sagt: ${message.slice(0, 300)}` : "";
  const op = `${method} ${href}`;
  switch (status) {
    case 400:
      return new DocuwareError(
        `DocuWare weist die Anfrage zur\xFCck (400) bei ${op}. Bei einer Suche steckt dahinter meist ein Feldname, den der Aktenschrank nicht kennt, oder ein Wert, der nicht zum Feldtyp passt \u2014 'index_fields' zeigt beides.${suffix}`,
        detail
      );
    case 401:
      return new DocuwareError(
        `DocuWare lehnt die Anmeldung ab (401) bei ${op}. Das Passwort wurde ge\xE4ndert, oder das Konto ist gesperrt.${suffix}`,
        detail
      );
    case 403:
      return new DocuwareError(
        `Keine Berechtigung f\xFCr ${op} (403). Der DocuWare-Benutzer hinter diesem Zugang darf das nicht \u2014 Rechte am Aktenschrank werden in DocuWare selbst vergeben.${suffix}`,
        detail
      );
    case 404:
      return new DocuwareError(`Nicht gefunden: ${op} (404).${suffix}`, detail);
    case 429:
      return new DocuwareError(
        `DocuWare drosselt (429) bei ${op} \u2014 auch nach mehreren Wiederholungen.${suffix}`,
        detail
      );
    default:
      return new DocuwareError(`DocuWare HTTP ${status} bei ${op}.${suffix}`, detail);
  }
}

// servers/docuware/src/structure.ts
var TTL_SECONDS = 12 * 60 * 60;
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
}
async function keyFor(dw, suffix) {
  return `dw:${suffix}:${await sha256hex(
    `${dw.credentials.url} ${dw.credentials.username} ${dw.credentials.password}`
  )}`;
}
async function structure(dw, kv) {
  const key = await keyFor(dw, "struct");
  if (kv) {
    const cached = await kv.get(key, "json");
    if (cached?.cabinets) return cached;
  }
  const root = await dw.json("GET", dw.platform);
  const orgList = await dw.json(
    "GET",
    link(root, "organizations", "Die DocuWare-Wurzel")
  );
  const orgs = Array.isArray(orgList?.Organization) ? orgList.Organization : [];
  if (orgs.length === 0) {
    throw new DocuwareError(
      "Dieser Zugang sieht keine einzige Organisation. In DocuWare h\xE4ngen die Rechte am Benutzer \u2014 ohne Zuordnung zu einer Organisation ist die API leer."
    );
  }
  const org = orgs[0];
  const cabinetList = await dw.json(
    "GET",
    link(org, "filecabinets", `Die Organisation '${org?.Name ?? ""}'`)
  );
  const cabinets = (Array.isArray(cabinetList?.FileCabinet) ? cabinetList.FileCabinet : []).map((fc) => {
    const rel = links(fc);
    return {
      id: String(fc?.Id ?? ""),
      name: String(fc?.Name ?? ""),
      isBasket: Boolean(fc?.IsBasket),
      documents: rel["documents"] ?? "",
      dialogs: rel["dialogs"] ?? null
    };
  });
  const found = {
    version: String(root?.Version ?? "unbekannt"),
    organizationId: String(org?.Id ?? ""),
    organizationName: String(org?.Name ?? ""),
    cabinets,
    fetchedAt: Date.now()
  };
  await kv?.put(key, JSON.stringify(found), { expirationTtl: TTL_SECONDS });
  return found;
}
function findCabinet(struct, key, basketsToo = true) {
  const wanted = String(key ?? "").trim();
  if (!wanted) throw new DocuwareError("Es fehlt die Angabe, welcher Aktenschrank gemeint ist.");
  const pool = basketsToo ? struct.cabinets : struct.cabinets.filter((c) => !c.isBasket);
  const hit = pool.find((c) => c.id === wanted) ?? pool.find((c) => norm(c.name) === norm(wanted));
  if (hit) return hit;
  const liste = pool.map((c) => `${c.name}${c.isBasket ? " (Briefkorb)" : ""}`).join(", ");
  throw new DocuwareError(
    `'${wanted}' ist kein Aktenschrank dieses Zugangs. Vorhanden: ${liste || "keiner"}.`
  );
}
async function cabinetDetail(dw, kv, cabinet) {
  const key = `${await keyFor(dw, "cab")}:${cabinet.id}`;
  if (kv) {
    const cached = await kv.get(key, "json");
    if (cached?.fields) return cached;
  }
  if (!cabinet.dialogs) {
    throw new DocuwareError(
      `'${cabinet.name}' nennt keine Dialoge. Ohne Suchdialog gibt DocuWare weder die Indexfelder her noch eine Adresse, an die eine Suche gehen k\xF6nnte.`
    );
  }
  const dialogList = await dw.json("GET", cabinet.dialogs);
  const all = Array.isArray(dialogList?.Dialog) ? dialogList.Dialog : [];
  const usable = all.filter(
    (d) => d?.$type === "DialogInfo" && !String(d?.Id ?? "").includes("_")
  );
  const searchInfo = usable.find((d) => d?.Type === "Search" && d?.IsDefault) ?? usable.find((d) => d?.Type === "Search") ?? null;
  const storeInfo = usable.find((d) => d?.Type === "Store" && d?.IsDefault) ?? usable.find((d) => d?.Type === "Store") ?? null;
  const felder = /* @__PURE__ */ new Map();
  const sammle = (config2, woher) => {
    for (const f of Array.isArray(config2?.Fields) ? config2.Fields : []) {
      const id = String(f?.DBFieldName ?? "").trim();
      if (!id) continue;
      const vorhanden = felder.get(id);
      if (vorhanden) {
        if (!vorhanden.in.includes(woher)) vorhanden.in.push(woher);
        continue;
      }
      const laenge = Number(f?.Length);
      felder.set(id, {
        id,
        label: String(f?.DlgLabel ?? id),
        type: String(f?.DWFieldType ?? "unbekannt"),
        length: Number.isFinite(laenge) && laenge > 0 ? laenge : null,
        selectList: links(f)["simpleselectlist"] ?? null,
        in: [woher]
      });
    }
  };
  let searchDialog = null;
  if (searchInfo) {
    const config2 = await dw.json(
      "GET",
      link(searchInfo, "self", `Der Suchdialog '${searchInfo?.DisplayName ?? searchInfo?.Id}'`)
    );
    sammle(config2, "suche");
    searchDialog = {
      id: String(searchInfo?.Id ?? ""),
      name: String(searchInfo?.DisplayName ?? searchInfo?.Id ?? ""),
      // Gesucht wird nicht gegen den Dialog, sondern gegen den Ausdruck darunter.
      expression: link(
        config2?.Query,
        "dialogExpression",
        `Der Suchdialog '${searchInfo?.DisplayName ?? searchInfo?.Id}'`
      )
    };
  }
  let storeDialog = null;
  if (storeInfo) {
    const config2 = await dw.json(
      "GET",
      link(storeInfo, "self", `Der Ablagedialog '${storeInfo?.DisplayName ?? storeInfo?.Id}'`)
    );
    sammle(config2, "ablage");
    storeDialog = {
      id: String(storeInfo?.Id ?? ""),
      name: String(storeInfo?.DisplayName ?? storeInfo?.Id ?? "")
    };
  }
  const detail = {
    cabinet,
    searchDialog,
    storeDialog,
    fields: [...felder.values()],
    fetchedAt: Date.now()
  };
  await kv?.put(key, JSON.stringify(detail), { expirationTtl: TTL_SECONDS });
  return detail;
}
function findField(detail, name) {
  const wanted = String(name ?? "").trim();
  if (!wanted) throw new DocuwareError("Es fehlt der Feldname.");
  const hit = detail.fields.find((f) => f.id.toLowerCase() === wanted.toLowerCase()) ?? detail.fields.find((f) => norm(f.label) === norm(wanted));
  if (hit) return hit;
  const liste = detail.fields.map((f) => `${f.id} (${f.label})`).join(", ");
  throw new DocuwareError(
    `'${wanted}' ist kein Indexfeld von '${detail.cabinet.name}'. Vorhanden: ${liste || "keine"}.`
  );
}

// servers/docuware/src/files.ts
var MAX_MINUTES = 60 * 24;
async function createFileLink(kv, credentials, target, minutes) {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("dwmcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credentials }),
      href: target.href,
      filename: target.filename,
      keepAnnotations: target.keepAnnotations
    }),
    { expirationTtl: ttl * 60 }
  );
  return { token, expiresInMinutes: ttl };
}
async function serveFile(request, url, env) {
  const match = /^\/f\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (!match || request.method !== "GET") return null;
  const token = match[1];
  const rec = await env.OAUTH_KV.get(`dl:${await sha256hex(token)}`, "json");
  if (!rec) {
    return new Response("Dieser Link ist abgelaufen oder ung\xFCltig.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  let credentials;
  try {
    ({ credentials } = await openJSON(token, rec.sealed));
  } catch {
    return new Response("Link ung\xFCltig.", { status: 404 });
  }
  let datei;
  try {
    datei = await new Docuware(credentials, env.OAUTH_KV).bytes(String(rec.href), {
      query: {
        keepAnnotations: rec.keepAnnotations ? "true" : "false",
        // Anmerkungen gibt es nur im PDF; ohne sie bleibt das Original, wie es ist.
        targetFileType: rec.keepAnnotations ? "PDF" : "Auto"
      }
    });
  } catch (err) {
    return new Response(`DocuWare liefert die Datei nicht aus: ${err.message}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  const filename = sanitizeFilename(datei.filename || rec.filename || "dokument.pdf");
  return new Response(datei.bytes, {
    headers: {
      "content-type": datei.contentType,
      "content-disposition": `inline; filename="${filename}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

// servers/docuware/src/search.ts
function quoteValue(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      out += ch + s[i + 1];
      i++;
    } else if (ch === "(" || ch === ")") {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}
function searchValue(value, feld) {
  if (value === null || value === void 0 || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (/^(date|datetime)$/i.test(feld.type) && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
    throw new DocuwareError(
      `'${s}' ist kein Datum f\xFCr das Feld ${feld.id} (${feld.label}). Erwartet wird 'YYYY-MM-DD'. F\xFCr \u201Evon\u2013bis" eine Liste aus zwei Werten \xFCbergeben.`
    );
  }
  return quoteValue(s);
}
function buildConditions(detail, bedingungen) {
  const conditions = [];
  const felder = [];
  for (const [name, roh] of Object.entries(bedingungen ?? {})) {
    const feld = findField(detail, name);
    const values = Array.isArray(roh) ? roh.map((v) => searchValue(v, feld)) : [searchValue(roh, feld)];
    if (Array.isArray(roh) && roh.length !== 2 && roh.some((v) => v === null)) {
      throw new DocuwareError(
        `F\xFCr ${feld.id} steht null in einer Liste mit ${roh.length} Werten. null ist nur als offene Grenze eines Bereichs gedacht \u2014 dann m\xFCssen es genau zwei Werte sein.`
      );
    }
    conditions.push({ DBName: feld.id, Value: values });
    felder.push(feld);
  }
  return { conditions, felder };
}
var DIRECTIONS = {
  auf: "Asc",
  asc: "Asc",
  aufsteigend: "Asc",
  ab: "Desc",
  desc: "Desc",
  absteigend: "Desc"
};
function buildSortOrder(detail, sortierung) {
  return sortierung.map((eintrag) => {
    const [name, richtung = "asc"] = String(eintrag).split(":");
    const feld = findField(detail, name);
    const dir = DIRECTIONS[richtung.trim().toLowerCase()];
    if (!dir) {
      throw new DocuwareError(
        `'${richtung}' ist keine Sortierrichtung. Erlaubt: asc, desc (oder auf, ab).`
      );
    }
    return { Field: feld.id, Direction: dir };
  });
}
function fieldValue(f) {
  const art = String(f?.ItemElementName ?? "");
  const item = f?.Item;
  if (item === null || item === void 0) return null;
  if (art === "Date" || art === "DateTime") return dwDate(item, art === "DateTime");
  if (art === "Keywords") {
    const kw = item?.Keyword;
    return Array.isArray(kw) ? kw : kw ? [kw] : null;
  }
  return item;
}
function rowFields(item) {
  const out = {};
  for (const f of Array.isArray(item?.Fields) ? item.Fields : []) {
    const name = String(f?.FieldName ?? "").trim();
    if (name) out[name] = fieldValue(f);
  }
  return out;
}
async function runSearch(dw, detail, opts) {
  if (!detail.searchDialog) {
    throw new DocuwareError(
      `'${detail.cabinet.name}' hat keinen Suchdialog. In DocuWare h\xE4ngt die Suche an einem Dialog; ohne einen solchen l\xE4sst sich dieser Schrank nicht durchsuchen. Bei einem Briefkorb ist das normal.`
    );
  }
  const { conditions } = buildConditions(detail, opts.bedingungen);
  const body = {
    Condition: conditions,
    Operation: opts.verknuepfung === "oder" ? "Or" : "And"
  };
  if (opts.sortierung.length > 0) {
    body.SortOrder = buildSortOrder(detail, opts.sortierung);
  }
  const gewuenscht = opts.felder.length > 0 ? opts.felder.map((n) => findField(detail, n).id) : detail.fields.filter((f) => f.in.includes("suche")).map((f) => f.id);
  const rueckgabe = [.../* @__PURE__ */ new Set([...gewuenscht, ...conditions.map((c) => c.DBName)])];
  const treffer = [];
  let gesamt = null;
  let seiten = 0;
  let href = detail.searchDialog.expression;
  let method = "POST";
  while (href && treffer.length < opts.maxItems && seiten < 20) {
    const page2 = await dw.json(method, href, {
      query: method === "POST" ? { fields: rueckgabe.join(",") } : void 0,
      body: method === "POST" ? body : void 0
    });
    seiten++;
    const anzahl = Number(page2?.Count?.Value);
    if (Number.isFinite(anzahl)) gesamt = anzahl;
    for (const item of Array.isArray(page2?.Items) ? page2.Items : []) {
      treffer.push({
        id: String(item?.Id ?? ""),
        titel: item?.Title ? String(item.Title) : null,
        aktenschrank: detail.cabinet.name,
        felder: rowFields(item),
        self: links(item)["self"] ?? null
      });
    }
    href = links(page2)["next"] ?? null;
    method = "GET";
  }
  const behalten = treffer.slice(0, opts.maxItems);
  return {
    treffer: behalten,
    gesamt,
    abgeschnitten: gesamt !== null ? gesamt > behalten.length : treffer.length > behalten.length,
    seiten
  };
}

// shared/src/types.ts
var str = (description) => ({ type: "string", description });
var int = (description) => ({ type: "integer", description });
var bool = (description) => ({ type: "boolean", description });
function req(args, name) {
  const v = args[name];
  if (v === void 0 || v === null || v === "") {
    throw new Error(`Pflichtargument '${name}' fehlt.`);
  }
  return v;
}

// servers/docuware/src/tools/read.ts
var DEFAULT_LIMIT = 25;
var MAX_LIMIT = 200;
var limitOf = (args, fallback = DEFAULT_LIMIT) => Math.min(MAX_LIMIT, Math.max(1, Number(args.limit) || fallback));
function attachmentRow(section) {
  return {
    id: section?.Id ?? null,
    dateiname: section?.OriginalFileName ?? null,
    typ: section?.ContentType ?? null,
    groesse_bytes: section?.FileSize ?? null,
    seiten: section?.PageCount ?? null,
    geaendert: dwDate(section?.ContentModified, true),
    hat_anmerkungen: section?.HasTextAnnotation ?? null
  };
}
function textshotToText(shot) {
  const asList = (v) => Array.isArray(v) ? v : v ? [v] : [];
  const zeile = (ln) => asList(ln?.Items).filter((w) => w?.$type === "Word" && w?.Value).map((w) => String(w.Value)).join(" ");
  const zone = (z) => {
    if (z?.$type === "TextZone") return asList(z?.Ln).map(zeile).join("\n");
    if (z?.$type === "TableZone") {
      return asList(z?.Cz).map((c) => c?.TextZone ? asList(c.TextZone?.Ln).map(zeile).join("\n") : "").filter(Boolean).join("\n");
    }
    return "";
  };
  return asList(shot?.Pages).map((p) => asList(p?.Items).map(zone).filter(Boolean).join("\n")).join("\n\n");
}
var readTools = [
  {
    name: "system_info",
    title: "Installation und Anmeldung",
    description: "Zeigt, mit welcher DocuWare-Installation gesprochen wird: Version, Organisation, wie viele Aktenschr\xE4nke und Briefk\xF6rbe sichtbar sind und mit welcher Anmeldeart der Zugang l\xE4uft (Benutzerkonto oder App-Registrierung). Guter erster Aufruf \u2014 er sagt auch, ob der Zugang \xFCberhaupt etwas sieht: In DocuWare h\xE4ngen die Rechte am Benutzer, ein Schrank ohne Berechtigung taucht hier gar nicht erst auf.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const schraenke = struct.cabinets.filter((c) => !c.isBasket);
      const koerbe = struct.cabinets.filter((c) => c.isBasket);
      return {
        docuware_version: struct.version,
        organisation: struct.organizationName,
        organisation_id: struct.organizationId,
        aktenschraenke: schraenke.length,
        briefkoerbe: koerbe.length,
        anmeldeart: ctx.dw.grant === "client_credentials" ? "App-Registrierung (Client-ID und Secret)" : "Benutzerkonto (Benutzername und Passwort)",
        hinweis: schraenke.length === 0 ? "Dieser Zugang sieht keinen einzigen Aktenschrank. Die Rechte daf\xFCr werden in DocuWare selbst vergeben." : "Weiter mit 'file_cabinets', dann 'index_fields' f\xFCr den gew\xFCnschten Schrank."
      };
    }
  },
  {
    name: "file_cabinets",
    title: "Aktenschr\xE4nke und Briefk\xF6rbe",
    description: "Listet alle Aktenschr\xE4nke und Briefk\xF6rbe, die dieser Zugang sehen darf. Ein Aktenschrank ist das Archiv, ein Briefkorb der Posteingang davor \u2014 beide kommen bei DocuWare aus derselben Liste, meinen aber Verschiedenes. Gesucht wird in Aktenschr\xE4nken; ein Briefkorb hat in der Regel keinen Suchdialog. Alle anderen Tools nehmen den Namen oder die Id von hier.",
    inputSchema: {
      type: "object",
      properties: {
        mit_briefkoerben: bool("Briefk\xF6rbe mit auflisten. Default true.")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const mitKoerben = args.mit_briefkoerben !== false;
      return {
        organisation: struct.organizationName,
        schraenke: struct.cabinets.filter((c) => mitKoerben || !c.isBasket).map((c) => ({
          id: c.id,
          name: c.name,
          art: c.isBasket ? "Briefkorb" : "Aktenschrank"
        }))
      };
    }
  },
  {
    name: "index_fields",
    title: "Indexfelder eines Aktenschranks",
    description: "Zeigt die Indexfelder eines Aktenschranks: den Namen, den die API will (z. B. DOCDATE), den Namen, den der Benutzer in DocuWare sieht (z. B. Belegdatum), den Feldtyp und die L\xE4nge. Vor jeder Suche und vor jedem Ablegen aufrufen \u2014 der Anzeigename allein hilft der API nicht, und ein geratener Feldname endet in einem 400 ohne Erkl\xE4rung. 'in' sagt, wof\xFCr ein Feld taugt: 'suche' hei\xDFt, man kann danach filtern, 'ablage' hei\xDFt, man kann es beim Ablegen f\xFCllen.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks.")
      },
      required: ["aktenschrank"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      return {
        aktenschrank: cab.name,
        art: cab.isBasket ? "Briefkorb" : "Aktenschrank",
        suchdialog: detail.searchDialog?.name ?? null,
        ablagedialog: detail.storeDialog?.name ?? null,
        felder: detail.fields.map((f) => ({
          feld: f.id,
          bezeichnung: f.label,
          typ: f.type,
          laenge: f.length,
          hat_auswahlliste: Boolean(f.selectList),
          in: f.in
        }))
      };
    }
  },
  {
    name: "field_values",
    title: "Werte einer Auswahlliste",
    description: "Liefert die erlaubten Werte eines Indexfelds, das in DocuWare eine Auswahlliste hat (z. B. Dokumentart oder Firma). N\xFCtzlich, bevor man danach filtert: ein Wert, den es in der Liste nicht gibt, liefert schlicht keine Treffer \u2014 und das sieht aus wie ein leeres Archiv statt wie ein Tippfehler. Felder ohne Auswahlliste erkennt man in 'index_fields' an hat_auswahlliste=false.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        feld: str("Feldname oder Bezeichnung, z. B. 'DOCTYPE' oder 'Dokumentart'.")
      },
      required: ["aktenschrank", "feld"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      const feld = findField(detail, req(args, "feld"));
      if (!feld.selectList) {
        throw new DocuwareError(
          `${feld.id} (${feld.label}) hat in '${cab.name}' keine Auswahlliste. Der Wert ist frei einzugeben.`
        );
      }
      const antwort = await ctx.dw.json("GET", feld.selectList);
      const werte = Array.isArray(antwort?.Value) ? antwort.Value : [];
      return {
        aktenschrank: cab.name,
        feld: feld.id,
        bezeichnung: feld.label,
        anzahl: werte.length,
        werte
      };
    }
  },
  {
    name: "search_documents",
    title: "Dokumente suchen",
    description: "Sucht Dokumente in einem Aktenschrank \xFCber seine Indexfelder. Bedingungen sind ein Objekt aus Feldname und Wert; der Feldname darf der API-Name (DOCNO) oder die Bezeichnung (Belegnummer) sein. Ein '*' im Wert ist Platzhalter \u2014 'Meier*' findet auch 'Meiers'. Klammern im Wert werden automatisch maskiert, sonst w\xE4ren sie Syntax und die Trefferliste stumm falsch. F\xFCr einen Zeitraum oder Zahlenbereich eine Liste aus zwei Werten \xFCbergeben ([von, bis]); eine offene Grenze ist null. Ein einzelnes null als Wert sucht Dokumente, bei denen das Feld leer ist. Datumsangaben immer als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        bedingungen: {
          type: "object",
          description: 'Feldname -> Wert. Beispiel: {"DOCTYPE": "Rechnung", "DOCDATE": ["2026-01-01", "2026-03-31"]}. Leer lassen findet alles im Schrank.',
          additionalProperties: true
        },
        verknuepfung: str("'und' (Default) oder 'oder' \u2014 wie die Bedingungen zusammenwirken."),
        sortierung: {
          type: "array",
          description: "Sortierfelder, jeweils 'FELD' oder 'FELD:desc'. Mehrere sind erlaubt und wirken in der angegebenen Reihenfolge.",
          items: { type: "string" }
        },
        felder: {
          type: "array",
          description: "Welche Indexfelder in den Treffern stehen sollen. Ohne Angabe kommen alle Felder des Suchdialogs mit.",
          items: { type: "string" }
        },
        limit: int(`H\xF6chstzahl der Treffer, 1 bis ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.`)
      },
      required: ["aktenschrank"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      const verknuepfung = String(args.verknuepfung ?? "und").toLowerCase();
      if (verknuepfung !== "und" && verknuepfung !== "oder") {
        throw new DocuwareError(`'${args.verknuepfung}' ist keine Verkn\xFCpfung. Erlaubt: und, oder.`);
      }
      const ergebnis = await runSearch(ctx.dw, detail, {
        bedingungen: args.bedingungen ?? {},
        verknuepfung,
        sortierung: Array.isArray(args.sortierung) ? args.sortierung.map(String) : [],
        felder: Array.isArray(args.felder) ? args.felder.map(String) : [],
        maxItems: limitOf(args)
      });
      return {
        aktenschrank: cab.name,
        suchdialog: detail.searchDialog?.name ?? null,
        gefunden: ergebnis.gesamt,
        geliefert: ergebnis.treffer.length,
        abgeschnitten: ergebnis.abgeschnitten,
        treffer: ergebnis.treffer.map((t) => ({
          id: t.id,
          titel: t.titel,
          felder: t.felder
        }))
      };
    }
  },
  {
    name: "get_document",
    title: "Dokument im Detail",
    description: "Ein einzelnes Dokument mit allen Indexfeldern und allen Anh\xE4ngen. Bei DocuWare ist ein Dokument eine Klammer um mehrere Dateien \u2014 die hei\xDFen dort 'Sections' und sind hier die Anh\xE4nge. Ein gescanntes Rechnungspaket kann so aus Rechnung, Lieferschein und Anlage bestehen, unter einer Id. Zum Herunterladen 'download_link' benutzen, zum Volltext 'document_text'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments, z. B. aus search_documents.")
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const id = String(req(args, "dokument_id"));
      const doc = await ctx.dw.json("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      return {
        aktenschrank: cab.name,
        id: doc?.Id ?? id,
        titel: doc?.Title ?? null,
        typ: doc?.ContentType ?? null,
        groesse_bytes: doc?.FileSize ?? null,
        angelegt: dwDate(doc?.CreatedAt, true),
        geaendert: dwDate(doc?.LastModified, true),
        felder: Object.fromEntries(
          (Array.isArray(doc?.Fields) ? doc.Fields : []).filter((f) => f?.FieldName).map((f) => [String(f.FieldName), fieldValue(f)])
        ),
        anhaenge: (Array.isArray(doc?.Sections) ? doc.Sections : []).map(attachmentRow)
      };
    }
  },
  {
    name: "document_text",
    title: "Volltext eines Dokuments",
    description: "Liefert den OCR-Volltext eines Dokuments \u2014 das, was DocuWare beim Einlesen erkannt hat. Damit l\xE4sst sich der Inhalt lesen, ohne die Datei herunterzuladen. Das setzt voraus, dass der Aktenschrank Volltextindizierung hat und das Dokument verarbeitet wurde; sonst sagt DocuWare, dass es keinen Text gibt. Ohne 'anhang_id' werden alle Anh\xE4nge nacheinander gelesen.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments."),
        anhang_id: str("Nur diesen Anhang lesen. Ohne Angabe alle."),
        max_zeichen: int("Text je Anhang k\xFCrzen. Default 20000.")
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const id = String(req(args, "dokument_id"));
      const grenze = Math.max(500, Math.min(2e5, Number(args.max_zeichen) || 2e4));
      const doc = await ctx.dw.json("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      let sections = Array.isArray(doc?.Sections) ? doc.Sections : [];
      if (args.anhang_id) {
        const nur = String(args.anhang_id);
        sections = sections.filter((s) => String(s?.Id ?? "") === nur);
        if (sections.length === 0) {
          throw new DocuwareError(
            `Das Dokument ${id} hat keinen Anhang '${nur}'. Vorhanden: ${(doc?.Sections ?? []).map((s) => s?.Id).join(", ") || "keiner"}.`
          );
        }
      }
      const teile = [];
      for (const section of sections) {
        const voll = await ctx.dw.json(
          "GET",
          link(section, "self", `Der Anhang ${section?.Id}`)
        );
        const textshot = links(voll)["textshot"];
        if (!textshot) {
          teile.push({
            anhang_id: section?.Id ?? null,
            dateiname: section?.OriginalFileName ?? null,
            text: null,
            hinweis: "F\xFCr diesen Anhang gibt es keinen Volltext. Entweder ist der Aktenschrank nicht volltextindiziert, oder das Dokument ist noch nicht verarbeitet."
          });
          continue;
        }
        const shot = await ctx.dw.json("GET", textshot);
        const text = textshotToText(shot);
        teile.push({
          anhang_id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? null,
          seiten: Array.isArray(shot?.Pages) ? shot.Pages.length : null,
          gekuerzt: text.length > grenze,
          text: text.slice(0, grenze)
        });
      }
      return { aktenschrank: cab.name, dokument_id: id, anhaenge: teile };
    }
  },
  {
    name: "download_link",
    title: "Dokument herunterladen",
    description: "Erzeugt einen zeitlich begrenzten Link, \xFCber den die Datei heruntergeladen werden kann. DocuWare gibt Dateien nur gegen ein Zugangstoken heraus; der Link hier \xFCbernimmt das und l\xE4uft von selbst ab. Ohne 'anhang_id' kommt das ganze Dokument, mit 'anhang_id' nur diese eine Datei. Mit Anmerkungen (Stempel, Notizen) wandelt DocuWare nach PDF \u2014 ohne sie bleibt das Original, wie es abgelegt wurde.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments."),
        anhang_id: str("Nur diesen Anhang. Ohne Angabe das ganze Dokument."),
        mit_anmerkungen: bool(
          "Stempel und Notizen mit ausliefern; wandelt nach PDF. Default true."
        ),
        gueltig_minuten: int("Wie lange der Link gilt, 1 bis 1440. Default 60.")
      },
      required: ["aktenschrank", "dokument_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const id = String(req(args, "dokument_id"));
      const doc = await ctx.dw.json("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      let quelle = doc;
      let name = String(doc?.Title || `dokument-${id}`);
      if (args.anhang_id) {
        const nur = String(args.anhang_id);
        const section = (Array.isArray(doc?.Sections) ? doc.Sections : []).find(
          (s) => String(s?.Id ?? "") === nur
        );
        if (!section) {
          throw new DocuwareError(`Das Dokument ${id} hat keinen Anhang '${nur}'.`);
        }
        quelle = await ctx.dw.json("GET", link(section, "self", `Der Anhang ${nur}`));
        name = String(section?.OriginalFileName || name);
      }
      const mitAnmerkungen = args.mit_anmerkungen !== false;
      const { token, expiresInMinutes } = await createFileLink(
        ctx.kv,
        ctx.dw.credentials,
        {
          href: link(quelle, "fileDownload", args.anhang_id ? "Der Anhang" : "Das Dokument"),
          filename: name,
          keepAnnotations: mitAnmerkungen
        },
        Number(args.gueltig_minuten) || 60
      );
      return {
        aktenschrank: cab.name,
        dokument_id: id,
        anhang_id: args.anhang_id ?? null,
        dateiname: name,
        mit_anmerkungen: mitAnmerkungen,
        link: `${ctx.origin}/f/${token}`,
        gueltig_minuten: expiresInMinutes,
        hinweis: "Der Link ist ein Geheimnis auf Zeit \u2014 wer ihn hat, bekommt die Datei, ohne sich anzumelden. Nach Ablauf ist er wertlos."
      };
    }
  }
];

// servers/docuware/src/fields.ts
var IST_DATUM = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;
function pruefeTyp(feld, value) {
  const typ = feld.type.toLowerCase();
  const s = String(value);
  if (/^(date|datetime)$/.test(typ) && !(value instanceof Date) && !IST_DATUM.test(s)) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) ist ein Datumsfeld; '${s}' ist kein Datum. Erwartet wird 'YYYY-MM-DD' oder 'YYYY-MM-DD HH:MM'.`
    );
  }
  if (/^(numeric|int|decimal|number)$/.test(typ) && !Number.isFinite(Number(value))) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) ist ein Zahlenfeld; '${s}' ist keine Zahl.`
    );
  }
  if (feld.length !== null && /^(text|memo|string)$/.test(typ) && typeof value === "string" && value.length > feld.length) {
    throw new DocuwareError(
      `${feld.id} (${feld.label}) fasst ${feld.length} Zeichen, der Wert hat ${value.length}. DocuWare w\xFCrde ihn abschneiden, statt das zu melden.`
    );
  }
}
function toTriple(feld, value) {
  const typ = feld.type.toLowerCase();
  if (value === null || value === void 0) {
    return { FieldName: feld.id, Item: null, ItemElementName: "String" };
  }
  if (Array.isArray(value)) {
    if (!/keyword/.test(typ)) {
      throw new DocuwareError(
        `${feld.id} (${feld.label}) ist kein Stichwortfeld (${feld.type}); eine Liste passt dort nicht hinein.`
      );
    }
    return {
      FieldName: feld.id,
      Item: { Keyword: value.map((v) => String(v)) },
      ItemElementName: "Keywords"
    };
  }
  pruefeTyp(feld, value);
  if (value instanceof Date) {
    return { FieldName: feld.id, Item: value.toISOString(), ItemElementName: "DateTime" };
  }
  if (/^(date|datetime)$/.test(typ)) {
    return {
      FieldName: feld.id,
      Item: String(value).replace(" ", "T"),
      ItemElementName: "DateTime"
    };
  }
  if (typeof value === "number") {
    return {
      FieldName: feld.id,
      Item: value,
      ItemElementName: Number.isInteger(value) ? "Int" : "Decimal"
    };
  }
  if (/^(numeric|int|decimal|number)$/.test(typ)) {
    const n = Number(value);
    return {
      FieldName: feld.id,
      Item: n,
      ItemElementName: Number.isInteger(n) ? "Int" : "Decimal"
    };
  }
  return { FieldName: feld.id, Item: String(value), ItemElementName: "String" };
}
function toFieldList(detail, werte) {
  const out = [];
  for (const [name, value] of Object.entries(werte ?? {})) {
    const feld = findField(detail, name);
    if (detail.storeDialog && !feld.in.includes("ablage")) {
      const moeglich = detail.fields.filter((f) => f.in.includes("ablage")).map((f) => `${f.id} (${f.label})`).join(", ");
      throw new DocuwareError(
        `${feld.id} (${feld.label}) steht nicht im Ablagedialog von '${detail.cabinet.name}' und w\xFCrde beim Ablegen stillschweigend verfallen. F\xFCllbar sind: ${moeglich || "keine"}.`
      );
    }
    out.push(toTriple(feld, value));
  }
  return out;
}

// servers/docuware/src/tools/write.ts
function fromBase64(b64, feld) {
  try {
    const bin = atob(String(b64).replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new DocuwareError(`${feld} ist kein g\xFCltiges base64.`);
  }
}
function docFields(doc) {
  return Object.fromEntries(
    (Array.isArray(doc?.Fields) ? doc.Fields : []).filter((f) => f?.FieldName).map((f) => [String(f.FieldName), fieldValue(f)])
  );
}
var writeTools = [
  {
    name: "store_document",
    title: "Dokument ablegen",
    description: "Legt ein neues Dokument in einem Aktenschrank oder Briefkorb an: zuerst der Datensatz mit den Indexfeldern, danach \u2014 optional in einem Aufwasch \u2014 die Datei dazu. Feldnamen d\xFCrfen der API-Name oder die Bezeichnung sein; welche es gibt und welche sich \xFCberhaupt f\xFCllen lassen, sagt 'index_fields'. Ein Feld, das der Ablagedialog nicht kennt, wird hier abgewiesen statt stillschweigend verworfen. Nach dem Ablegen wird zur\xFCckgelesen und gemeldet, was tats\xE4chlich im Schrank steht. Datumsangaben als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks oder Briefkorbs."),
        felder: {
          type: "object",
          description: 'Indexfeld -> Wert. Beispiel: {"DOCTYPE": "Rechnung", "BELEGNR": "4711"}. Eine Liste als Wert f\xFCllt ein Stichwortfeld.',
          additionalProperties: true
        },
        dateiname: str("Dateiname mit Endung, z. B. 'rechnung-4711.pdf'. Nur mit inhalt_base64."),
        inhalt_base64: str("Der Dateiinhalt als base64. Ohne Datei entsteht ein reiner Datensatz."),
        mime_type: str("z. B. 'application/pdf'. Default application/pdf.")
      },
      required: ["aktenschrank", "felder"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const detail = await cabinetDetail(ctx.dw, ctx.kv, cab);
      const werte = args.felder ?? {};
      if (Object.keys(werte).length === 0) {
        throw new DocuwareError(
          "Ohne Indexfelder entsteht ein Dokument, das sich nachher nicht wiederfinden l\xE4sst. Mindestens ein Feld angeben \u2014 'index_fields' zeigt, welche."
        );
      }
      if (args.inhalt_base64 && !args.dateiname) {
        throw new DocuwareError("Zu inhalt_base64 geh\xF6rt ein dateiname mit Endung.");
      }
      const angelegt = await ctx.dw.json("POST", cab.documents, {
        body: { Fields: toFieldList(detail, werte) }
      });
      const id = String(angelegt?.Id ?? "");
      if (!id) {
        throw new DocuwareError(
          "DocuWare hat auf das Ablegen geantwortet, nennt aber keine Dokument-Id.",
          angelegt
        );
      }
      let anhang = null;
      if (args.inhalt_base64) {
        const bytes = fromBase64(String(args.inhalt_base64), "inhalt_base64");
        const name = String(args.dateiname);
        const form = new FormData();
        form.append(
          "file",
          new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }),
          name
        );
        const rel = links(angelegt);
        const ziel = rel["files"] ?? rel["sections"];
        if (!ziel) {
          throw new DocuwareError(
            `Das angelegte Dokument ${id} nennt keine Beziehung, an die eine Datei geh\xE4ngt werden k\xF6nnte. Der Datensatz steht im Schrank, die Datei fehlt \u2014 'attach_file' kann sie nachreichen.`
          );
        }
        const section = await ctx.dw.json("POST", ziel, { form });
        anhang = {
          id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? name,
          typ: section?.ContentType ?? null,
          groesse_bytes: section?.FileSize ?? bytes.length
        };
      }
      const gelesen = await ctx.dw.json(
        "GET",
        `${cab.documents}/${encodeURIComponent(id)}`
      );
      const gespeichert = docFields(gelesen);
      const leerGeblieben = Object.keys(werte).map((name) => findField(detail, name).id).filter((id2) => {
        const wert = gespeichert[id2];
        return wert === null || wert === void 0 || wert === "";
      });
      return {
        angelegt: true,
        aktenschrank: cab.name,
        dokument_id: id,
        titel: gelesen?.Title ?? null,
        angelegt_am: dwDate(gelesen?.CreatedAt, true),
        felder: gespeichert,
        anhang,
        ...leerGeblieben.length > 0 ? {
          warnung: `Diese Felder sind nach dem Ablegen leer: ${leerGeblieben.join(", ")}. DocuWare hat sie verworfen, ohne das zu melden \u2014 meist, weil der Wert nicht zum Feldtyp passt oder eine Auswahlliste ihn nicht kennt ('field_values').`
        } : {},
        ...anhang === null ? {
          hinweis: "Abgelegt ist bisher nur der Datensatz, ohne Datei. Mit 'attach_file' l\xE4sst sich eine nachreichen."
        } : {}
      };
    }
  },
  {
    name: "attach_file",
    title: "Datei an ein Dokument h\xE4ngen",
    description: "H\xE4ngt eine weitere Datei an ein vorhandenes Dokument. Bei DocuWare ist ein Dokument eine Klammer um mehrere Dateien; so kommen Lieferschein und Anlage unter dieselbe Id wie die Rechnung. Die vorhandenen Dateien bleiben unangetastet \u2014 es kommt eine dazu, es wird keine ersetzt.",
    inputSchema: {
      type: "object",
      properties: {
        aktenschrank: str("Name oder Id des Aktenschranks."),
        dokument_id: str("Die Id des Dokuments, an das die Datei soll."),
        dateiname: str("Dateiname mit Endung, z. B. 'lieferschein.pdf'."),
        inhalt_base64: str("Der Dateiinhalt als base64."),
        mime_type: str("z. B. 'application/pdf' oder 'image/jpeg'. Default application/pdf.")
      },
      required: ["aktenschrank", "dokument_id", "dateiname", "inhalt_base64"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const struct = await structure(ctx.dw, ctx.kv);
      const cab = findCabinet(struct, req(args, "aktenschrank"));
      const id = String(req(args, "dokument_id"));
      const name = String(req(args, "dateiname"));
      const bytes = fromBase64(String(req(args, "inhalt_base64")), "inhalt_base64");
      const doc = await ctx.dw.json("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      const vorher = Array.isArray(doc?.Sections) ? doc.Sections.length : 0;
      const rel = links(doc);
      const ziel = rel["files"] ?? rel["sections"];
      if (!ziel) {
        throw new DocuwareError(
          `Das Dokument ${id} nennt weder 'files' noch 'sections' \u2014 dorthin gehen neue Dateien. Ohne diese Beziehung gibt DocuWare keinen Weg an, eine anzuh\xE4ngen.`
        );
      }
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }),
        name
      );
      const section = await ctx.dw.json("POST", ziel, { form });
      const danach = await ctx.dw.json("GET", `${cab.documents}/${encodeURIComponent(id)}`);
      const jetzt = Array.isArray(danach?.Sections) ? danach.Sections.length : 0;
      return {
        angehaengt: jetzt > vorher,
        aktenschrank: cab.name,
        dokument_id: id,
        anhang: {
          id: section?.Id ?? null,
          dateiname: section?.OriginalFileName ?? name,
          typ: section?.ContentType ?? null,
          groesse_bytes: section?.FileSize ?? bytes.length
        },
        anhaenge_vorher: vorher,
        anhaenge_jetzt: jetzt,
        ...jetzt > vorher ? {} : {
          warnung: "DocuWare hat den Upload angenommen, das Dokument hat aber nicht mehr Anh\xE4nge als vorher. Die Datei ist nicht angekommen."
        }
      };
    }
  }
];

// servers/docuware/src/index.ts
var tools = [...readTools, ...writeTools];
function credentialsOf(raw) {
  return {
    url: platformUrl(raw.url),
    username: String(raw.username ?? "").trim(),
    password: String(raw.password ?? "")
  };
}
var config = {
  brand: {
    name: "DocuWare MCP",
    system: "DocuWare",
    tagline: "Das Archiv f\xFCr Claude",
    accent: DOCUWARE_MARK.accent,
    logoSvg: composeLogo(DOCUWARE_MARK),
    icon: DOCUWARE_ICON,
    fields: [
      {
        name: "url",
        label: "DocuWare-URL",
        placeholder: "firma.docuware.cloud",
        // Die Adresse steht in jedem Browser-Tab; als Punktereihe hilft sie niemandem.
        secret: false
      },
      {
        name: "username",
        label: "Benutzername oder Client-ID",
        placeholder: "m.mustermann",
        secret: false
      },
      {
        name: "password",
        label: "Passwort oder Client-Secret"
      }
    ],
    credentialHelp: "Es geht beides. <b>Entweder</b> ein DocuWare-Benutzerkonto \u2014 dieselben Zugangsdaten wie im Browser. Der Zugang erbt dann genau dessen Rechte: Aktenschr\xE4nke, die dieser Benutzer nicht sehen darf, tauchen hier gar nicht erst auf. <b>Oder</b> eine App-Registrierung aus <b>DocuWare Konfiguration \u2192 Integrationen \u2192 App Registrierungen</b>; dann kommen Client-ID (eine GUID) und Client-Secret in dieselben beiden Felder. Das ist der sauberere Weg: so ein Zugang l\xE4sst sich einzeln zur\xFCckziehen, ohne dass jemand sein Passwort \xE4ndern muss. Als URL gen\xFCgt der Mandantenname \u2014 aus \u201Efirma\u201C wird firma.docuware.cloud. Vorausgesetzt ist DocuWare 7.10 oder neuer; davor gab es dort kein OAuth.",
    summary: "Model-Context-Protocol-Server f\xFCr DocuWare \u2014",
    bullets: [
      "<b>Finden</b> \u2014 Aktenschr\xE4nke, Indexfelder und Auswahllisten anzeigen, Dokumente \xFCber ihre Indexfelder suchen, einzelne Dokumente samt Anh\xE4ngen ansehen",
      "<b>Lesen</b> \u2014 den OCR-Volltext eines Dokuments direkt ins Gespr\xE4ch holen, ohne die Datei herunterzuladen; f\xFCr die Datei selbst gibt es einen Link auf Zeit",
      "<b>Ablegen</b> \u2014 neue Dokumente mit Indexfeldern anlegen und Dateien anh\xE4ngen",
      "<b>Nicht enthalten</b> \u2014 \xC4ndern und L\xF6schen. Indexfelder korrigieren und Dokumente entfernen geht in DocuWare selbst, mit Protokoll und Rechten."
    ]
  },
  serverInfo: {
    name: "docuware",
    title: "DocuWare Dokumentenmanagement",
    version: "1.0.0",
    websiteUrl: "https://docuware.com"
  },
  scopes: "docuware:read docuware:write",
  instructions: "DocuWare \u2014 das Dokumentenarchiv im Gespr\xE4ch. 10 Tools (Finden \xB7 Lesen \xB7 Ablegen), kein \xC4ndern und kein L\xF6schen. Drei Dinge vorweg: (1) Die Reihenfolge ist 'file_cabinets' \u2192 'index_fields' \u2192 'search_documents'. Feldnamen zu raten geht schief: auf dem Bildschirm hei\xDFt das Feld \u201EBelegdatum\u201C, die API kennt nur DOCDATE \u2014 'index_fields' zeigt beide, und beide sind hier erlaubt. (2) Ein Aktenschrank ist das Archiv, ein Briefkorb der Posteingang davor. Beide stehen in derselben Liste; gesucht wird in Aktenschr\xE4nken. (3) Dateien kommen nie als base64 ins Gespr\xE4ch, sondern als Link auf Zeit ('download_link'). Wer nur wissen will, was drinsteht, nimmt 'document_text' \u2014 das liefert den OCR-Text ohne Umweg \xFCber die Datei. Einstieg: \u201Ewelche Aktenschr\xE4nke gibt es?\u201C oder \u201Efinde die Rechnungen von M\xFCller aus dem ersten Quartal\u201C. Datumsangaben immer als 'YYYY-MM-DD'.",
  tools,
  async validate(raw) {
    const credentials = credentialsOf(raw);
    if (!credentials.username) throw new Error("Es fehlt der Benutzername oder die Client-ID.");
    if (!credentials.password) throw new Error("Es fehlt das Passwort oder das Client-Secret.");
    const dw = new Docuware(credentials, null);
    const struct = await structure(dw, null);
    const schraenke = struct.cabinets.filter((c) => !c.isBasket).length;
    return {
      account: `${struct.organizationName} (DocuWare ${struct.version})`,
      user: (dw.grant === "client_credentials" ? "App-Registrierung" : credentials.username) + ` \xB7 ${schraenke === 1 ? "1 Aktenschrank" : `${schraenke} Aktenschr\xE4nke`}`
    };
  },
  async context(raw, kv, origin) {
    return { dw: new Docuware(credentialsOf(raw), kv), kv, origin };
  },
  extraRoutes: serveFile
};
var index_default = createWorker(config);
export {
  index_default as default
};
