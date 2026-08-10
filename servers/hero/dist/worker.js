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
var HERO_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70.95 64"><path fill="#1a1a1a" d="M66.38,0h-21.58l-1.46,20.75h-13.9L30.9,0h-11.43L0,36.57l4.57,27.43h21.58l1.65-22.22h13.9l-1.65,22.22h11.43l19.47-36.57L66.38,0Z"/></svg>',
  bg: "#FFC400",
  accent: "#FFC400"
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

// servers/hero/src/input-fields.generated.ts
var INPUT_FIELDS = {
  "AddressInput": {
    "id": null,
    "street": null,
    "city": null,
    "zipcode": null,
    "country_id": null,
    "full_address": null,
    "basic_address": null,
    "maps_link": null,
    "latitude": null,
    "longitude": null,
    "created": null,
    "modified": null,
    "line_1": null,
    "line_2": null,
    "state_id": null
  },
  "CalendarEventInput": {
    "category_id": null,
    "project_match_id": null,
    "title": null,
    "description": null,
    "start": null,
    "end": null,
    "all_day": null,
    "deleted": null,
    "color": null,
    "is_done": null,
    "is_recurring": null,
    "provider": null,
    "id": null,
    "modified": null,
    "created": null,
    "partner_ids": null,
    "resource_ids": null,
    "partner_id": null,
    "type": null,
    "localized_type": null
  },
  "CustomerDocumentInput": {
    "nr": null,
    "status_code": null,
    "type": null,
    "document_type_id": null,
    "project_match_id": null,
    "company_id": null,
    "contact_id": null,
    "partner_id": null,
    "customer_invoice_id": null,
    "file_upload_id": null,
    "file_upload_folder_id": null,
    "date": null,
    "value": null,
    "vat": null,
    "currency": null,
    "published_customer_document_draft_id": null,
    "selected_document_id": null,
    "source": null,
    "source_id": null,
    "created": null,
    "modified": null,
    "status_name": null,
    "metadata": null,
    "localized_type": null,
    "booking_relevant": null,
    "link_view": null,
    "is_gaeb": null,
    "id": null,
    "show_vat": null,
    "use_next_number": null
  },
  "CustomerInput": {
    "user_id": null,
    "type": null,
    "title": null,
    "title_custom": null,
    "first_name": null,
    "last_name": null,
    "company_name": null,
    "company_legal_form": null,
    "phone_home": null,
    "phone_mobile": null,
    "phone_fax": null,
    "url": null,
    "address_id": null,
    "reachability": null,
    "source": null,
    "position": null,
    "category": null,
    "company_id": null,
    "created": null,
    "modified": null,
    "nr": null,
    "parent_customer_id": null,
    "email": null,
    "offer_options": null,
    "is_deleted": null,
    "full_name": null,
    "phone_home_formatted": null,
    "phone_mobile_formatted": null,
    "is_invoice_recipient": null,
    "reachability_string": null,
    "initial_name": null,
    "category_name": null,
    "contact_match_id": null,
    "is_contact_person": null,
    "id": null,
    "address": "AddressInput",
    "partner_notes": null,
    "birth_date": null
  },
  "Documents_AddExistingServiceActionInput": {
    "supplyServiceId": null,
    "quantity": null,
    "source": null,
    "insertAfter": null
  },
  "Documents_AddExistingWageGroupActionInput": {
    "serviceUid": null,
    "wageGroupId": null,
    "timeMinutes": null,
    "activity": null
  },
  "Documents_AddPositionsFromDocumentActionInput": {
    "documentId": null,
    "selectedPositions": null,
    "titlePerDocument": null,
    "flowType": null,
    "fixedItemNumbers": null
  },
  "Documents_AddProductPositionActionInput": {
    "name": null,
    "description": null,
    "nr": null,
    "unit_type": null,
    "image_url": null,
    "quantity": null,
    "list_price": null,
    "base_price": null,
    "net_price": null,
    "vat_percent": null
  },
  "Documents_AddProductPositionByIdActionInput": {
    "product_id": null,
    "quantity": null
  },
  "Documents_AddTextActionInput": {
    "text": null,
    "pagebreak": null
  },
  "Documents_AddTitleActionInput": {
    "text": null,
    "tier": null,
    "pagebreak": null,
    "insertAfter": null
  },
  "Documents_ClearDocumentDiscountActionInput": {
    "_": null
  },
  "Documents_ClearPositionsActionInput": {
    "_": null
  },
  "Documents_CopySalesMetadataActionInput": {
    "documentId": null
  },
  "Documents_CreateDocumentInput": {
    "document_type_id": null,
    "project_match_id": null,
    "filename": null,
    "publish": null
  },
  "Documents_CreateSupplyServiceActionInput": {
    "name": null,
    "unit_type": null,
    "net_price_per_unit": null,
    "vat_percent": null,
    "quantity": null,
    "description": null,
    "nr": null,
    "ean": null,
    "manufacturer": null,
    "manufacturer_nr": null,
    "source": null,
    "insert_after": null,
    "is_fixed_net_price": null,
    "productPositions": "Documents_UpdateSupplyServiceProductPositionsInput",
    "wagePositions": "Documents_UpdateSupplyServiceWagePositionInput"
  },
  "Documents_DeleteSupplyProductActionInput": {
    "uid": null
  },
  "Documents_DeleteSupplyServiceActionInput": {
    "uid": null
  },
  "Documents_DocumentBuilderActionInput": {
    "set_recipient": "Documents_SetRecipientActionInput",
    "add_product_position": "Documents_AddProductPositionActionInput",
    "add_product_position_by_id": "Documents_AddProductPositionByIdActionInput",
    "add_text": "Documents_AddTextActionInput",
    "set_options": "Documents_SetOptionsActionInput",
    "add_title": "Documents_AddTitleActionInput",
    "add_existing_service": "Documents_AddExistingServiceActionInput",
    "update_supply_service": "Documents_UpdateSupplyServiceActionInput",
    "delete_supply_service": "Documents_DeleteSupplyServiceActionInput",
    "delete_supply_product": "Documents_DeleteSupplyProductActionInput",
    "add_existing_wage_group": "Documents_AddExistingWageGroupActionInput",
    "update_supply_product": "Documents_UpdateSupplyProductActionInput",
    "create_supply_service": "Documents_CreateSupplyServiceActionInput",
    "add_positions_from_document": "Documents_AddPositionsFromDocumentActionInput",
    "set_reference_documents": "Documents_SetReferenceDocumentsActionInput",
    "clear_positions": "Documents_ClearPositionsActionInput",
    "copy_sales_metadata": "Documents_CopySalesMetadataActionInput",
    "set_document_discount": "Documents_SetDocumentDiscountActionInput",
    "clear_document_discount": "Documents_ClearDocumentDiscountActionInput"
  },
  "Documents_SetDocumentDiscountActionInput": {
    "valueType": null,
    "value": null,
    "label": null
  },
  "Documents_SetOptionsActionInput": {
    "projectAddressDisplay": null,
    "subjectDisplay": null,
    "customBoxText": null
  },
  "Documents_SetRecipientActionInput": {
    "company_name": null,
    "company_legal_form": null,
    "title": null,
    "title_custom": null,
    "first_name": null,
    "last_name": null,
    "street": null,
    "city": null,
    "zipcode": null,
    "country": null,
    "address_line_1": null,
    "address_line_2": null
  },
  "Documents_SetReferenceDocumentsActionInput": {
    "referenceDocumentIds": null,
    "referenceDocuments": null
  },
  "Documents_SupplyProductBaseDataInput": {
    "id": null,
    "product_id": null,
    "company_id": null,
    "file_upload_id": null,
    "supply_catalog_id": null,
    "supplier_id": null,
    "name": null,
    "ean": null,
    "matchcode": null,
    "description": null,
    "manufacturer": null,
    "manufacturer_nr": null,
    "manufacturer_type_name": null,
    "quantity_min": null,
    "quantity_interval": null,
    "price_quantity": null,
    "delivery_time": null,
    "unit_type": null,
    "is_deleted": null,
    "category": null,
    "external_url": null,
    "image_src": null,
    "modified": null,
    "created": null,
    "file_upload_uuid": null
  },
  "Documents_SupplyProductSalesPriceInput": {
    "id": null,
    "supply_sales_price_id": null,
    "net_price_per_unit": null,
    "label": null,
    "hasDifferentPrice": null,
    "modified": null,
    "created": null
  },
  "Documents_SupplyProductVersionInput": {
    "id": null,
    "product_id": null,
    "company_id": null,
    "supply_operator_id": null,
    "internal_identifier": null,
    "nr": null,
    "base_price": null,
    "list_price": null,
    "vat_percent": null,
    "is_deleted": null,
    "default_sales_price_id": null,
    "price_quantity": null,
    "quantity_min": null,
    "quantity_interval": null,
    "delivery_time": null,
    "modified": null,
    "created": null,
    "base_data": "Documents_SupplyProductBaseDataInput",
    "default_sales_price": null,
    "attributes": null,
    "sales_prices": "Documents_SupplyProductSalesPriceInput"
  },
  "Documents_UpdateSupplyProductActionInput": {
    "uid": null,
    "name": null,
    "description": null,
    "nr": null,
    "unit_type": null,
    "ean": null,
    "manufacturer": null,
    "manufacturer_nr": null,
    "net_price_per_unit": null,
    "vat_percent": null,
    "quantity": null
  },
  "Documents_UpdateSupplyServiceActionInput": {
    "uid": null,
    "name": null,
    "description": null,
    "nr": null,
    "unitType": null,
    "vatPercent": null,
    "quantity": null,
    "productPositions": "Documents_UpdateSupplyServiceProductPositionsInput",
    "wagePositions": "Documents_UpdateSupplyServiceWagePositionInput"
  },
  "Documents_UpdateSupplyServiceProductPositionsInput": {
    "id": null,
    "name": null,
    "description": null,
    "nr": null,
    "unitType": null,
    "netPricePerUnit": null,
    "vatPercent": null,
    "quantity": null
  },
  "Documents_UpdateSupplyServiceWagePositionInput": {
    "id": null,
    "name": null,
    "activity": null,
    "unitType": null,
    "wagePerHour": null,
    "vatPercent": null,
    "timeMinutes": null
  },
  "Employees_TrackingTimeInput": {
    "uuid": null,
    "project_match_id": null,
    "company_id": null,
    "tracking_region_id": null,
    "partner_id": null,
    "tracking_times_category_id": null,
    "tracking_workday_id": null,
    "status_code": null,
    "start": null,
    "end": null,
    "comment": null,
    "created": null,
    "modified": null,
    "field_service_job_id": null,
    "duration_in_seconds": null,
    "is_autogenerated": null,
    "id": null,
    "category": null,
    "category_name": null
  },
  "FieldService_ChecklistInput": {
    "company_id": null,
    "field_service_job_id": null,
    "project_match_id": null,
    "author_partner_id": null,
    "partner_id": null,
    "status": null,
    "name": null,
    "data": null,
    "created": null,
    "id": null,
    "modified": null
  },
  "FieldService_JobInput": {
    "company_id": null,
    "customer_id": null,
    "contact_id": null,
    "project_match_id": null,
    "address_id": null,
    "type": null,
    "status_code": null,
    "start": null,
    "end": null,
    "title": null,
    "description": null,
    "created": null,
    "localized_type": null,
    "status_name": null,
    "display_nr": null,
    "id": null,
    "modified": null,
    "address": "AddressInput",
    "partners": null,
    "service_object_id": null
  },
  "LogbookEntryInput": {
    "target": null,
    "target_id": null,
    "target_project_match_id": null,
    "custom_text": null,
    "type_code": null,
    "target_users": null,
    "role_visibility": null
  },
  "PaymentInput": {
    "paid_date": null,
    "value": null,
    "invoice_discount_value": null,
    "created": null,
    "id": null,
    "modified": null
  },
  "ProjectInput": {
    "type": null,
    "customer_id": null,
    "address_id": null,
    "current_project_status_id": null,
    "created": null,
    "modified": null,
    "display_name": null,
    "name": null,
    "partner_source": null,
    "measure_id": null,
    "measure_short": null,
    "id": null,
    "customer": "CustomerInput",
    "address": "AddressInput"
  },
  "ProjectMatchInput": {
    "project_type": null,
    "measure_id": null,
    "customer_id": null,
    "address_id": null,
    "company_id": null,
    "company_branch_id": null,
    "partner_id": null,
    "current_project_match_status_id": null,
    "marked_company": null,
    "marked_later": null,
    "created": null,
    "modified": null,
    "contact_id": null,
    "name": null,
    "partner_source": null,
    "relative_id": null,
    "partner_notes": null,
    "display_id": null,
    "project_nr": null,
    "volume": null,
    "project_title": null,
    "is_deleted": null,
    "project_id": null,
    "id": null,
    "current_project_match_status": "ProjectMatchStatusInput",
    "project": "ProjectInput",
    "contact": "CustomerInput",
    "type_id": null,
    "step_id": null,
    "ppl_price": null
  },
  "ProjectMatchStatusInput": {
    "status_code": null,
    "maturity_date": null,
    "maturity_time": null,
    "previous_project_match_status_id": null,
    "show_as_skipped": null,
    "created": null,
    "modified": null,
    "name": null,
    "short_name": null,
    "step_id": null,
    "id": null
  },
  "TaskInput": {
    "author_user_id": null,
    "company_id": null,
    "target_user_id": null,
    "title": null,
    "comment": null,
    "target_project_match_id": null,
    "due_date": null,
    "done_date": null,
    "created": null,
    "modified": null,
    "start": null,
    "end": null,
    "is_deleted": null,
    "id": null
  }
};

