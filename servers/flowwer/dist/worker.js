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
          icons: [
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
          return new Response(config2.brand.logoSvg, {
            headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }
          });
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
var FILL = 0.56;
function composeLogo(mark, size = 512) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(mark.inner)?.[1]?.trim().split(/\s+/).map(Number);
  const [, , vw, vh] = vb && vb.length === 4 ? vb : [0, 0, 1, 1];
  const box = size * (mark.fill ?? FILL);
  const scale = Math.min(box / vw, box / vh);
  const tx = (size - vw * scale) / 2;
  const ty = (size - vh * scale) / 2;
  const body = mark.inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const radius = Math.round(size * 0.219);
  const stroke = mark.border ? `<rect x=".5" y=".5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="none" stroke="#dcdce2" stroke-width="${Math.max(1, size / 170)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${mark.bg}"/>${stroke}<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(4)})">${body}</g></svg>`;
}

// servers/flowwer/src/client.ts
var AUTH_HEADER = "X-FLOWWER-ApiKey";
var FlowwerError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "FlowwerError";
  }
};
function normalizeAccount(raw) {
  const s = String(raw ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\.flowwer\.de$/i, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(s)) {
    throw new FlowwerError(
      `'${raw}' sieht nicht wie eine FLOWWER-Kontokennung aus. Erwartet wird der Teil vor .flowwer.de, also z. B. 'musterbau' bei https://musterbau.flowwer.de.`
    );
  }
  return s;
}
var Flowwer = class {
  constructor(account, apiKey) {
    this.account = account;
    this.apiKey = apiKey;
    this.base = `https://${account}.flowwer.de`;
  }
  base;
  calls = 0;
  async request(path, opts = {}) {
    const url = new URL(path.startsWith("/") ? path : `/${path}`, this.base);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== void 0 && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const headers = {
      [AUTH_HEADER]: this.apiKey,
      Accept: opts.accept ?? "application/json"
    };
    let body;
    if (opts.form) {
      body = opts.form;
    } else if (opts.body !== void 0) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    this.calls++;
    try {
      return await fetch(url.toString(), { method: opts.method ?? "GET", headers, body });
    } catch (e) {
      throw new FlowwerError(
        `${this.base} nicht erreichbar: ${e.message}. Stimmt die Kontokennung?`
      );
    }
  }
  async json(path, opts = {}) {
    const res = await this.request(path, opts);
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
      }
      throw new FlowwerError(explain(res.status, path), detail);
    }
    if (!text) return void 0;
    try {
      return JSON.parse(text);
    } catch {
      throw new FlowwerError(`FLOWWER lieferte kein JSON f\xFCr ${path}`, text.slice(0, 300));
    }
  }
  /** Prüft Kennung und Schlüssel, indem der OData-Dienst gelesen wird. */
  async whoami() {
    const res = await this.request("/odata/reporting/");
    if (res.status === 401 || res.status === 403) {
      throw new FlowwerError(
        `FLOWWER lehnt den API-Key f\xFCr '${this.account}' ab (HTTP ${res.status}). Stimmen Kontokennung und Schl\xFCssel zusammen, und darf der API-Benutzer lesen?`
      );
    }
    if (res.status === 404) {
      throw new FlowwerError(
        `Unter https://${this.account}.flowwer.de gibt es kein OData-Reporting (404). Entweder ist die Kontokennung falsch oder das Reporting ist nicht freigeschaltet.`
      );
    }
    if (!res.ok) throw new FlowwerError(explain(res.status, "/odata/reporting/"));
    const text = await res.text();
    let sets = [];
    try {
      const doc = JSON.parse(text);
      sets = (doc.value ?? []).map((v) => v.name ?? v.url).filter(Boolean);
    } catch {
    }
    return { account: this.account, entitySets: sets };
  }
};
function explain(status, path) {
  switch (status) {
    case 401:
    case 403:
      return `FLOWWER verweigert den Zugriff auf ${path} (${status}). Der API-Benutzer hat f\xFCr diesen Aufruf keine Berechtigung \u2014 Rechte stehen in der Benutzerverwaltung.`;
    case 404:
      return `${path} gibt es bei diesem Konto nicht (404). Welche Endpunkte das Konto anbietet, zeigt das Tool 'api_erkunden'.`;
    case 400:
      return `FLOWWER lehnt die Anfrage an ${path} ab (400) \u2014 meist ein ung\xFCltiger Filter.`;
    default:
      return `FLOWWER HTTP ${status} bei ${path}.`;
  }
}

