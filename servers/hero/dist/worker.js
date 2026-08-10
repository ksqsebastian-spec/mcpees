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

// shared/src/icons.generated.ts
var HERO_ICON = {
  png512: "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",
  png180: "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",
  ico: "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"
};

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
    icon: HERO_ICON,
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