// servers/hero/src/hero.ts
var HERO_BASE = "https://login.hero-software.de";
var HERO_GQL = `${HERO_BASE}/api/external/v9/graphql`;
var HERO_LEAD = `${HERO_BASE}/api/v1/Projects/create`;
var COMPLEXITY_LIMIT = 5e4;
var HeroError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "HeroError";
  }
};
var Hero = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  /** Summe der bisher in diesem Request verbrauchten Komplexität. */
  spent = 0;
  headers(extra = {}) {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json", ...extra };
  }
  /**
   * Ein GraphQL-Request. `variables` ist Pflicht-Vehikel für alles Nicht-Skalare —
   * niemals Werte in den Query-String interpolieren.
   */
  async gql(query, variables = {}) {
    checkVariables(query, variables);
    let res;
    try {
      res = await fetch(HERO_GQL, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ query, variables })
      });
    } catch (e) {
      throw new HeroError(`HERO nicht erreichbar: ${e.message}`);
    }
    const complexity = Number(res.headers.get("X-Complexity") ?? 0);
    this.spent += complexity;
    const text = await res.text();
    if (!res.ok) {
      throw new HeroError(`HERO HTTP ${res.status}`, text.slice(0, 800));
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new HeroError("HERO lieferte kein JSON", text.slice(0, 300));
    }
    if (body.errors?.length) {
      throw new HeroError(body.errors[0].message, body.errors);
    }
    if (complexity > COMPLEXITY_LIMIT) {
      throw new HeroError(
        `Query zu teuer: X-Complexity ${complexity} \xFCber dem Limit ${COMPLEXITY_LIMIT}. Kleineres 'limit' w\xE4hlen.`
      );
    }
    return body.data;
  }
  /** Prüft den Key gegen HERO und liefert Firmenname + angemeldeten Nutzer zurück. */
  async whoami() {
    const d = await this.gql(`query { company { id name } user { id email partner { full_name } } }`);
    if (!d.company) throw new HeroError("Key g\xFCltig, aber keine Firma lesbar");
    const u = d.user;
    return {
      company: d.company.name,
      companyId: d.company.id ?? null,
      user: u?.partner?.full_name || u?.email || "unbekannt"
    };
  }
  /**
   * Lead API. Der einzige Weg, eine file_upload_uuid zu erzeugen (multipart).
   * ⚠ Jeder Aufruf legt ein Projekt an — Kunden werden dedupliziert, Projekte NICHT.
   */
  async lead(body) {
    const res = await fetch(HERO_LEAD, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HeroError(`Lead API HTTP ${res.status}`, text.slice(0, 300));
    }
  }
  /** Lead API als multipart — für Datei-Uploads. */
  async leadMultipart(form) {
    const res = await fetch(HERO_LEAD, { method: "POST", headers: this.headers(), body: form });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HeroError(`Lead API HTTP ${res.status}`, text.slice(0, 300));
    }
  }
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function checkVariables(query, variables) {
  for (const m of query.matchAll(/\$(\w+)\s*:\s*\[?(\w+)/g)) {
    const [, varName, typeName] = m;
    const value = variables[varName];
    if (value === void 0 || value === null) continue;
    checkValue(typeName, value, `$${varName}`);
  }
}
function checkValue(typeName, value, path) {
  const fields = INPUT_FIELDS[typeName];
  if (!fields) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkValue(typeName, v, `${path}[${i}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, inner] of Object.entries(value)) {
    if (!(key in fields)) {
      const near = Object.keys(fields).filter(
        (f) => f.replace(/_/g, "").includes(key.replace(/_/g, "").slice(0, 5).toLowerCase())
      );
      throw new HeroError(
        `${typeName} hat kein Feld '${key}' (bei ${path}).` + (near.length ? ` Gemeint: ${near.slice(0, 4).join(", ")}?` : "")
      );
    }
    const nestedType = fields[key];
    if (nestedType && inner !== null && inner !== void 0) {
      checkValue(nestedType, inner, `${path}.${key}`);
    }
  }
}

// servers/hero/src/tenant.ts
function norm(s) {
  return (s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
}
var DISCOVERY = `query {
  company { id name measures { id name short } }
  user { id email partner { id full_name } }
  project_types(is_active: true) {
    id name is_default is_active
    project_status_steps { id name status_code sort_order is_active }
  }
  document_types(show_deleted: false) { id name base_type is_active }
  calendar_event_categories(show_deleted: false) { id name }
}`;
async function discoverConfig(hero) {
  const d = await hero.gql(DISCOVERY);
  const types = (d.project_types ?? []).filter((t) => t.is_active !== false);
  const defType = types.find((t) => t.is_default) ?? types.slice().sort(
    (a, b) => (b.project_status_steps?.length ?? 0) - (a.project_status_steps?.length ?? 0)
  )[0] ?? null;
  const steps = {};
  const stepNames = {};
  for (const s of defType?.project_status_steps ?? []) {
    if (s.is_active === false) continue;
    steps[norm(s.name)] = s.id;
    stepNames[String(s.id)] = s.name;
  }
  const documentTypes = {};
  const documentTypeNames = [];
  for (const t of d.document_types ?? []) {
    if (t.is_active === false) continue;
    documentTypes[norm(t.name)] = t.id;
    if (t.base_type && !(norm(t.base_type) in documentTypes)) {
      documentTypes[norm(t.base_type)] = t.id;
    }
    documentTypeNames.push(t.name);
  }
  const calendarCategories = {};
  for (const c of d.calendar_event_categories ?? []) calendarCategories[norm(c.name)] = c.id;
  const measures = {};
  for (const m of d.company?.measures ?? []) {
    measures[norm(m.name)] = m.id;
    if (m.short) measures[norm(m.short)] = m.id;
  }
  const measureId = measures[norm("PRJ")] ?? measures[norm("Projekt")] ?? d.company?.measures?.[0]?.id ?? null;
  return {
    companyId: d.company?.id ?? null,
    companyName: d.company?.name ?? "unbekannt",
    projectTypeId: defType?.id ?? null,
    steps,
    stepNames,
    documentTypes,
    documentTypeNames,
    calendarCategories,
    measureId,
    measures,
    partnerId: d.user?.partner?.id ?? null,
    partnerName: d.user?.partner?.full_name ?? d.user?.email ?? "unbekannt",
    fetchedAt: Date.now()
  };
}
var TTL_SECONDS = 60 * 60 * 12;
async function getConfig(kv, hero, apiKey) {
  const cacheKey = `cfg:${(await sha256hex(apiKey)).slice(0, 32)}`;
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached;
  const cfg = await discoverConfig(hero);
  await kv.put(cacheKey, JSON.stringify(cfg), { expirationTtl: TTL_SECONDS });
  return cfg;
}
function resolveDocumentType(cfg, wanted) {
  const n = norm(wanted);
  if (cfg.documentTypes[n] !== void 0) return cfg.documentTypes[n];
  const aliases = {
    rechnung13b: (x) => x.includes("13b"),
    rechnung: (x) => x.includes("rechnung") && !x.includes("13b") && !x.includes("gutschrift"),
    angebot: (x) => x.includes("angebot") && !x.includes("bestaetigung"),
    gutschrift: (x) => x.includes("gutschrift"),
    auftragsbestaetigung: (x) => x.includes("auftragsbest"),
    lieferschein: (x) => x.includes("lieferschein"),
    allgemein: (x) => x.includes("allgemein") || x.includes("sonstig")
  };
  const match = aliases[n];
  if (match) {
    for (const key of Object.keys(cfg.documentTypes)) {
      if (match(key)) return cfg.documentTypes[key];
    }
  }
  throw new HeroError(
    `Dokumenttyp '${wanted}' gibt es bei ${cfg.companyName} nicht. Verf\xFCgbar: ${cfg.documentTypeNames.join(", ")}`
  );
}

// shared/src/types.ts
var str = (description) => ({ type: "string", description });
var int = (description) => ({ type: "integer", description });
var num = (description) => ({ type: "number", description });
var bool = (description) => ({ type: "boolean", description });
function req(args, name) {
  const v = args[name];
  if (v === void 0 || v === null || v === "") {
    throw new Error(`Pflichtargument '${name}' fehlt.`);
  }
  return v;
}

// servers/hero/src/tools/read.ts
var MAX_LIMIT = 200;
var clamp = (n, def) => Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : def));
var DELETED_STATUS = 1e3;
function invoiceTypeIds(cfg) {
  const ids = /* @__PURE__ */ new Set();
  for (const [name, id] of Object.entries(cfg.documentTypes)) {
    if (name.includes("rechnung") && !name.includes("gutschrift")) ids.add(id);
  }
  return [...ids];
}
async function resolveProject(ctx, nrOrId) {
  if (typeof nrOrId === "number") return nrOrId;
  const raw = String(nrOrId).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const d = await ctx.hero.gql(
    `query ($r: String) { project_matches(relative_id: $r, first: 1) { id } }`,
    { r: raw }
  );
  const hit = d.project_matches?.[0];
  if (!hit) throw new HeroError(`Kein Projekt '${raw}' gefunden.`);
  return hit.id;
}
async function resolveJobStatus(ctx, wanted) {
  const verified = { offen: 0, zugewiesen: 100, erledigt: 500 };
  const n = norm(wanted);
  if (/^\d+$/.test(wanted)) return [Number(wanted)];
  if (verified[n] !== void 0) return [verified[n]];
  const d = await ctx.hero.gql(`query { field_service_jobs(first: 200) { status_code status_name } }`);
  const seen = /* @__PURE__ */ new Map();
  for (const j of d.field_service_jobs ?? []) {
    if (j.status_name != null) seen.set(norm(j.status_name), j.status_code);
  }
  for (const [name, code] of seen) if (name === n || name.startsWith(n)) return [code];
  throw new HeroError(
    `Status '${wanted}' unbekannt. Verifiziert: offen, zugewiesen, erledigt. Bei diesem Mandanten kommen au\xDFerdem vor: ${[...seen.keys()].join(", ") || "(keine Auftr\xE4ge)"}. Ein status_code als Zahl geht auch.`
  );
}
var readTools = [
  {
    name: "dashboard",
    title: "Gesch\xE4fts\xFCberblick",
    description: "Gesch\xE4fts\xFCberblick in EINEM Aufruf: offene Posten (Summe + Liste), Termine der n\xE4chsten 7 Tage, offene und zugewiesene Auftr\xE4ge. Ideal als Einstieg ('was ist heute los?'). stichtag optional 'YYYY-MM-DD' (Default: heute).",
    inputSchema: {
      type: "object",
      properties: { stichtag: str("Bezugstag 'YYYY-MM-DD'. Default: heute.") },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const today = args.stichtag ? /* @__PURE__ */ new Date(`${args.stichtag}T00:00:00Z`) : /* @__PURE__ */ new Date();
      if (Number.isNaN(today.getTime())) throw new Error("stichtag muss 'YYYY-MM-DD' sein.");
      const start = today.toISOString().slice(0, 10);
      const end = new Date(today.getTime() + 7 * 864e5).toISOString().slice(0, 10);
      const typeIds = invoiceTypeIds(ctx.cfg);
      const d = await ctx.hero.gql(
        `query ($t: [Int], $s: DateTime, $e: DateTime) {
           rechnungen: customer_documents(document_type_ids: $t, first: 100, orderBy: "date desc") {
             id nr value date status_code status_name
             contact { full_name company_name }
             customer_document_booking { is_open due_date balance payments { value paid_date } } }
           termine: calendar_events(start: $s, end: $e, first: 50) {
             id title start end all_day category { name }
             project_match { id project_nr name } }
           auftraege: field_service_jobs(status: [0, 100], first: 50) {
             id display_nr title status_code status_name start end
             customer { full_name company_name } } }`,
        { t: typeIds.length ? typeIds : null, s: `${start}T00:00:00Z`, e: `${end}T23:59:59Z` }
      );
      const offen = (d.rechnungen ?? []).filter((r) => r.status_code !== DELETED_STATUS).map((r) => {
        const b = r.customer_document_booking;
        const bezahlt = (b?.payments ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
        const rest = Math.round(((r.value ?? 0) - bezahlt) * 100) / 100;
        const faellig = b?.due_date ?? null;
        const tageUeberfaellig = faellig && rest > 0 ? Math.floor((today.getTime() - new Date(faellig).getTime()) / 864e5) : null;
        return {
          document_id: r.id,
          nr: r.nr,
          kunde: r.contact?.company_name || r.contact?.full_name || null,
          betrag: r.value,
          bezahlt,
          restbetrag: rest,
          faellig_am: faellig,
          tage_ueberfaellig: tageUeberfaellig,
          ist_offen: b?.is_open ?? rest > 0
        };
      }).filter((r) => r.ist_offen && r.restbetrag > 5e-3);
      return {
        stichtag: start,
        offene_posten: {
          anzahl: offen.length,
          summe: Math.round(offen.reduce((s, r) => s + r.restbetrag, 0) * 100) / 100,
          davon_ueberfaellig: offen.filter((r) => (r.tage_ueberfaellig ?? -1) > 0).length,
          posten: offen.slice(0, 25)
        },
        termine_7_tage: (d.termine ?? []).map((t) => ({
          id: t.id,
          titel: t.title,
          start: t.start,
          ende: t.end,
          ganztags: t.all_day,
          kategorie: t.category?.name ?? null,
          projekt: t.project_match ? `${t.project_match.project_nr} ${t.project_match.name ?? ""}`.trim() : null
        })),
        auftraege_offen: (d.auftraege ?? []).map((j) => ({
          id: j.id,
          nr: j.display_nr,
          titel: j.title,
          status: j.status_name,
          start: j.start,
          kunde: j.customer?.company_name || j.customer?.full_name || null
        }))
      };
    }
  },
  {
    name: "search",
    title: "Universalsuche",
    description: "Universalsuche \xFCber Kontakte, Projekte, Dokumente und Auftr\xE4ge in EINEM Request. Erster Griff, wenn nur ein Name, eine Nummer oder ein Stichwort bekannt ist.",
    inputSchema: {
      type: "object",
      properties: { term: str("Suchbegriff \u2014 Name, Firma, Projektnummer, Dokumentnummer \u2026") },
      required: ["term"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const term = req(args, "term");
      const d = await ctx.hero.gql(
        `query ($t: String) {
           kontakte: global_search(category: contacts, term: $t, first: 8)
             { ... on Customer { id full_name company_name email phone_mobile type } }
           projekte: global_search(category: project_matches, term: $t, first: 8)
             { ... on ProjectMatch { id project_nr name
                 current_project_match_status { step_id name } } }
           dokumente: global_search(category: documents, term: $t, first: 8)
             { ... on CustomerDocument { id nr type value date status_name } }
           auftraege: global_search(category: jobs, term: $t, first: 8)
             { ... on FieldService_Job { id display_nr title status_name start } } }`,
        { t: term }
      );
      return {
        kontakte: d.kontakte ?? [],
        projekte: (d.projekte ?? []).map((p) => ({
          id: p.id,
          project_nr: p.project_nr,
          name: p.name,
          stufe: p.current_project_match_status?.name ?? null
        })),
        dokumente: d.dokumente ?? [],
        auftraege: d.auftraege ?? []
      };
    }
  },
  {
    name: "get_project",
    title: "Projektakte",
    description: "Projektakte: Stufe, Kunde, Adresse, Dokumente und Dateien. Akzeptiert Projektnummer ('PRJ-153') oder project_match_id.",
    inputSchema: {
      type: "object",
      properties: { nr_or_id: str("Projektnummer wie 'PRJ-153' oder die project_match_id.") },
      required: ["nr_or_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = await resolveProject(ctx, req(args, "nr_or_id"));
      const d = await ctx.hero.gql(
        `query ($i: Int) { project_match(project_match_id: $i) {
           id project_nr name project_id volume
           current_project_match_status { step_id name }
           customer { id full_name company_name email phone_mobile }
           address { street zipcode city }
           customer_documents(first: 30) { id nr type value vat date status_code status_name }
           file_uploads(first: 30) { uuid filename type created } } }`,
        { i: id }
      );
      const p = d.project_match;
      if (!p) throw new HeroError(`Projekt ${id} nicht gefunden.`);
      return {
        ...p,
        stufe: p.current_project_match_status?.name ?? null,
        dokumente_aktiv: (p.customer_documents ?? []).filter(
          (x) => x.status_code !== DELETED_STATUS
        )
      };
    }
  },
  {
    name: "list_customers",
    title: "Kontakte auflisten",
    description: "Kontakte suchen oder auflisten (Name, Firma, E-Mail, Telefon, Adresse).",
    inputSchema: {
      type: "object",
      properties: {
        search_term: str("Freitextsuche \xFCber Name, Firma, E-Mail. Leer = die neuesten."),
        limit: int("Maximale Trefferzahl (1\u2013200, Default 25).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($s: String, $n: Int) {
           contacts(search: $s, first: $n) {
             id nr full_name first_name last_name company_name email
             phone_mobile phone_home category is_deleted
             address { street zipcode city } } }`,
        { s: args.search_term || null, n: clamp(args.limit, 25) }
      );
      return { kontakte: (d.contacts ?? []).filter((c) => !c.is_deleted) };
    }
  },
  {
    name: "get_customer",
    title: "Kontakt mit Projekten",
    description: "Ein Kontakt mit allen Adressen und seinen Projekten.",
    inputSchema: {
      type: "object",
      properties: { customer_id: int("Die Kontakt-ID aus list_customers oder search.") },
      required: ["customer_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($i: [Int]) {
           contacts(ids: $i, first: 1) {
             id nr full_name title first_name last_name company_name email
             phone_mobile phone_home category address_id
             address { id street zipcode city }
             customer_addresses { id title address_id address { street zipcode city } }
             project_matches { id project_nr name volume created
               current_project_match_status { step_id name } } } }`,
        { i: [req(args, "customer_id")] }
      );
      const c = d.contacts?.[0];
      if (!c) throw new HeroError(`Kontakt ${args.customer_id} nicht gefunden.`);
      return c;
    }
  },
  {
    name: "list_documents",
    title: "Dokumente eines Projekts",
    description: "Dokumente eines Projekts (Angebote, Rechnungen, \u2026) mit Status und Wert. only_active=true blendet gel\xF6schte aus.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID (nicht die Projektnummer)."),
        only_active: bool("Nur nicht-gel\xF6schte Dokumente. Default true.")
      },
      required: ["project_match_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($p: [Int]) {
           customer_documents(project_match_ids: $p, first: 100, orderBy: "date desc") {
             id nr type value vat date status_code status_name
             document_type { id name base_type }
             file_upload { uuid filename } } }`,
        { p: [req(args, "project_match_id")] }
      );
      const only = args.only_active !== false;
      const docs = (d.customer_documents ?? []).filter(
        (x) => !only || x.status_code !== DELETED_STATUS
      );
      return { dokumente: docs, anzahl: docs.length };
    }
  },
  {
    name: "list_articles",
    title: "Artikelstamm",
    description: "Artikelstamm mit Preisen. Liefert product_id (String!), Nummer, Name, EK (base_price), VK (list_price) und den Lagerbestand, falls der Artikel Lagermaterial ist.",
    inputSchema: {
      type: "object",
      properties: {
        search_term: str("Freitextsuche \xFCber Name, Nummer, Hersteller."),
        limit: int("Maximale Trefferzahl (1\u2013200, Default 25).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($s: String, $n: Int) {
           supply_product_versions(search: $s, first: $n) {
             product_id nr base_price list_price vat_percent price_quantity is_deleted
             base_data { name description unit_type manufacturer ean category }
             stock_materials { id total_stock min_stock unit_type } } }`,
        { s: args.search_term || null, n: clamp(args.limit, 25) }
      );
      return {
        artikel: (d.supply_product_versions ?? []).filter((a) => !a.is_deleted).map((a) => ({
          product_id: a.product_id,
          nr: a.nr,
          name: a.base_data?.name ?? null,
          einheit: a.base_data?.unit_type ?? null,
          hersteller: a.base_data?.manufacturer ?? null,
          ek: a.base_price,
          vk: a.list_price,
          mwst: a.vat_percent,
          bestand: a.stock_materials?.[0]?.total_stock ?? null
        }))
      };
    }
  },
  {
    name: "get_stock",
    title: "Lagerbestand",
    description: "Lagerbestand eines Artikels, gelesen \xFCber den Artikel. product_id ist ein String (HERO nutzt hier keine Zahl) \u2014 aus list_articles \xFCbernehmen.",
    inputSchema: {
      type: "object",
      properties: { product_id: str("product_id aus list_articles (String, keine Zahl).") },
      required: ["product_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($p: [String]) {
           supply_product_versions(product_ids: $p, first: 1) {
             product_id nr base_data { name unit_type }
             stock_materials { id name item_number category unit_type
               total_stock min_stock target_stock
               open_order_items_amount open_consignment_items_amount } } }`,
        { p: [req(args, "product_id")] }
      );
      const a = d.supply_product_versions?.[0];
      if (!a) throw new HeroError(`Artikel '${args.product_id}' nicht gefunden.`);
      if (!a.stock_materials?.length) {
        return { product_id: a.product_id, name: a.base_data?.name, hinweis: "Kein Lagerartikel." };
      }
      return { product_id: a.product_id, name: a.base_data?.name, lager: a.stock_materials };
    }
  },
  {
    name: "list_jobs",
    title: "Field-Service-Auftr\xE4ge",
    description: "Field-Service-Auftr\xE4ge (Wartung, Reparatur, Notdienst). status akzeptiert offen/zugewiesen/erledigt (verifiziert) oder einen status_code als Zahl; andere Namen werden gegen die tats\xE4chlichen Statuswerte des Mandanten aufgel\xF6st.",
    inputSchema: {
      type: "object",
      properties: {
        status: str("offen | zugewiesen | erledigt | <status_code als Zahl>"),
        project_match_id: int("Nur Auftr\xE4ge zu diesem Projekt."),
        search_term: str("Freitext \xFCber den Auftragstitel."),
        limit: int("Maximale Trefferzahl (1\u2013200, Default 25).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const status = args.status ? await resolveJobStatus(ctx, String(args.status)) : null;
      const d = await ctx.hero.gql(
        `query ($st: [Int], $p: Int, $s: String, $n: Int) {
           field_service_jobs(status: $st, project_match_id: $p, search: $s, first: $n,
                              orderBy: "start desc") {
             id display_nr title description type localized_type status_code status_name
             start end project_match_id
             customer { id full_name company_name }
             address { street zipcode city }
             partners { id full_name } } }`,
        {
          st: status,
          p: args.project_match_id ?? null,
          s: args.search_term || null,
          n: clamp(args.limit, 25)
        }
      );
      return { auftraege: d.field_service_jobs ?? [] };
    }
  },
  {
    name: "get_checklists",
    title: "Checklisten eines Auftrags",
    description: "Checklisten eines Auftrags inklusive der vor Ort in der Mobile-App ausgef\xFCllten Antworten (Feld 'data').",
    inputSchema: {
      type: "object",
      properties: { job_id: int("Die Auftrags-ID aus list_jobs.") },
      required: ["job_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($j: Int) {
           job_checklists(job_id: $j, first: 50) {
             id name status data created modified
             partner { id full_name } } }`,
        { j: req(args, "job_id") }
      );
      return { checklisten: d.job_checklists ?? [] };
    }
  },
  {
    name: "list_calendar",
    title: "Termine",
    description: "Termine im Zeitraum. start/end als ISO MIT Offset ('2026-07-20T00:00:00+02:00'); ohne Offset antwortet HERO mit einem Serverfehler.",
    inputSchema: {
      type: "object",
      properties: {
        start: str("Beginn des Zeitraums, ISO mit Offset."),
        end: str("Ende des Zeitraums, ISO mit Offset."),
        project_match_id: int("Nur Termine zu diesem Projekt."),
        limit: int("Maximale Trefferzahl (1\u2013200, Default 100).")
      },
      required: ["start", "end"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($s: DateTime, $e: DateTime, $p: Int, $n: Int) {
           calendar_events(start: $s, end: $e, project_match_id: $p, first: $n, orderBy: "start asc") {
             id title description start end all_day is_done color
             category { id name }
             project_match { id project_nr name }
             partners { id full_name } } }`,
        {
          s: req(args, "start"),
          e: req(args, "end"),
          p: args.project_match_id ?? null,
          n: clamp(args.limit, 100)
        }
      );
      return { termine: d.calendar_events ?? [] };
    }
  },
  {
    name: "list_time",
    title: "Erfasste Zeiten",
    description: "Erfasste Arbeitszeiten eines Projekts (Datum, Dauer, Kommentar, Mitarbeiter). start/end als 'YYYY-MM-DD'. Dauer steht in duration_in_seconds.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        start: str("Von-Datum 'YYYY-MM-DD'."),
        end: str("Bis-Datum 'YYYY-MM-DD'.")
      },
      required: ["project_match_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($p: Int, $s: Date, $e: Date) {
           tracking_times(project_match_id: $p, start: $s, end: $e, first: 200,
                          show_all_partners: true, orderBy: "start asc") {
             id start end duration_in_seconds comment status_code
             partner { id full_name }
             tracking_times_category { id name } } }`,
        {
          p: req(args, "project_match_id"),
          s: args.start || null,
          e: args.end || null
        }
      );
      const zeiten = d.tracking_times ?? [];
      const sekunden = zeiten.reduce((s, t) => s + (t.duration_in_seconds ?? 0), 0);
      return {
        zeiten,
        summe_sekunden: sekunden,
        summe_stunden: Math.round(sekunden / 3600 * 100) / 100
      };
    }
  },
  {
    name: "list_open_invoices",
    title: "Offene Posten",
    description: "Debitoren-Offene-Posten: wer schuldet was und h\xE4ngt wie weit hinterher. Restbetrag wird aus Rechnungswert minus erfassten Zahlungen gerechnet.",
    inputSchema: {
      type: "object",
      properties: { overdue_only: bool("Nur \xFCberf\xE4llige Rechnungen. Default false.") },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const typeIds = invoiceTypeIds(ctx.cfg);
      const d = await ctx.hero.gql(
        `query ($t: [Int]) {
           customer_documents(document_type_ids: $t, first: 200, orderBy: "date desc") {
             id nr value vat date status_code status_name
             project_match_id
             contact { id full_name company_name email }
             customer_document_booking { is_open status_name due_date paid_date balance
               payments { id value paid_date } } } }`,
        { t: typeIds.length ? typeIds : null }
      );
      const now = Date.now();
      const posten = (d.customer_documents ?? []).filter((r) => r.status_code !== DELETED_STATUS).map((r) => {
        const b = r.customer_document_booking;
        const bezahlt = (b?.payments ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
        const rest = Math.round(((r.value ?? 0) - bezahlt) * 100) / 100;
        const tage = b?.due_date ? Math.floor((now - new Date(b.due_date).getTime()) / 864e5) : null;
        return {
          document_id: r.id,
          nr: r.nr,
          project_match_id: r.project_match_id,
          kunde: r.contact?.company_name || r.contact?.full_name || null,
          email: r.contact?.email ?? null,
          datum: r.date,
          betrag: r.value,
          bezahlt,
          restbetrag: rest,
          faellig_am: b?.due_date ?? null,
          tage_ueberfaellig: tage,
          status: b?.status_name ?? r.status_name
        };
      }).filter((r) => r.restbetrag > 5e-3).filter((r) => !args.overdue_only || (r.tage_ueberfaellig ?? -1) > 0);
      return {
        anzahl: posten.length,
        summe: Math.round(posten.reduce((s, r) => s + r.restbetrag, 0) * 100) / 100,
        posten
      };
    }
  },
  {
    name: "get_payment_status",
    title: "Zahlungsstatus",
    description: "Zahlungsstatus einer Rechnung: offen oder bezahlt, Restbetrag, F\xE4lligkeit und die erfassten Zahlungen. Das ist der R\xFCcklesepfad f\xFCr record_payment.",
    inputSchema: {
      type: "object",
      properties: { document_id: int("Die Dokument-ID der Rechnung.") },
      required: ["document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($i: [Int]) {
           customer_documents(ids: $i, first: 1) {
             id nr type value vat date status_code status_name
             contact { id full_name company_name }
             customer_document_booking { id is_open status status_name due_date paid_date
               discount_rate discount_date balance
               payments { id value paid_date created } } } }`,
        { i: [req(args, "document_id")] }
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Dokument ${args.document_id} nicht gefunden.`);
      const b = doc.customer_document_booking;
      const bezahlt = (b?.payments ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
      return {
        document_id: doc.id,
        nr: doc.nr,
        kunde: doc.contact?.company_name || doc.contact?.full_name || null,
        betrag: doc.value,
        bezahlt,
        restbetrag: Math.round(((doc.value ?? 0) - bezahlt) * 100) / 100,
        ist_offen: b?.is_open ?? null,
        faellig_am: b?.due_date ?? null,
        bezahlt_am: b?.paid_date ?? null,
        status: b?.status_name ?? doc.status_name,
        zahlungen: b?.payments ?? [],
        hinweis: b ? void 0 : "F\xFCr dieses Dokument existiert kein Buchungssatz (nicht zahlungsrelevant)."
      };
    }
  },
  {
    name: "list_receipts",
    title: "Belege (Eingangsseite)",
    description: "Eingangsbelege inklusive Zahlungsstand. offen = Wert minus paid_sum. Hinweis: Belege lassen sich \xFCber die HERO-API nur lesen, nicht anlegen.",
    inputSchema: {
      type: "object",
      properties: { limit: int("Maximale Trefferzahl (1\u2013200, Default 50).") },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `query ($n: Int) {
           receipts(first: $n, orderBy: "receipt_date desc") {
             id number type status_code receipt_date due_date paid_date paid_sum value
             customer { id full_name company_name } } }`,
        { n: clamp(args.limit, 50) }
      );
      return {
        belege: (d.receipts ?? []).map((r) => ({
          ...r,
          offen: Math.round(((r.value ?? 0) - (r.paid_sum ?? 0)) * 100) / 100
        }))
      };
    }
  },
  {
    name: "download_document",
    title: "PDF-Link eines Dokuments",
    description: "Vorsignierter, zeitbegrenzter PDF-Link eines Dokuments \u2014 der Empf\xE4nger braucht keinen Token. Existiert kein PDF, ist das Dokument noch Entwurf oder im Publishing (~5\u20138 s).",
    inputSchema: {
      type: "object",
      properties: {
        document_id: int("Die Dokument-ID."),
        minutes: int("G\xFCltigkeit des Links in Minuten (Default 5).")
      },
      required: ["document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "document_id");
      const seconds = Math.max(60, Math.min(60 * 60 * 24, (Number(args.minutes) || 5) * 60));
      const d = await ctx.hero.gql(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr status_name file_upload { uuid filename } } }`,
        { i: [id] }
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Dokument ${id} nicht gefunden.`);
      if (!doc.file_upload?.uuid) {
        throw new HeroError(
          `Dokument ${doc.nr ?? id} hat kein PDF (Status: ${doc.status_name}). Entw\xFCrfe und noch laufendes Publishing haben keine Datei.`
        );
      }
      const u = await ctx.hero.gql(
        `query ($u: [String!], $s: Int) { file_uploads(uuids: $u, first: 1) {
           uuid filename temporary_url(expires: $s) } }`,
        { u: [doc.file_upload.uuid], s: seconds }
      );
      return {
        nr: doc.nr,
        filename: u.file_uploads?.[0]?.filename ?? doc.file_upload.filename,
        url: u.file_uploads?.[0]?.temporary_url,
        gueltig_bis_minuten: seconds / 60
      };
    }
  },
  {
    name: "download_file",
    title: "Link f\xFCr eine Datei",
    description: "Vorsignierter, zeitbegrenzter Link f\xFCr eine beliebige Datei per uuid.",
    inputSchema: {
      type: "object",
      properties: {
        file_upload_uuid: str("Die uuid aus get_project oder upload_file."),
        minutes: int("G\xFCltigkeit des Links in Minuten (Default 5).")
      },
      required: ["file_upload_uuid"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const seconds = Math.max(60, Math.min(60 * 60 * 24, (Number(args.minutes) || 5) * 60));
      const d = await ctx.hero.gql(
        `query ($u: [String!], $s: Int) { file_uploads(uuids: $u, first: 1) {
           uuid filename type size temporary_url(expires: $s) } }`,
        { u: [req(args, "file_upload_uuid")], s: seconds }
      );
      const f = d.file_uploads?.[0];
      if (!f) throw new HeroError(`Datei ${args.file_upload_uuid} nicht gefunden.`);
      return { ...f, url: f.temporary_url, gueltig_bis_minuten: seconds / 60 };
    }
  }
];

// servers/hero/src/tools/write.ts
var UNITS = [
  "Stk",
  "Std",
  "lfm",
  "m",
  "m\xB2",
  "m\xB3",
  "h",
  "kg",
  "g",
  "ml",
  "cm",
  "mm",
  "km",
  "Tag",
  "Woche",
  "Satz",
  "Paar",
  "Set",
  "Sack",
  "%"
];
var UNIT_ALIASES = {
  pauschal: "Satz",
  psch: "Satz",
  st\u00FCck: "Stk",
  stueck: "Stk",
  stk: "Stk",
  st: "Stk",
  stunde: "Std",
  stunden: "Std",
  std: "Std",
  qm: "m\xB2",
  m2: "m\xB2",
  m3: "m\xB3",
  cbm: "m\xB3",
  lfdm: "lfm",
  laufmeter: "lfm",
  tage: "Tag",
  wochen: "Woche"
};
function unit(raw) {
  const exact = UNITS.find((u) => u.toLowerCase() === String(raw).toLowerCase());
  if (exact) return exact;
  const alias = UNIT_ALIASES[norm(raw)];
  if (alias) return alias;
  throw new HeroError(
    `Einheit '${raw}' gibt es bei HERO nicht. Erlaubt: ${UNITS.join(" ")}. ('Pauschal' hei\xDFt bei HERO 'Satz'.)`
  );
}
var JOB_TYPES = ["maintenance", "repair", "emergency", "other"];
var CHECKLIST_TYPES = ["checkbox", "text", "image", "signature", "select"];
var POSITION_SCHEMA = {
  type: "array",
  description: "Positionen als Objekte. Betr\xE4ge sind Netto-Einzelpreise. F\xFCr Abschlags-/Schlussrechnungen d\xFCrfen Betr\xE4ge negativ sein.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Positionsbezeichnung." },
      unit: { type: "string", description: `Einheit \u2014 eine aus: ${UNITS.join(" ")}` },
      quantity: { type: "number", description: "Menge." },
      unit_price: { type: "number", description: "Netto-Einzelpreis." },
      description: { type: "string", description: "Optionaler Langtext." },
      vat_percent: { type: "number", description: "MwSt.-Satz, Default 19." }
    },
    required: ["name", "unit", "quantity", "unit_price"],
    additionalProperties: false
  }
};
function buildPositions(positions) {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new HeroError("positions darf nicht leer sein.");
  }
  return positions.map((p, i) => {
    if (!p || typeof p !== "object") throw new HeroError(`Position ${i + 1} ist kein Objekt.`);
    if (!p.name) throw new HeroError(`Position ${i + 1}: 'name' fehlt.`);
    if (typeof p.quantity !== "number") throw new HeroError(`Position ${i + 1}: 'quantity' muss eine Zahl sein.`);
    if (typeof p.unit_price !== "number") throw new HeroError(`Position ${i + 1}: 'unit_price' muss eine Zahl sein.`);
    return {
      add_product_position: {
        name: p.name,
        description: p.description ?? "",
        unit_type: unit(p.unit),
        quantity: p.quantity,
        net_price: p.unit_price,
        vat_percent: p.vat_percent ?? 19
      }
    };
  });
}
async function recipientFor(ctx, projectMatchId) {
  const d = await ctx.hero.gql(
    `query ($i: Int) { project_match(project_match_id: $i) {
       id customer { title first_name last_name company_name
         address { street zipcode city } } } }`,
    { i: projectMatchId }
  );
  const c = d.project_match?.customer;
  if (!c) throw new HeroError(`Projekt ${projectMatchId} hat keinen Kunden \u2014 Dokument nicht m\xF6glich.`);
  return {
    company_name: c.company_name ?? "",
    title: c.title ?? "",
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    street: c.address?.street ?? "",
    zipcode: c.address?.zipcode ?? "",
    city: c.address?.city ?? ""
  };
}
async function createDocument(ctx, documentTypeId, projectMatchId, actions, publish) {
  const r = await ctx.hero.gql(
    `mutation ($i: Documents_CreateDocumentInput!, $a: [Documents_DocumentBuilderActionInput!]!) {
       create_document(input: $i, actions: $a) { customer_document_id } }`,
    {
      i: { document_type_id: documentTypeId, project_match_id: projectMatchId, publish },
      a: actions
    }
  );
  const id = r.create_document?.customer_document_id;
  if (!id) throw new HeroError("create_document lieferte keine customer_document_id.", r);
  let doc = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt === 0 ? 1500 : 2500);
    const d = await ctx.hero.gql(
      `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
         id nr type value vat date status_code status_name file_upload { uuid filename } } }`,
      { i: [id] }
    );
    doc = d.customer_documents?.[0] ?? doc;
    if (!publish || doc?.file_upload?.uuid) break;
  }
  return {
    document_id: id,
    nr: doc?.nr ?? null,
    wert: doc?.value ?? null,
    mwst: doc?.vat ?? null,
    status: doc?.status_name ?? null,
    pdf_bereit: Boolean(doc?.file_upload?.uuid),
    hinweis: doc?.file_upload?.uuid ? "PDF-Link \xFCber download_document." : "Publishing l\xE4uft noch (asynchron). In ein paar Sekunden download_document aufrufen."
  };
}
var writeTools = [
  {
    name: "create_customer",
    title: "Kontakt anlegen",
    description: "Kontakt mit Adresse anlegen. Wird \xFCber die Stammdaten dedupliziert \u2014 ein bereits vorhandener Kontakt wird zur\xFCckgegeben statt doppelt angelegt. Liefert id UND address_id; die address_id braucht create_project zwingend.",
    inputSchema: {
      type: "object",
      properties: {
        email: str("E-Mail \u2014 Grundlage der Deduplizierung."),
        first_name: str("Vorname."),
        last_name: str("Nachname. Bei HERO Pflicht (au\xDFer es gibt einen Firmennamen)."),
        street: str("Stra\xDFe und Hausnummer."),
        zip_code: str("PLZ. Achtung: 4-stellige PLZ deutet HERO IMMER als Schweiz."),
        city: str("Ort."),
        salutation: str("Anrede, z. B. 'Herr' oder 'Frau'."),
        company: str("Firmenname."),
        phone: str("Mobilnummer.")
      },
      required: ["email", "first_name", "last_name", "street", "zip_code", "city"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async handler(args, ctx) {
      const contact = {
        email: req(args, "email"),
        first_name: req(args, "first_name"),
        last_name: req(args, "last_name"),
        title: args.salutation ?? "Herr",
        category: "customer",
        address: {
          street: req(args, "street"),
          zipcode: req(args, "zip_code"),
          city: req(args, "city")
        }
      };
      if (args.company) contact.company_name = args.company;
      if (args.phone) contact.phone_mobile = args.phone;
      const d = await ctx.hero.gql(
        `mutation ($c: CustomerInput) { create_contact(findExisting: true, contact: $c) {
           id nr email full_name company_name address_id } }`,
        { c: contact }
      );
      const c = d.create_contact;
      if (!c?.address_id) {
        throw new HeroError("Kontakt angelegt, aber ohne address_id \u2014 create_project w\xFCrde scheitern.", c);
      }
      return c;
    }
  },
  {
    name: "create_project",
    title: "Projekt anlegen",
    description: "Projekt auf einen Kunden anlegen. Startet immer auf der ersten Stufe \u2014 eine beim Anlegen mitgegebene Stufe ignoriert HERO. Projekte sind bei HERO NICHT l\xF6schbar.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: int("Kontakt-ID aus create_customer, get_customer oder search."),
        name: str("Projektname, z. B. 'Fenstertausch Musterstra\xDFe'.")
      },
      required: ["customer_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const customerId = req(args, "customer_id");
      const c = await ctx.hero.gql(
        `query ($i: [Int]) { contacts(ids: $i, first: 1) { id address_id full_name } }`,
        { i: [customerId] }
      );
      const kunde = c.contacts?.[0];
      if (!kunde) throw new HeroError(`Kontakt ${customerId} nicht gefunden.`);
      if (!kunde.address_id) {
        throw new HeroError(
          `Kontakt ${customerId} hat keine Adresse. HERO braucht address_id f\xFCr ein Projekt \u2014 erst eine Adresse am Kontakt hinterlegen.`
        );
      }
      const pm = {
        customer_id: customerId,
        address_id: kunde.address_id,
        name: args.name ?? ""
      };
      if (ctx.cfg.projectTypeId) pm.type_id = ctx.cfg.projectTypeId;
      if (ctx.cfg.measureId) pm.measure_id = ctx.cfg.measureId;
      const d = await ctx.hero.gql(
        `mutation ($pm: ProjectMatchInput) { create_project_match(project_match: $pm) {
           id project_nr project_id name
           current_project_match_status { step_id name } } }`,
        { pm }
      );
      const p = d.create_project_match;
      return { ...p, stufe: p?.current_project_match_status?.name ?? null, kunde: kunde.full_name };
    }
  },
  {
    name: "create_offer",
    title: "Angebot anlegen",
    description: "Angebot \xFCber den Document-Builder anlegen. Der Empf\xE4nger wird frisch aus HERO gelesen. \u26A0 Ein ver\xF6ffentlichtes Angebot verschiebt das Projekt automatisch auf die Stufe 'Angebot verschickt'. H\xF6chstens EIN Titel: ab zwei Titeln zeigt HEROs PDF je Titel 0,00 \u20AC.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        positions: POSITION_SCHEMA,
        title: str("Optionaler Titel \xFCber den Positionen (h\xF6chstens einer)."),
        intro: str("Optionaler Einleitungstext."),
        discount_percent: num("Nachlass in Prozent auf das Gesamtdokument.")
      },
      required: ["project_match_id", "positions"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req(args, "project_match_id");
      const actions = [{ set_recipient: await recipientFor(ctx, pm) }];
      if (args.title) actions.push({ add_title: { text: args.title, tier: 0 } });
      if (args.intro) actions.push({ add_text: { text: args.intro } });
      actions.push(...buildPositions(args.positions));
      if (args.discount_percent) {
        actions.push({
          set_document_discount: {
            valueType: "PERCENT",
            value: args.discount_percent,
            label: "Nachlass"
          }
        });
      }
      return createDocument(ctx, resolveDocumentType(ctx.cfg, "angebot"), pm, actions, true);
    }
  },
  {
    name: "create_invoice_from_offer",
    title: "Rechnung aus Angebot",
    description: "Rechnung mit exakt den Positionen des Angebots \u2014 centgenau, inklusive Referenz auf das Angebot. Positionen werden aus dem ver\xF6ffentlichten Angebotsentwurf \xFCbernommen, nicht neu getippt.",
    inputSchema: {
      type: "object",
      properties: {
        offer_document_id: int("Dokument-ID des Angebots."),
        project_match_id: int("Die Projekt-ID.")
      },
      required: ["offer_document_id", "project_match_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const offerId = req(args, "offer_document_id");
      const pm = req(args, "project_match_id");
      const d = await ctx.hero.gql(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr published_customer_document_draft { data } } }`,
        { i: [offerId] }
      );
      const doc = d.customer_documents?.[0];
      if (!doc) throw new HeroError(`Angebot ${offerId} nicht gefunden.`);
      const data = doc.published_customer_document_draft?.data;
      if (!data) {
        throw new HeroError(
          `Angebot ${doc.nr ?? offerId} ist nicht ver\xF6ffentlicht \u2014 es gibt keine \xFCbernehmbaren Positionen.`
        );
      }
      const uids = [];
      (function walk(o) {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === "object") {
          if (o.type === "product" && o.uid) uids.push(o.uid);
          Object.values(o).forEach(walk);
        }
      })(data);
      if (!uids.length) throw new HeroError(`Angebot ${doc.nr ?? offerId} enth\xE4lt keine Positionen.`);
      const actions = [
        { set_recipient: await recipientFor(ctx, pm) },
        {
          add_positions_from_document: {
            documentId: offerId,
            selectedPositions: uids,
            flowType: "copy",
            fixedItemNumbers: true
          }
        },
        {
          set_reference_documents: {
            referenceDocumentIds: [offerId],
            referenceDocuments: doc.nr
          }
        }
      ];
      return createDocument(ctx, resolveDocumentType(ctx.cfg, "rechnung"), pm, actions, true);
    }
  },
  {
    name: "create_document",
    title: "Dokument anlegen",
    description: "Beliebiges Dokument anlegen: rechnung, angebot, gutschrift, auftragsbestaetigung, lieferschein, allgemein, rechnung_13b \u2014 oder jeder Dokumenttyp-Name dieses Mandanten. Abschlags- und Schlussrechnungen sind 'rechnung' mit passenden (auch negativen) Positionen.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        doc_type: str("Dokumenttyp \u2014 K\xFCrzel oder der Name aus der HERO-Konfiguration."),
        positions: POSITION_SCHEMA,
        title: str("Optionaler Titel \xFCber den Positionen."),
        intro: str("Optionaler Einleitungstext.")
      },
      required: ["project_match_id", "doc_type", "positions"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req(args, "project_match_id");
      const typeId = resolveDocumentType(ctx.cfg, req(args, "doc_type"));
      const actions = [{ set_recipient: await recipientFor(ctx, pm) }];
      if (args.title) actions.push({ add_title: { text: args.title, tier: 0 } });
      if (args.intro) actions.push({ add_text: { text: args.intro } });
      actions.push(...buildPositions(args.positions));
      return createDocument(ctx, typeId, pm, actions, true);
    }
  },
  {
    name: "create_timesheet",
    title: "Stundenzettel",
    description: "Stundenzettel als PDF aus den bereits erfassten Zeiten eines Projekts. Baut ein Dokument vom Typ 'allgemein' mit je einer Position pro Zeiteintrag (Menge = Stunden). date_from/date_to als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        date_from: str("Von-Datum 'YYYY-MM-DD'."),
        date_to: str("Bis-Datum 'YYYY-MM-DD'."),
        title: str("\xDCberschrift, Default 'Stundenzettel'.")
      },
      required: ["project_match_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const pm = req(args, "project_match_id");
      const d = await ctx.hero.gql(
        `query ($p: Int, $s: Date, $e: Date) {
           tracking_times(project_match_id: $p, start: $s, end: $e, first: 200,
                          show_all_partners: true, orderBy: "start asc") {
             id start end duration_in_seconds comment
             partner { full_name } } }`,
        { p: pm, s: args.date_from || null, e: args.date_to || null }
      );
      const zeiten = d.tracking_times ?? [];
      if (!zeiten.length) {
        throw new HeroError(
          `F\xFCr Projekt ${pm} sind im Zeitraum keine Zeiten erfasst \u2014 es gibt nichts zu drucken.`
        );
      }
      const positions = zeiten.map((t) => {
        const stunden = Math.round((t.duration_in_seconds ?? 0) / 3600 * 100) / 100;
        const tag = String(t.start ?? "").slice(0, 10);
        const wer = t.partner?.full_name ?? "";
        return {
          add_product_position: {
            name: `${tag}${wer ? ` \xB7 ${wer}` : ""}`,
            description: t.comment ?? "",
            unit_type: "Std",
            quantity: stunden,
            net_price: 0,
            vat_percent: 19
          }
        };
      });
      const summe = Math.round(zeiten.reduce((s, t) => s + (t.duration_in_seconds ?? 0), 0) / 3600 * 100) / 100;
      const actions = [
        { set_recipient: await recipientFor(ctx, pm) },
        { add_title: { text: args.title ?? "Stundenzettel", tier: 0 } },
        {
          add_text: {
            text: `Erfasste Zeiten${args.date_from ? ` vom ${args.date_from}` : ""}${args.date_to ? ` bis ${args.date_to}` : ""} \u2014 Summe ${summe} Stunden.`
          }
        },
        ...positions
      ];
      const res = await createDocument(ctx, resolveDocumentType(ctx.cfg, "allgemein"), pm, actions, true);
      return { ...res, eintraege: zeiten.length, summe_stunden: summe };
    }
  },
  {
    name: "create_job",
    title: "Auftrag anlegen",
    description: "Field-Service-Auftrag (Wartung, Reparatur, Notdienst) anlegen. job_type ist eine geschlossene Liste \u2014 HERO speichert jeden anderen Wert still als 'unknown', deshalb wird hier vorher gepr\xFCft. start/end als ISO MIT Offset. Auftr\xE4ge sind nicht l\xF6schbar.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: int("Kontakt-ID des Auftraggebers."),
        title: str("Titel des Auftrags."),
        start: str("Beginn, ISO mit Offset ('2026-08-10T08:00:00+02:00')."),
        end: str("Ende, ISO mit Offset."),
        project_match_id: int("Optional: Projekt, zu dem der Auftrag geh\xF6rt."),
        job_type: str(`Einer von: ${JOB_TYPES.join(", ")}. Default maintenance.`),
        description: str("Beschreibung / Arbeitsauftrag.")
      },
      required: ["customer_id", "title", "start", "end"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = args.job_type ?? "maintenance";
      if (!JOB_TYPES.includes(type)) {
        throw new HeroError(
          `job_type '${type}' ist ung\xFCltig. Erlaubt: ${JOB_TYPES.join(", ")}. HERO w\xFCrde den Wert still als 'unknown' speichern.`
        );
      }
      const job = {
        customer_id: req(args, "customer_id"),
        title: req(args, "title"),
        type,
        description: args.description ?? "",
        start: req(args, "start"),
        end: req(args, "end")
      };
      if (args.project_match_id) job.project_match_id = args.project_match_id;
      if (ctx.cfg.partnerId) job.partners = [ctx.cfg.partnerId];
      const d = await ctx.hero.gql(
        `mutation ($j: FieldService_JobInput) { create_field_service_job(job: $j) {
           id display_nr title type status_code status_name start end project_match_id } }`,
        { j: job }
      );
      return d.create_field_service_job;
    }
  },
  {
    name: "create_checklist",
    title: "Checkliste anlegen",
    description: "Checkliste an einen Auftrag ODER ein Projekt h\xE4ngen (genau eins von beiden). Die Punkte sind die Struktur \u2014 abgehakt wird in der Mobile-App, nicht \xFCber die API. Eine falsche Form leert HERO beim Anlegen still, deshalb wird das Ergebnis zur\xFCckgelesen und gepr\xFCft.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name der Checkliste."),
        items: {
          type: "array",
          description: "Die Punkte der Checkliste, in Reihenfolge.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Beschriftung des Punkts." },
              type: { type: "string", description: `Einer von: ${CHECKLIST_TYPES.join(", ")}. Default checkbox.` },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Nur bei type 'select': die Auswahlm\xF6glichkeiten."
              },
              multiple: { type: "boolean", description: "Mehrfachauswahl (select) bzw. mehrere Bilder (image)." }
            },
            required: ["label"],
            additionalProperties: false
          }
        },
        job_id: int("Auftrags-ID \u2014 entweder diese oder project_match_id."),
        project_match_id: int("Projekt-ID \u2014 entweder diese oder job_id.")
      },
      required: ["name", "items"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const jobId = args.job_id ?? null;
      const pmId = args.project_match_id ?? null;
      if (Boolean(jobId) === Boolean(pmId)) {
        throw new HeroError("Genau eins angeben: job_id ODER project_match_id.");
      }
      const items = req(args, "items");
      if (!Array.isArray(items) || !items.length) throw new HeroError("items darf nicht leer sein.");
      const entries = items.map((it, i) => {
        const type = it.type ?? "checkbox";
        if (!CHECKLIST_TYPES.includes(type)) {
          throw new HeroError(
            `Punkt ${i + 1}: type '${type}' ung\xFCltig. Erlaubt: ${CHECKLIST_TYPES.join(", ")}.`
          );
        }
        if (!it.label) throw new HeroError(`Punkt ${i + 1}: 'label' fehlt.`);
        const e = { type, label: it.label };
        if (type === "select") {
          e.options = (it.options ?? []).map(String);
          e.multiple = Boolean(it.multiple);
        }
        if (type === "image") e.multiple = Boolean(it.multiple);
        return e;
      });
      const d = await ctx.hero.gql(
        `mutation ($jid: Int, $pm: Int, $c: FieldService_ChecklistInput) {
           create_field_service_checklist(job_id: $jid, project_match_id: $pm, checklist: $c) {
             id name data status created } }`,
        { jid: jobId, pm: pmId, c: { name: req(args, "name"), data: { entries } } }
      );
      const cl = d.create_field_service_checklist;
      const saved = cl?.data?.entries?.length ?? 0;
      if (saved !== entries.length) {
        throw new HeroError(
          `Checkliste angelegt (id ${cl?.id}), aber HERO hat die Punkte verworfen: ${saved} von ${entries.length} gespeichert. Die Checkliste ist damit leer und muss in der Web-App bef\xFCllt werden.`,
          cl?.data
        );
      }
      return cl;
    }
  },
  {
    name: "create_article",
    title: "Artikel anlegen",
    description: "Artikel in den Stamm aufnehmen. Setzt sales_prices UND default_sales_price \u2014 ohne die kalkuliert HERO jedes Angebot mit dem EINKAUFSpreis, und Angebote gehen zum Selbstkostenpreis raus. Das ist die teuerste Falle der HERO-API und hier eingebaut.",
    inputSchema: {
      type: "object",
      properties: {
        nr: str("Artikelnummer (eindeutig)."),
        name: str("Artikelbezeichnung."),
        unit: str(`Einheit \u2014 eine aus: ${UNITS.join(" ")}`),
        purchase_price: num("Einkaufspreis netto."),
        sale_price: num("Verkaufspreis netto \u2014 landet korrekt im Angebot."),
        description: str("Beschreibung / Langtext."),
        manufacturer: str("Hersteller."),
        ean: str("EAN.")
      },
      required: ["nr", "name", "unit", "purchase_price", "sale_price"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const name = req(args, "name");
      const vk = req(args, "sale_price");
      const d = await ctx.hero.gql(
        `mutation ($p: Documents_SupplyProductVersionInput!) {
           create_supply_product_version(supply_product_version: $p) {
             product_id nr base_price list_price vat_percent
             base_data { name unit_type } } }`,
        {
          p: {
            nr: req(args, "nr"),
            base_price: req(args, "purchase_price"),
            list_price: vk,
            vat_percent: 19,
            price_quantity: 1,
            default_sales_price: vk,
            sales_prices: [{ net_price_per_unit: vk, label: "VK" }],
            base_data: {
              name,
              description: args.description ?? "",
              ean: args.ean ?? "",
              unit_type: unit(req(args, "unit")),
              manufacturer: args.manufacturer ?? "",
              matchcode: name.toUpperCase().slice(0, 40)
            }
          }
        }
      );
      return d.create_supply_product_version;
    }
  },
  {
    name: "schedule_appointment",
    title: "Termin anlegen",
    description: "Termin am Projekt anlegen. start/end als ISO MIT Offset \u2014 ohne Offset antwortet HERO mit einem Serverfehler. category ist der Name einer Terminkategorie dieses Mandanten.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        title: str("Titel des Termins."),
        start: str("Beginn, ISO mit Offset ('2026-08-10T09:00:00+02:00')."),
        end: str("Ende, ISO mit Offset."),
        category: str("Name der Terminkategorie (siehe Fehlermeldung f\xFCr die verf\xFCgbaren).")
      },
      required: ["project_match_id", "title", "start", "end"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const cats = ctx.cfg.calendarCategories;
      let categoryId = null;
      if (args.category) {
        categoryId = cats[norm(String(args.category))] ?? null;
        if (categoryId === null) {
          throw new HeroError(
            `Terminkategorie '${args.category}' unbekannt. Verf\xFCgbar: ${Object.keys(cats).join(", ")}`
          );
        }
      } else {
        categoryId = Object.values(cats)[0] ?? null;
      }
      const event = {
        project_match_id: req(args, "project_match_id"),
        title: req(args, "title"),
        start: req(args, "start"),
        end: req(args, "end"),
        all_day: false
      };
      if (categoryId !== null) event.category_id = categoryId;
      if (ctx.cfg.partnerId) event.partner_ids = [ctx.cfg.partnerId];
      const d = await ctx.hero.gql(
        `mutation ($e: CalendarEventInput) { create_calendar_event(calendar_event: $e) {
           id title start end all_day category { id name } } }`,
        { e: event }
      );
      return d.create_calendar_event;
    }
  },
  {
    name: "add_task",
    title: "Aufgabe anlegen",
    description: "Aufgabe an ein Projekt h\xE4ngen. HERO hat kein create_task \u2014 update_task ohne id legt an (Upsert). due als ISO mit Offset.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        title: str("Titel der Aufgabe."),
        due: str("F\xE4llig am, ISO mit Offset."),
        comment: str("Kommentar / Details. (HERO nennt das Feld comment, nicht description.)")
      },
      required: ["project_match_id", "title", "due"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `mutation ($t: TaskInput) { update_task(task: $t) {
           id title comment due_date target_project_match_id } }`,
        {
          t: {
            title: req(args, "title"),
            comment: args.comment ?? "",
            due_date: req(args, "due"),
            target_project_match_id: req(args, "project_match_id")
          }
        }
      );
      return d.update_task;
    }
  },
  {
    name: "log_time",
    title: "Arbeitszeit buchen",
    description: "Arbeitszeit auf ein Projekt buchen. Wie bei Aufgaben legt update_ ohne id an. start/end als ISO MIT Offset. Die Dauer rechnet HERO selbst (duration_in_seconds).",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        start: str("Beginn, ISO mit Offset."),
        end: str("Ende, ISO mit Offset."),
        comment: str("Was wurde gemacht.")
      },
      required: ["project_match_id", "start", "end"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const t = {
        project_match_id: req(args, "project_match_id"),
        start: req(args, "start"),
        end: req(args, "end"),
        comment: args.comment ?? ""
      };
      if (ctx.cfg.partnerId) t.partner_id = ctx.cfg.partnerId;
      const d = await ctx.hero.gql(
        `mutation ($t: Employees_TrackingTimeInput) { update_tracking_time(tracking_time: $t) {
           id start end duration_in_seconds comment partner { id full_name } } }`,
        { t }
      );
      return d.update_tracking_time;
    }
  },
  {
    name: "add_logbook_note",
    title: "Logbucheintrag",
    description: "Logbucheintrag / Kommentar am Projekt. Erscheint als 'Kommentar von <Nutzer>'.",
    inputSchema: {
      type: "object",
      properties: {
        project_match_id: int("Die Projekt-ID."),
        text: str("Der Text des Eintrags.")
      },
      required: ["project_match_id", "text"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const d = await ctx.hero.gql(
        `mutation ($l: LogbookEntryInput!) { add_logbook_entry(logbook_entry: $l) {
           id created } }`,
        {
          l: {
            target: "project_match",
            target_id: req(args, "project_match_id"),
            custom_text: req(args, "text")
          }
        }
      );
      return d.add_logbook_entry;
    }
  },
  {
    name: "record_payment",
    title: "Zahlung erfassen",
    description: "Zahlung auf eine Rechnung erfassen und anschlie\xDFend zur\xFCcklesen, damit klar ist, ob sie wirklich verbucht wurde. date als 'YYYY-MM-DD'.",
    inputSchema: {
      type: "object",
      properties: {
        document_id: int("Dokument-ID der Rechnung."),
        amount: num("Betrag brutto."),
        date: str("Zahlungsdatum 'YYYY-MM-DD'.")
      },
      required: ["document_id", "amount", "date"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const id = req(args, "document_id");
      const amount = req(args, "amount");
      await ctx.hero.gql(
        `mutation ($d: Int!, $p: PaymentInput!) { create_payment(document_id: $d, payment: $p) {
           id nr } }`,
        { d: id, p: { paid_date: req(args, "date"), value: amount } }
      );
      await sleep(1e3);
      const d = await ctx.hero.gql(
        `query ($i: [Int]) { customer_documents(ids: $i, first: 1) {
           id nr value
           customer_document_booking { is_open due_date paid_date balance
             payments { id value paid_date } } } }`,
        { i: [id] }
      );
      const doc = d.customer_documents?.[0];
      const b = doc?.customer_document_booking;
      const bezahlt = (b?.payments ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
      return {
        document_id: id,
        nr: doc?.nr ?? null,
        erfasst: amount,
        bezahlt_gesamt: bezahlt,
        restbetrag: Math.round(((doc?.value ?? 0) - bezahlt) * 100) / 100,
        ist_offen: b?.is_open ?? null,
        zahlungen: b?.payments ?? []
      };
    }
  },
  {
    name: "create_lead",
    title: "Lead einliefern",
    description: "Externen Lead \xFCber die Lead API einliefern. Erzeugt Kunde UND Projekt. \u26A0 Nicht idempotent: der Kunde wird dedupliziert, das Projekt NICHT \u2014 zweimal aufrufen hei\xDFt zwei Projekte, und Projekte sind bei HERO nicht l\xF6schbar.",
    inputSchema: {
      type: "object",
      properties: {
        email: str("E-Mail des Interessenten."),
        last_name: str("Nachname. Pflicht \u2014 fehlt er, antwortet HERO mit HTTP 500."),
        zip_code: str("PLZ. \u26A0 4-stellig deutet HERO IMMER als Schweiz."),
        measure: str("Ma\xDFnahme, z. B. 'PRJ'. Unbekannte Werte landen still auf 'Unbekannt'."),
        first_name: str("Vorname."),
        street: str("Stra\xDFe und Hausnummer."),
        city: str("Ort."),
        comment: str("Freitext zum Anliegen.")
      },
      required: ["email", "last_name", "zip_code"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const body = {
        measure: args.measure ?? "PRJ",
        customer: {
          email: req(args, "email"),
          last_name: req(args, "last_name"),
          first_name: args.first_name ?? ""
        },
        address: {
          zipcode: req(args, "zip_code"),
          street: args.street ?? "",
          city: args.city ?? ""
        },
        project_match: { comment: args.comment ?? "" }
      };
      const res = await ctx.hero.lead(body);
      if (res?.status && res.status !== "success") {
        throw new HeroError(`Lead abgelehnt: ${JSON.stringify(res).slice(0, 400)}`);
      }
      return {
        ...res,
        hinweis: "Die Lead API liefert die project_id, nicht die project_match_id. F\xFCr project_match-Tools erst \xFCber search oder get_project aufl\xF6sen."
      };
    }
  },
  {
    name: "upload_file",
    title: "Datei hochladen",
    description: "Datei nach HERO hochladen und optional an ein Projekt h\xE4ngen. Inhalt entweder als url (wird geladen) oder als content_base64. Liefert die file_upload_uuid, die alle Datei-Konsumenten von HERO brauchen. \u26A0 HERO kennt nur einen Upload-Weg (die Lead API), der dabei zwangsl\xE4ufig ein Eingangs-Projekt anlegt; dieses Projekt ist nicht l\xF6schbar.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung, z. B. 'aufmass.pdf'."),
        url: str("\xD6ffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url."),
        project_match_id: int("Optional: Projekt, an das die Datei geh\xE4ngt wird.")
      },
      required: ["filename"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const { blob, filename } = await loadFile(args);
      const uuid = await leadUpload(ctx, blob, filename, "documents[]");
      if (args.project_match_id) {
        await ctx.hero.gql(
          `mutation ($u: String!, $t: Int!) {
             upload_image(file_upload_uuid: $u, target: project_match, target_id: $t) {
               id uuid filename url } }`,
          { u: uuid, t: args.project_match_id }
        );
      }
      return {
        file_upload_uuid: uuid,
        filename,
        angehaengt_an_projekt: args.project_match_id ?? null,
        hinweis: "Der Upload hat systembedingt ein Eingangs-Projekt in HERO erzeugt."
      };
    }
  },
  {
    name: "attach_pdf",
    title: "Fremd-PDF anh\xE4ngen",
    description: "Ein fremdes PDF als eigenst\xE4ndiges Dokument an ein Projekt h\xE4ngen (nicht \xFCber den Document-Builder erzeugt, sondern hochgeladen). Inhalt als url oder content_base64.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive .pdf."),
        project_match_id: int("Die Projekt-ID."),
        url: str("\xD6ffentlich erreichbare URL des PDFs. Alternative zu content_base64."),
        content_base64: str("PDF-Inhalt base64-kodiert. Alternative zu url."),
        doc_type: str("Dokumenttyp, Default 'allgemein'.")
      },
      required: ["filename", "project_match_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const pm = req(args, "project_match_id");
      const typeId = resolveDocumentType(ctx.cfg, args.doc_type ?? "allgemein");
      const { blob, filename } = await loadFile(args);
      const uuid = await leadUpload(ctx, blob, filename, "documents[]");
      const d = await ctx.hero.gql(
        `mutation ($doc: CustomerDocumentInput!, $u: String!, $t: LinkTargetEnum!, $id: Int!) {
           upload_document(document: $doc, file_upload_uuid: $u, target: $t, target_id: $id) {
             id nr type status_name file_upload { uuid filename } } }`,
        {
          doc: { document_type_id: typeId, project_match_id: pm, use_next_number: true },
          u: uuid,
          t: "project_match",
          id: pm
        }
      );
      return { ...d.upload_document, file_upload_uuid: uuid };
    }
  }
];
async function loadFile(args) {
  const filename = req(args, "filename");
  const hasUrl = Boolean(args.url);
  const hasB64 = Boolean(args.content_base64);
  if (hasUrl === hasB64) {
    throw new HeroError("Genau eins angeben: url ODER content_base64.");
  }
  if (hasUrl) {
    const res = await fetch(String(args.url));
    if (!res.ok) throw new HeroError(`Datei nicht ladbar: HTTP ${res.status} von ${args.url}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 2e7) throw new HeroError("Datei gr\xF6\xDFer als 20 MB.");
    return { blob: new Blob([buf]), filename };
  }
  const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
  let bin;
  try {
    bin = atob(raw);
  } catch {
    throw new HeroError("content_base64 ist kein g\xFCltiges Base64.");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.byteLength > 2e7) throw new HeroError("Datei gr\xF6\xDFer als 20 MB.");
  return { blob: new Blob([bytes]), filename };
}
async function leadUpload(ctx, blob, filename, field) {
  const form = new FormData();
  form.set("measure", "PRJ");
  form.set("customer[email]", "upload-inbox@example.com");
  form.set("customer[last_name]", "Upload-Eingang");
  form.set("address[zipcode]", "20095");
  form.set("project_match[comment]", `Datei-Upload: ${filename}`);
  form.set(field, blob, filename);
  const res = await ctx.hero.leadMultipart(form);
  if (res?.status !== "success") {
    throw new HeroError(`Upload fehlgeschlagen: ${JSON.stringify(res).slice(0, 300)}`);
  }
  await sleep(2e3);
  const d = await ctx.hero.gql(
    `query { contacts(search: "upload-inbox@example.com", first: 1) {
       project_matches { project_id file_uploads(first: 50) { uuid filename created } } } }`
  );
  const uploads = (d.contacts?.[0]?.project_matches ?? []).flatMap(
    (pm) => pm.file_uploads ?? []
  );
  if (!uploads.length) throw new HeroError("Upload gemeldet, aber keine Datei auffindbar.");
  uploads.sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return uploads[0].uuid;
}

// servers/hero/src/tools/index.ts
var tools = [...readTools, ...writeTools];

// servers/hero/src/index.ts
var LOGO = composeLogo(HERO_MARK);
var config = {
  brand: {
    name: "HERO MCP",
    system: "HERO",
    tagline: "Handwerkersoftware f\xFCr Claude",
    accent: HERO_MARK.accent,
    logoSvg: LOGO,
    fields: [
      {
        name: "apiKey",
        label: "HERO-API-Key",
        placeholder: "Bearer-Token aus HERO \u2192 Einstellungen \u2192 API"
      }
    ],
    credentialHelp: "Den Key findest du in HERO unter <b>Einstellungen \u2192 API</b>. Der Zugriff gilt genau f\xFCr diesen Client und l\xE4sst sich jederzeit widerrufen, indem du den Key in HERO neu erzeugst.",
    summary: "Model-Context-Protocol-Server f\xFCr die HERO-Handwerkersoftware \u2014",
    bullets: [
      "<b>Lesen</b> \u2014 Dashboard, Suche, Projekte, Kunden, Dokumente, Artikel, Lager, Auftr\xE4ge, Checklisten, Termine, Zeiten, offene Posten, Zahlungsstatus, Belege, PDF-Links",
      "<b>Schreiben</b> \u2014 Kunden, Projekte, Angebote, Rechnungen, Stundenzettel, Auftr\xE4ge, Checklisten, Artikel, Termine, Aufgaben, Zeiten, Logbuch, Zahlungen, Leads, Dateien",
      "<b>Nicht enthalten</b> \u2014 Bearbeiten und L\xF6schen. Nichts kann kaputtgehen."
    ]
  },
  serverInfo: {
    name: "hero",
    title: "HERO Handwerkersoftware",
    version: "2.1.0",
    websiteUrl: "https://hero-software.de"
  },
  scopes: "hero:read hero:write",
  instructions: `HERO Handwerkersoftware \u2014 bringe deinen Betrieb direkt in den Chat. Frage Projekte, Kunden, Termine, Auftr\xE4ge und offene Posten ab, erstelle Angebote, Rechnungen, Abschlags- und Schlussrechnungen, Stundenzettel und Auftr\xE4ge, lade Dateien hoch und hole PDF-Links \u2014 alles im Gespr\xE4ch. 34 Tools (Lesen \xB7 Erstellen \xB7 Upload \xB7 Download), kein Bearbeiten oder L\xF6schen: nichts kann kaputtgehen. Einstieg: \u201Ewas ist heute los?" (dashboard) oder \u201Ewer schuldet uns noch was?" (list_open_invoices). Zeitangaben immer als ISO MIT Offset, Datumsangaben als 'YYYY-MM-DD'.`,
  tools,
  async validate({ apiKey }) {
    const who = await new Hero(apiKey).whoami();
    return { account: who.company, user: who.user };
  },
  async context({ apiKey }, kv) {
    const hero = new Hero(apiKey);
    return { hero, cfg: await getConfig(kv, hero, apiKey), kv };
  }
};
var index_default = createWorker(config);
export {
  index_default as default
};