// servers/flowwer/src/odata.ts
var TTL_SECONDS = 60 * 60 * 12;
function parseMetadata(xml) {
  const entities = {};
  const typeRe = /<(?:\w+:)?EntityType\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?EntityType>/g;
  for (const m of xml.matchAll(typeRe)) {
    const [, name, inner] = m;
    const fields = {};
    const propRe = /<(?:\w+:)?Property\b[^>]*\bName="([^"]+)"[^>]*?\bType="([^"]+)"/g;
    for (const p of inner.matchAll(propRe)) fields[p[1]] = p[2];
    if (Object.keys(fields).length) entities[name] = { fields };
  }
  return entities;
}
async function getSchema(kv, flowwer, cacheSalt) {
  const key = `flw:${(await sha256hex(`${flowwer.account}:${cacheSalt}`)).slice(0, 32)}`;
  const cached = await kv.get(key, "json");
  if (cached) return cached;
  const res = await flowwer.request("/odata/reporting/$metadata", { accept: "application/xml" });
  if (!res.ok) {
    throw new FlowwerError(
      `Die Feldbeschreibung (/odata/reporting/$metadata) ist nicht lesbar (HTTP ${res.status}). Ohne sie lassen sich Filter nicht pr\xFCfen.`
    );
  }
  const xml = await res.text();
  const entities = parseMetadata(xml);
  if (!Object.keys(entities).length) {
    throw new FlowwerError(
      "Die Feldbeschreibung konnte nicht gelesen werden \u2014 sie sieht nicht wie erwartetes EDMX-XML aus. Bitte melden, dann wird der Parser angepasst.",
      xml.slice(0, 300)
    );
  }
  let entitySets = [];
  try {
    const svc = await flowwer.json("/odata/reporting/");
    entitySets = (svc?.value ?? []).map((v) => v.name ?? v.url).filter(Boolean);
  } catch {
    entitySets = Object.keys(entities);
  }
  const schema = { entities, entitySets, fetchedAt: Date.now() };
  await kv.put(key, JSON.stringify(schema), { expirationTtl: TTL_SECONDS });
  return schema;
}
function resolveEntity(schema, wanted) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(wanted);
  const setName = schema.entitySets.find((s) => norm(s) === n) ?? schema.entitySets.find((s) => norm(s) === n + "s") ?? schema.entitySets.find((s) => norm(s).startsWith(n)) ?? null;
  const typeName = Object.keys(schema.entities).find((t) => norm(t) === n) ?? Object.keys(schema.entities).find((t) => norm(t) + "s" === n) ?? (setName ? Object.keys(schema.entities).find((t) => norm(setName).startsWith(norm(t))) : null) ?? null;
  if (!setName && !typeName) {
    throw new FlowwerError(
      `'${wanted}' gibt es im Reporting dieses Kontos nicht. Verf\xFCgbar: ${(schema.entitySets.length ? schema.entitySets : Object.keys(schema.entities)).join(", ")}`
    );
  }
  return {
    set: setName ?? typeName,
    fields: typeName ? schema.entities[typeName].fields : {}
  };
}
function resolveField(fields, wanted) {
  if (!Object.keys(fields).length) return wanted;
  if (fields[wanted]) return wanted;
  const hit = Object.keys(fields).find((f) => f.toLowerCase() === wanted.toLowerCase());
  if (hit) return hit;
  const nah = Object.keys(fields).filter(
    (f) => f.toLowerCase().includes(wanted.toLowerCase().slice(0, 4))
  );
  const alle = Object.keys(fields);
  const auswahl = alle.length > 20 ? `${alle.slice(0, 20).join(", ")} \u2026 (${alle.length} insgesamt)` : alle.join(", ");
  throw new FlowwerError(
    `Feld '${wanted}' gibt es nicht.` + (nah.length ? ` Gemeint: ${nah.slice(0, 6).join(", ")}?` : "") + ` Vorhanden: ${auswahl}`
  );
}
function literal(type, value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  const t = (type ?? "").replace("Edm.", "");
  if (["Int16", "Int32", "Int64", "Decimal", "Double", "Single", "Byte"].includes(t)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new FlowwerError(`'${value}' ist keine Zahl.`);
    return String(n);
  }
  if (t === "Boolean") return String(value).toLowerCase() === "true" ? "true" : "false";
  if (t === "Guid") return `${String(value)}`;
  if (["Date", "DateTimeOffset"].includes(t)) {
    const s = String(value);
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
      throw new FlowwerError(`'${s}' ist kein Datum. Erwartet wird 'YYYY-MM-DD'.`);
    }
    return t === "Date" ? s.slice(0, 10) : `${s.slice(0, 10)}T00:00:00Z`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
function condition(fields, field, op, value) {
  const name = resolveField(fields, field);
  const lit = literal(fields[name], value);
  if (op === "contains" || op === "startswith") {
    return `${op}(${name},${literal("Edm.String", String(value))})`;
  }
  return `${name} ${op} ${lit}`;
}

// shared/src/types.ts
var str = (description) => ({ type: "string", description });
var int = (description) => ({ type: "integer", description });
function req(args, name) {
  const v = args[name];
  if (v === void 0 || v === null || v === "") {
    throw new Error(`Pflichtargument '${name}' fehlt.`);
  }
  return v;
}

// servers/flowwer/src/tools.ts
var MAX_ROWS = 500;
var clamp = (n, def) => Math.min(MAX_ROWS, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : def));
var DOCS = "Documents";
var SPLITS = "DocumentsWithReceiptSplits";
var FILTER_SCHEMA = {
  type: "array",
  description: "Zus\xE4tzliche Bedingungen. Feldnamen kommen aus felder_auflisten; ein unbekanntes Feld wird abgelehnt, statt einen unverst\xE4ndlichen 400er zu erzeugen.",
  items: {
    type: "object",
    properties: {
      feld: { type: "string", description: "Feldname aus felder_auflisten." },
      operator: {
        type: "string",
        description: "eq, ne, gt, ge, lt, le, contains oder startswith. Default eq."
      },
      wert: { type: "string", description: "Vergleichswert." }
    },
    required: ["feld", "wert"],
    additionalProperties: false
  }
};
var OPS = ["eq", "ne", "gt", "ge", "lt", "le", "contains", "startswith"];
function buildFilter(fields, args, extra = []) {
  const parts = [];
  for (const [feld, op, wert] of extra) parts.push(condition(fields, feld, op, wert));
  for (const f of args.filter ?? []) {
    if (!f?.feld || f.wert === void 0) {
      throw new FlowwerError("Jede Bedingung braucht 'feld' und 'wert'.");
    }
    const op = f.operator ?? "eq";
    if (!OPS.includes(op)) {
      throw new FlowwerError(`Operator '${op}' gibt es nicht. Erlaubt: ${OPS.join(", ")}`);
    }
    parts.push(condition(fields, f.feld, op, f.wert));
  }
  return parts.length ? parts.join(" and ") : void 0;
}
async function query(ctx, set, params) {
  const data = await ctx.flw.json(`/odata/reporting/${set}`, {
    query: {
      $filter: params.filter,
      $select: params.select,
      $orderby: params.orderby,
      $top: params.top,
      $count: "true"
    }
  });
  const rows = data?.value ?? (Array.isArray(data) ? data : []);
  const gesamt = data?.["@odata.count"] ?? null;
  return {
    zeilen: rows,
    anzahl: rows.length,
    gesamt_treffer: gesamt,
    abgeschnitten: rows.length >= params.top,
    abfrage: { collection: set, ...params }
  };
}
var tools = [
  {
    name: "felder_auflisten",
    title: "Verf\xFCgbare Felder",
    description: "Zeigt, welche Collections und Felder das Reporting DIESES Kontos hat, samt Typ. FLOWWER dokumentiert das nicht \xF6ffentlich \u2014 die Liste kommt aus dem $metadata des Kontos. Erster Aufruf, bevor gefiltert oder ausgewertet wird.",
    inputSchema: {
      type: "object",
      properties: {
        collection: str("Nur diese Collection zeigen, z. B. 'Documents'. Leer = alle.")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      if (args.collection) {
        const e = resolveEntity(schema, String(args.collection));
        return { collection: e.set, anzahl_felder: Object.keys(e.fields).length, felder: e.fields };
      }
      return {
        collections: schema.entitySets,
        entitaeten: Object.fromEntries(
          Object.entries(schema.entities).map(([name, e]) => [name, e.fields])
        )
      };
    }
  },
  {
    name: "dokumente_suchen",
    title: "Dokumente suchen",
    description: "Sucht Rechnungen und Belege im Reporting. Die bequemen Argumente (lieferant, stufe, datum_von/bis) werden auf die Felder dieses Kontos abgebildet; alles Weitere geht \xFCber 'filter'. Ohne Einschr\xE4nkung kommen die neuesten Dokumente.",
    inputSchema: {
      type: "object",
      properties: {
        lieferant: str("Lieferantenname, Teiltreffer gen\xFCgt (Feld supplierName)."),
        rechnungsnummer: str("Rechnungsnummer (Feld invoiceNumber)."),
        stufe: str("Aktuelle Workflow-Stufe (Feld currentStage) \u2014 exakter Wert."),
        zahlungsstatus: str("Zahlungsstatus (Feld paymentState) \u2014 exakter Wert."),
        datum_von: str("Rechnungsdatum ab 'YYYY-MM-DD' (Feld invoiceDate)."),
        datum_bis: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        filter: FILTER_SCHEMA,
        felder: str("Komma-Liste der zur\xFCckzugebenden Felder. Leer = alle."),
        sortierung: str("z. B. 'invoiceDate desc'. Default: neueste zuerst."),
        limit: int("Maximale Zeilenzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      const e = resolveEntity(schema, DOCS);
      const extra = [];
      if (args.lieferant) extra.push(["supplierName", "contains", String(args.lieferant)]);
      if (args.rechnungsnummer) extra.push(["invoiceNumber", "eq", String(args.rechnungsnummer)]);
      if (args.stufe) extra.push(["currentStage", "eq", String(args.stufe)]);
      if (args.zahlungsstatus) extra.push(["paymentState", "eq", String(args.zahlungsstatus)]);
      if (args.datum_von) extra.push(["invoiceDate", "ge", String(args.datum_von)]);
      if (args.datum_bis) extra.push(["invoiceDate", "le", String(args.datum_bis)]);
      const select = args.felder ? String(args.felder).split(",").map((f) => resolveField(e.fields, f.trim())).join(",") : void 0;
      let orderby = args.sortierung ? String(args.sortierung) : void 0;
      if (orderby) {
        const [f, dir] = orderby.split(/\s+/);
        orderby = `${resolveField(e.fields, f)}${dir ? ` ${dir.toLowerCase() === "desc" ? "desc" : "asc"}` : ""}`;
      } else if (e.fields.invoiceDate) {
        orderby = "invoiceDate desc";
      }
      return query(ctx, e.set, {
        filter: buildFilter(e.fields, args, extra),
        select,
        orderby,
        top: clamp(args.limit, 50)
      });
    }
  },
  {
    name: "auswertung",
    title: "Summen und Gruppierung",
    description: "Z\xE4hlt und summiert \xFCber die Dokumente \u2014 z. B. Rechnungssummen je Lieferant oder je Workflow-Stufe. Die Gruppierung rechnet dieser Server aus den geholten Zeilen; wenn daf\xFCr nicht alle Zeilen gereicht haben, steht das im Ergebnis.",
    inputSchema: {
      type: "object",
      properties: {
        gruppiere_nach: str("Feld, nach dem gruppiert wird, z. B. 'supplierName' oder 'currentStage'."),
        summiere: str("Zahlenfeld, das summiert wird, z. B. 'amountGross'. Leer = nur z\xE4hlen."),
        collection: str(`'${DOCS}' (Default) oder '${SPLITS}' f\xFCr Belegaufteilungen.`),
        datum_von: str("Rechnungsdatum ab 'YYYY-MM-DD'."),
        datum_bis: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        filter: FILTER_SCHEMA,
        limit: int("Maximal zu ladende Zeilen (1\u2013500, Default 500).")
      },
      required: ["gruppiere_nach"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const schema = await getSchema(ctx.kv, ctx.flw, ctx.cacheSalt);
      const e = resolveEntity(schema, String(args.collection ?? DOCS));
      const gruppe = resolveField(e.fields, req(args, "gruppiere_nach"));
      const summe = args.summiere ? resolveField(e.fields, String(args.summiere)) : null;
      const extra = [];
      if (args.datum_von) extra.push(["invoiceDate", "ge", String(args.datum_von)]);
      if (args.datum_bis) extra.push(["invoiceDate", "le", String(args.datum_bis)]);
      const res = await query(ctx, e.set, {
        filter: buildFilter(e.fields, args, extra),
        select: [gruppe, summe].filter(Boolean).join(","),
        top: clamp(args.limit, MAX_ROWS)
      });
      const gruppen = {};
      for (const z of res.zeilen) {
        const k = String(z[gruppe] ?? "(ohne Angabe)");
        const g = gruppen[k] ??= { anzahl: 0, summe: 0 };
        g.anzahl++;
        if (summe) g.summe = Math.round((g.summe + (Number(z[summe]) || 0)) * 100) / 100;
      }
      const sortiert = Object.entries(gruppen).sort((a, b) => summe ? b[1].summe - a[1].summe : b[1].anzahl - a[1].anzahl).map(([wert, g]) => ({ wert, anzahl: g.anzahl, ...summe ? { summe: g.summe } : {} }));
      return {
        gruppiert_nach: gruppe,
        summiert: summe,
        zeilen_geladen: res.anzahl,
        gesamt_treffer: res.gesamt_treffer,
        abgeschnitten: res.abgeschnitten,
        ...res.abgeschnitten ? {
          warnung: "Es gab mehr Zeilen als geladen wurden \u2014 die Summen sind unvollst\xE4ndig. Zeitraum eingrenzen oder limit erh\xF6hen."
        } : {},
        gruppen: sortiert
      };
    }
  },
  {
    name: "belegaufteilungen_lesen",
    title: "Belegaufteilungen",
    description: "Die Kontierung eines Dokuments: Konto, Kostenstelle, Kostentr\xE4ger, Netto, Steuer, Brutto je Aufteilungszeile. Erg\xE4nzt wird sie um die Kopfdaten des Dokuments.",
    inputSchema: {
      type: "object",
      properties: { document_id: str("Die documentId aus dokumente_suchen.") },
      required: ["document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "document_id");
      return ctx.flw.json(`/api/v1/documents/${encodeURIComponent(id)}/receiptsplits`);
    }
  },
  {
    name: "api_erkunden",
    title: "Was kann dieses Konto?",
    description: "Liest die OpenAPI-Beschreibung des Kontos und listet, welche Endpunkte es wirklich anbietet. FLOWWER dokumentiert \xF6ffentlich nur einen Teil \u2014 Find-API und Archiv-Import/-Export gibt es je nach Konto und Freischaltung. Dieses Tool sagt, was da ist, statt Pfade zu raten.",
    inputSchema: {
      type: "object",
      properties: { suche: str("Nur Endpunkte, die diesen Text enthalten.") },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const kandidaten = [
        "/swagger/v1/swagger.json",
        "/swagger/v1.0/swagger.json",
        "/swagger.json",
        "/api/swagger.json",
        "/openapi.json"
      ];
      const versucht = [];
      for (const pfad of kandidaten) {
        versucht.push(pfad);
        const res = await ctx.flw.request(pfad);
        if (!res.ok) continue;
        let spec;
        try {
          spec = JSON.parse(await res.text());
        } catch {
          continue;
        }
        if (!spec?.paths) continue;
        const suche = args.suche ? String(args.suche).toLowerCase() : null;
        const ops = [];
        for (const [pf, methoden] of Object.entries(spec.paths)) {
          for (const [m, op] of Object.entries(methoden)) {
            if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
            const zeile = { methode: m.toUpperCase(), pfad: pf, zweck: op?.summary ?? void 0 };
            const hay = `${pf} ${op?.summary ?? ""} ${op?.operationId ?? ""}`.toLowerCase();
            if (!suche || hay.includes(suche)) ops.push(zeile);
          }
        }
        ops.sort((a, b) => a.pfad.localeCompare(b.pfad) || a.methode.localeCompare(b.methode));
        return {
          quelle: pfad,
          titel: spec.info?.title ?? null,
          version: spec.info?.version ?? null,
          anzahl: ops.length,
          endpunkte: ops,
          hinweis: "Dieser Server bedient davon nur die dokumentierten Endpunkte. Wird hier etwas gebraucht, das noch kein Tool hat, l\xE4sst es sich erg\xE4nzen."
        };
      }
      throw new FlowwerError(
        `Unter https://${ctx.flw.account}.flowwer.de wurde keine OpenAPI-Beschreibung gefunden. Versucht: ${versucht.join(", ")}. Die Swagger-Oberfl\xE4che liegt laut FLOWWER unter /swagger \u2014 dort steht, unter welchem Pfad die Beschreibung ausgeliefert wird.`
      );
    }
  },
  {
    name: "dokument_hochladen",
    title: "Dokument hochladen",
    description: "L\xE4dt eine Rechnung oder einen Beleg nach FLOWWER hoch; dort startet damit der Freigabe-Workflow. Inhalt als url (wird geladen) oder als content_base64. Anlegen ja \u2014 \xE4ndern oder l\xF6schen kann dieser Server nichts.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung, z. B. 'rechnung.pdf'."),
        url: str("\xD6ffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url.")
      },
      required: ["filename"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const filename = req(args, "filename");
      const hasUrl = Boolean(args.url);
      const hasB64 = Boolean(args.content_base64);
      if (hasUrl === hasB64) throw new FlowwerError("Genau eins angeben: url ODER content_base64.");
      let bytes;
      if (hasUrl) {
        const res2 = await fetch(String(args.url));
        if (!res2.ok) throw new FlowwerError(`Datei nicht ladbar: HTTP ${res2.status} von ${args.url}`);
        bytes = new Uint8Array(await res2.arrayBuffer());
      } else {
        const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
        let bin;
        try {
          bin = atob(raw);
        } catch {
          throw new FlowwerError("content_base64 ist kein g\xFCltiges Base64.");
        }
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (bytes.byteLength > 2e7) throw new FlowwerError("Datei gr\xF6\xDFer als 20 MB.");
      const form = new FormData();
      form.set("file", new Blob([bytes]), filename);
      const res = await ctx.flw.request("/api/v1/upload", { method: "POST", form });
      const text = await res.text();
      if (!res.ok) {
        throw new FlowwerError(`Upload abgelehnt (HTTP ${res.status}).`, text.slice(0, 500));
      }
      let antwort = text;
      try {
        antwort = JSON.parse(text);
      } catch {
      }
      return { filename, bytes: bytes.byteLength, antwort };
    }
  }
];

// servers/flowwer/src/index.ts
var FLOWWER_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#ffffff" d="M16 6h20l12 12v40a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z" opacity=".28"/><path fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M21 34.5 29 42.5 44 24"/></svg>',
  bg: "#0E5FD8",
  accent: "#0E5FD8",
  fill: 0.6
};
var config = {
  brand: {
    name: "FLOWWER MCP",
    system: "FLOWWER",
    tagline: "Rechnungsfreigabe f\xFCr Claude",
    accent: FLOWWER_MARK.accent,
    logoSvg: composeLogo(FLOWWER_MARK),
    fields: [
      {
        name: "account",
        label: "Kontokennung",
        placeholder: "z. B. musterbau (der Teil vor .flowwer.de)",
        secret: false
      },
      {
        name: "apiKey",
        label: "API-Key",
        placeholder: "Schl\xFCssel des API-Benutzers"
      }
    ],
    credentialHelp: "Beides steht in FLOWWER: die Kontokennung in der Adresszeile (<code>https://<b>kennung</b>.flowwer.de</code>), den Schl\xFCssel legst du unter <b>Benutzerverwaltung \u2192 API-Benutzer</b> an. Ein API-Benutzer kann sich nicht an der Oberfl\xE4che anmelden und bekommt nur die Rechte, die du ihm gibst \u2014 gib ihm nur Leserechte, dann kann \xFCber diesen Server auch nichts anderes passieren.",
    summary: "Model-Context-Protocol-Server f\xFCr FLOWWER \u2014",
    bullets: [
      "<b>Lesen</b> \u2014 Dokumente suchen, Belegaufteilungen, Auswertungen nach Lieferant, Stufe oder Kostenstelle, Feld- und Endpunkt\xFCbersicht des eigenen Kontos",
      "<b>Schreiben</b> \u2014 Dokumente hochladen, damit der Freigabe-Workflow startet",
      "<b>Nicht enthalten</b> \u2014 \xC4ndern und L\xF6schen. Auch das Ersetzen von Belegaufteilungen bleibt drau\xDFen, obwohl die API es k\xF6nnte."
    ]
  },
  serverInfo: {
    name: "flowwer",
    title: "FLOWWER Rechnungsfreigabe",
    version: "1.0.0",
    websiteUrl: "https://www.flowwer.de"
  },
  scopes: "flowwer:read flowwer:write",
  instructions: `FLOWWER \u2014 Rechnungsfreigabe und Belegworkflow im Gespr\xE4ch. 6 Tools (Lesen \xB7 Upload), kein \xC4ndern und kein L\xF6schen. Drei Dinge vorweg: (1) Jedes Konto hat eigene Felder; vor dem ersten Filtern 'felder_auflisten' aufrufen statt Feldnamen zu raten. (2) Die Werte von currentStage und paymentState sind mandantenspezifisch \u2014 sie ergeben sich aus den Daten, nicht aus einer festen Liste. (3) FLOWWER dokumentiert \xF6ffentlich nur einen Teil seiner API; was das konkrete Konto sonst noch anbietet, zeigt 'api_erkunden'. Einstieg: \u201Ewelche Rechnungen liegen gerade wo?" (auswertung mit gruppiere_nach=currentStage). Datumsangaben immer als 'YYYY-MM-DD'.`,
  tools,
  async validate({ account, apiKey }) {
    const konto = normalizeAccount(account);
    const who = await new Flowwer(konto, apiKey).whoami();
    return {
      account: konto,
      user: who.entitySets.length ? `${who.entitySets.length} Collections lesbar` : "API-Benutzer"
    };
  },
  async context({ account, apiKey }, kv) {
    const konto = normalizeAccount(account);
    return { flw: new Flowwer(konto, apiKey), kv, cacheSalt: apiKey };
  }
};
var index_default = createWorker(config);
export {
  index_default as default
};
