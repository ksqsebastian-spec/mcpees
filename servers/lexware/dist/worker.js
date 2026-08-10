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
var LEXWARE_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g fill="#ff4554"><polygon points="11.1 8.8 8.7 11.8 10.7 14.3 12 14.3 13.8 14.3 15.5 14.3 11.1 8.8"/><polygon points="15.4 1.7 13.8 1.7 12 1.7 10.7 1.7 8.7 4.2 11.1 7.2 15.5 1.7 15.4 1.7"/><polygon points="7.8 4.8 5.3 1.7 .5 1.7 3 4.8 5.6 8 3 11.2 .5 14.3 5.2 14.3 5.3 14.3 7.8 11.2 10.4 8 7.8 4.8"/></g></svg>',
  bg: "#ffffff",
  border: true,
  accent: "#FF4554",
  fill: 0.64
};
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

// servers/lexware/src/client.ts
var LEXWARE_BASE = "https://api.lexware.io";
var MIN_INTERVAL_MS = 550;
var MAX_RETRIES = 3;
var LexwareError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "LexwareError";
  }
};
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
var Lexware = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  calls = 0;
  async throttle() {
    const slot = slotFor(this.apiKey);
    const now = Date.now();
    const wait = Math.max(0, slot.nextAt - now);
    slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  /** Ein Request gegen die Lexware-API, eingereiht und ratenbegrenzt. */
  request(path, opts = {}) {
    const run = async () => {
      const url = new URL(path.startsWith("/") ? path : `/${path}`, LEXWARE_BASE);
      for (const [k, v] of Object.entries(opts.query ?? {})) {
        if (v !== void 0 && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: opts.accept ?? "application/json"
      };
      let body;
      if (opts.form) {
        body = opts.form;
      } else if (opts.body !== void 0) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
      for (let attempt = 0; ; attempt++) {
        await this.throttle();
        this.calls++;
        const res = await fetch(url.toString(), { method: opts.method ?? "GET", headers, body });
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1e3 : 1e3 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return res;
      }
    };
    const slot = slotFor(this.apiKey);
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => void 0);
    return queued;
  }
  /** Request + JSON-Antwort, mit lesbaren Fehlern statt roher Statuscodes. */
  async json(path, opts = {}) {
    const res = await this.request(path, opts);
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
      }
      throw new LexwareError(explain(res.status, path), detail);
    }
    if (!text) return void 0;
    try {
      return JSON.parse(text);
    } catch {
      throw new LexwareError(`Lexware lieferte kein JSON f\xFCr ${path}`, text.slice(0, 300));
    }
  }
  /**
   * Alle Seiten einer Liste holen. Seiten sind nullbasiert.
   *
   * `maxItems` begrenzt bewusst und sichtbar: das Ergebnis sagt, ob abgeschnitten wurde.
   * Ohne diese Grenze kann ein einziger Aufruf hunderte Requests auslösen — bei 2 req/s
   * wären das Minuten, und der MCP-Client läuft in seinen Timeout.
   */
  async paginate(path, query, maxItems = 500) {
    const size = Math.min(250, Math.max(1, maxItems));
    const items = [];
    let total = null;
    let pages = 0;
    for (let page2 = 0; ; page2++) {
      const data = await this.json(path, { query: { ...query, page: page2, size } });
      pages++;
      const content = data.content ?? [];
      items.push(...content);
      if (typeof data.totalElements === "number") total = data.totalElements;
      if (items.length >= maxItems) return { items: items.slice(0, maxItems), total, truncated: true, pages };
      if (data.last === true) break;
      if (typeof data.totalPages === "number" && page2 + 1 >= data.totalPages) break;
      if (content.length === 0) break;
      if (page2 > 40) return { items, total, truncated: true, pages };
    }
    return { items, total, truncated: false, pages };
  }
  /** Prüft den Key und liefert den Firmennamen zurück. */
  async whoami() {
    const p = await this.json("/v1/profile");
    return {
      company: p?.companyName ?? p?.organizationId ?? "unbekannt",
      user: p?.userName ?? p?.userEmail ?? "unbekannt"
    };
  }
};
function explain(status, path) {
  switch (status) {
    case 401:
      return "Lexware lehnt den API-Key ab (401). Der Key ist ung\xFCltig oder wurde widerrufen.";
    case 402:
      return "Lexware verweigert den Zugriff (402). Die Public API setzt Lexware Office XL voraus \u2014 in kleineren Tarifen ist sie nicht freigeschaltet.";
    case 403:
      return `Keine Berechtigung f\xFCr ${path} (403).`;
    case 404:
      return `Nicht gefunden: ${path} (404).`;
    case 406:
      return `Lexware akzeptiert das angefragte Format f\xFCr ${path} nicht (406).`;
    case 429:
      return "Lexware drosselt (429). Das Limit sind 2 Requests pro Sekunde \u2014 auch nach mehreren Wiederholungen noch belegt. Kleineren Zeitraum oder kleineres Limit w\xE4hlen.";
    case 409:
      return `Konflikt bei ${path} (409). Lexware nutzt optimistisches Sperren \xFCber das Feld version; der Datensatz wurde zwischenzeitlich ge\xE4ndert.`;
    default:
      return `Lexware HTTP ${status} bei ${path}.`;
  }
}

// servers/lexware/src/files.ts
var MAX_MINUTES = 60 * 24;
async function createFileLink(kv, credential, file, minutes) {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("hmcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credential }),
      fileId: file.id,
      filename: file.filename,
      contentType: file.contentType
    }),
    { expirationTtl: ttl * 60 }
  );
  return { token, expiresInMinutes: ttl };
}
async function serveFile(request, url, env) {
  const match = /^\/f\/([A-Za-z0-9_\-]+)$/.exec(url.pathname);
  if (!match || request.method !== "GET") return null;
  const token = match[1];
  const rec = await env.OAUTH_KV.get(`dl:${await sha256hex(token)}`, "json");
  if (!rec) {
    return new Response("Dieser Link ist abgelaufen oder ung\xFCltig.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  let credential;
  try {
    ({ credential } = await openJSON(token, rec.sealed));
  } catch {
    return new Response("Link ung\xFCltig.", { status: 404 });
  }
  const res = await new Lexware(credential).request(`/v1/files/${rec.fileId}`, {
    accept: rec.contentType || "application/pdf",
    raw: true
  });
  if (!res.ok) {
    return new Response(`Lexware liefert die Datei nicht aus (HTTP ${res.status}).`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? rec.contentType ?? "application/pdf",
      "content-disposition": `inline; filename="${rec.filename.replace(/["\\]/g, "")}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
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

// servers/lexware/src/tools/read.ts
var VOUCHER_STATUS = {
  invoice: ["draft", "open", "paid", "voided"],
  downpaymentinvoice: ["draft", "open", "paid", "voided"],
  quotation: ["draft", "open", "accepted", "rejected"],
  orderconfirmation: ["draft", "open"],
  creditnote: ["draft", "open", "paidoff", "voided"],
  deliverynote: ["draft", "open"],
  dunning: ["draft", "open"],
  invoicecorrection: ["draft", "open", "paidoff", "voided"]
};
var DEFAULT_STATUS = {
  invoice: ["open", "paid"],
  downpaymentinvoice: ["open", "paid"],
  quotation: ["draft", "open", "accepted", "rejected"],
  orderconfirmation: ["open"],
  creditnote: ["open", "paidoff"],
  deliverynote: ["open"],
  dunning: ["open"]
};
var VOUCHER_TYPES = Object.keys(VOUCHER_STATUS);
var DOC_PATHS = {
  invoice: "invoices",
  quotation: "quotations",
  orderconfirmation: "order-confirmations",
  creditnote: "credit-notes",
  deliverynote: "delivery-notes",
  dunning: "dunnings",
  downpaymentinvoice: "down-payment-invoices"
};
function checkStatus(voucherType, status) {
  const allowed = VOUCHER_STATUS[voucherType];
  if (!allowed) {
    throw new LexwareError(
      `voucherType '${voucherType}' unbekannt. Erlaubt: ${VOUCHER_TYPES.join(", ")}`
    );
  }
  if (!status) return (DEFAULT_STATUS[voucherType] ?? allowed).join(",");
  const wanted = String(status).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const w of wanted) {
    if (!allowed.includes(w)) {
      throw new LexwareError(
        `voucherStatus '${w}' gibt es f\xFCr ${voucherType} nicht. Erlaubt: ${allowed.join(", ")}. Lexware meldet einen falschen Status nicht, es kommt einfach eine leere Liste zur\xFCck.`
      );
    }
  }
  return wanted.join(",");
}
function docPath(docType) {
  const p = DOC_PATHS[String(docType).toLowerCase()];
  if (!p) {
    throw new LexwareError(
      `doc_type '${docType}' unbekannt. Erlaubt: ${Object.keys(DOC_PATHS).join(", ")}`
    );
  }
  return p;
}
var money = (n) => typeof n === "number" ? Math.round(n * 100) / 100 : null;
var sum = (rows, field) => Math.round(rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) * 100) / 100;
function row(v) {
  return {
    id: v.id,
    typ: v.voucherType,
    nr: v.voucherNumber ?? null,
    status: v.voucherStatus,
    datum: v.voucherDate ?? null,
    faellig_am: v.dueDate ?? null,
    kunde: v.contactName ?? null,
    contactId: v.contactId ?? null,
    betrag_brutto: money(v.totalAmount),
    offen: money(v.openAmount),
    waehrung: v.currency ?? null,
    archiviert: v.archived ?? null
  };
}
function date(value, name) {
  if (value === void 0 || value === null || value === "") return void 0;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new LexwareError(`${name} muss 'YYYY-MM-DD' sein.`);
  return s;
}
var readTools = [
  {
    name: "profile",
    title: "Firmenprofil",
    description: "Firmenprofil des verbundenen Lexware-Office-Accounts: Firmenname, Steuernummern, Kleinunternehmer-Status, angemeldeter Nutzer. Guter erster Aufruf, um zu sehen, mit welchem Mandanten man spricht.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      return ctx.lex.json("/v1/profile");
    }
  },
  {
    name: "search_contacts",
    title: "Kontakte suchen",
    description: "Kontakte suchen oder auflisten. Filter lassen sich kombinieren; ohne Filter kommen die ersten Kontakte. customer/vendor grenzen auf Kunden bzw. Lieferanten ein.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name oder Firmenname, auch Teilstring."),
        email: str("E-Mail-Adresse."),
        number: int("Kunden- oder Lieferantennummer."),
        customer: bool("Nur Kunden."),
        vendor: bool("Nur Lieferanten."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = Math.min(500, Math.max(1, Number(args.limit) || 50));
      const res = await ctx.lex.paginate(
        "/v1/contacts",
        {
          name: args.name,
          email: args.email,
          number: args.number,
          customer: args.customer,
          vendor: args.vendor
        },
        limit
      );
      return {
        anzahl: res.items.length,
        gesamt: res.total,
        abgeschnitten: res.truncated,
        kontakte: res.items.map((c) => ({
          id: c.id,
          nummer: c.roles?.customer?.number ?? c.roles?.vendor?.number ?? null,
          name: c.company?.name ?? [c.person?.firstName, c.person?.lastName].filter(Boolean).join(" "),
          typ: c.company ? "Firma" : "Person",
          rollen: Object.keys(c.roles ?? {}),
          email: c.emailAddresses?.business?.[0] ?? c.emailAddresses?.private?.[0] ?? null,
          telefon: c.phoneNumbers?.business?.[0] ?? c.phoneNumbers?.mobile?.[0] ?? null,
          version: c.version
        }))
      };
    }
  },
  {
    name: "get_contact",
    title: "Kontakt im Detail",
    description: "Ein Kontakt mit allen Adressen, Rollen und Bankdaten. Das Feld version braucht man, falls der Kontakt sp\xE4ter ge\xE4ndert werden soll (Lexware sperrt optimistisch).",
    inputSchema: {
      type: "object",
      properties: { contact_id: str("Die Kontakt-UUID aus search_contacts.") },
      required: ["contact_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      return ctx.lex.json(`/v1/contacts/${encodeURIComponent(req(args, "contact_id"))}`);
    }
  },
  {
    name: "list_vouchers",
    title: "Belege auflisten",
    description: "Der Arbeitspferd-Aufruf f\xFCr alles Kaufm\xE4nnische: listet Rechnungen, Angebote, Auftragsbest\xE4tigungen, Gutschriften, Lieferscheine und Mahnungen als \xDCbersichtszeilen. Rechnungen haben KEINE eigene Listen-Route \u2014 sie laufen \xFCber diesen Aufruf. Ohne voucher_status wird ein sinnvoller Default gew\xE4hlt (bei Rechnungen open,paid \u2014 Entw\xFCrfe und Stornos z\xE4hlen nicht als Umsatz).",
    inputSchema: {
      type: "object",
      properties: {
        voucher_type: str(`Belegart \u2014 eine aus: ${VOUCHER_TYPES.join(", ")}`),
        voucher_status: str(
          "Komma-Liste von Statuswerten. Erlaubte Werte h\xE4ngen von der Belegart ab; ein ung\xFCltiger Wert wird abgelehnt statt still ignoriert."
        ),
        date_from: str("Belegdatum ab 'YYYY-MM-DD'."),
        date_to: str("Belegdatum bis 'YYYY-MM-DD'."),
        contact_id: str("Nur Belege zu diesem Kontakt."),
        voucher_number: str("Nach Belegnummer suchen."),
        archived: bool("true = nur archivierte, false = nur nicht archivierte."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 100). Bei 2 Requests/Sekunde kosten gro\xDFe Werte Zeit.")
      },
      required: ["voucher_type"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const type = String(req(args, "voucher_type")).toLowerCase();
      const status = checkStatus(type, args.voucher_status);
      const limit = Math.min(500, Math.max(1, Number(args.limit) || 100));
      const res = await ctx.lex.paginate(
        "/v1/voucherlist",
        {
          voucherType: type,
          voucherStatus: status,
          voucherDateFrom: date(args.date_from, "date_from"),
          voucherDateTo: date(args.date_to, "date_to"),
          contactId: args.contact_id,
          voucherNumber: args.voucher_number,
          archived: args.archived,
          sort: "voucherDate,DESC"
        },
        limit
      );
      return {
        voucher_type: type,
        voucher_status: status,
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...res.truncated ? { hinweis: `Es gibt mehr Treffer als ${limit}. Zeitraum eingrenzen oder limit erh\xF6hen.` } : {},
        summe_brutto: sum(res.items, "totalAmount"),
        summe_offen: sum(res.items, "openAmount"),
        belege: res.items.map(row)
      };
    }
  },
  {
    name: "get_document",
    title: "Beleg im Detail",
    description: "Ein Beleg mit allen Positionen, Steuerangaben und Betr\xE4gen. Nur hier stehen Netto-Betr\xE4ge \u2014 die \xDCbersichtszeilen aus list_vouchers haben nur Bruttowerte.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart \u2014 eine aus: ${Object.keys(DOC_PATHS).join(", ")}`),
        document_id: str("Die Beleg-UUID aus list_vouchers.")
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const p = docPath(req(args, "doc_type"));
      return ctx.lex.json(`/v1/${p}/${encodeURIComponent(req(args, "document_id"))}`);
    }
  },
  {
    name: "download_document",
    title: "Beleg als PDF",
    description: "Erzeugt einen zeitlich begrenzten Download-Link auf das PDF eines Belegs. Lexware selbst kennt keine \xF6ffentlichen Links, deshalb liefert dieser Server die Datei \xFCber einen eigenen, nicht erratbaren Link aus. Funktioniert nur bei finalisierten Belegen \u2014 Entw\xFCrfe haben kein PDF.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart \u2014 eine aus: ${Object.keys(DOC_PATHS).join(", ")}`),
        document_id: str("Die Beleg-UUID."),
        minutes: int("G\xFCltigkeit des Links in Minuten (1\u20131440, Default 30).")
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const type = String(req(args, "doc_type")).toLowerCase();
      const p = docPath(type);
      const id = req(args, "document_id");
      const file = await ctx.lex.json(`/v1/${p}/${encodeURIComponent(id)}/file`);
      const fileId = file?.documentFileId ?? file?.id;
      if (!fileId) {
        throw new LexwareError(
          `F\xFCr diesen Beleg gibt es kein PDF. Entw\xFCrfe werden erst beim Finalisieren gerendert.`,
          file
        );
      }
      const link = await createFileLink(
        ctx.kv,
        ctx.credential,
        { id: fileId, filename: `${type}-${id}.pdf`, contentType: "application/pdf" },
        Number(args.minutes) || 30
      );
      return {
        url: `${ctx.origin}/f/${link.token}`,
        gueltig_bis_minuten: link.expiresInMinutes,
        hinweis: "Der Link ist ein Geheimnis \u2014 wer ihn hat, sieht das PDF."
      };
    }
  },
  {
    name: "list_articles",
    title: "Artikel",
    description: "Artikel- und Leistungsstamm mit Preisen und Einheiten.",
    inputSchema: {
      type: "object",
      properties: { limit: int("Maximale Trefferzahl (1\u2013500, Default 50).") },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const res = await ctx.lex.paginate(
        "/v1/articles",
        {},
        Math.min(500, Math.max(1, Number(args.limit) || 50))
      );
      return {
        anzahl: res.items.length,
        gesamt: res.total,
        abgeschnitten: res.truncated,
        artikel: res.items.map((a) => ({
          id: a.id,
          nummer: a.articleNumber ?? null,
          titel: a.title,
          typ: a.type,
          einheit: a.unitName,
          netto: money(a.price?.netPrice),
          brutto: money(a.price?.grossPrice),
          steuersatz: a.price?.taxRate ?? null,
          version: a.version
        }))
      };
    }
  },
  {
    name: "get_payments",
    title: "Zahlungen zu einem Beleg",
    description: "Zahlungsinformationen zu einer Rechnung oder einem Beleg: offener Betrag, Zahlungsstatus und erfasste Zahlungen.",
    inputSchema: {
      type: "object",
      properties: { voucher_id: str("Die Beleg-UUID.") },
      required: ["voucher_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      return ctx.lex.json(`/v1/payments/${encodeURIComponent(req(args, "voucher_id"))}`);
    }
  },
  {
    name: "open_items",
    title: "Offene Posten",
    description: "Debitoren-Offene-Posten: welche Rechnungen sind noch nicht bezahlt, wer h\xE4ngt wie weit hinterher. Rechnet aus der Belegliste und sortiert nach \xDCberf\xE4lligkeit. Hinweis: Rechnungen mit \xFCberschrittener F\xE4lligkeit meldet Lexware als 'overdue' \u2014 sie z\xE4hlen hier als offen.",
    inputSchema: {
      type: "object",
      properties: {
        overdue_only: bool("Nur \xFCberf\xE4llige Rechnungen. Default false."),
        limit: int("Maximal zu pr\xFCfende Rechnungen (1\u2013500, Default 250).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const res = await ctx.lex.paginate(
        "/v1/voucherlist",
        { voucherType: "invoice", voucherStatus: "open", sort: "dueDate,ASC" },
        Math.min(500, Math.max(1, Number(args.limit) || 250))
      );
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const posten = res.items.map((v) => {
        const faellig = v.dueDate ? String(v.dueDate).slice(0, 10) : null;
        const tage = faellig ? Math.floor((Date.parse(today) - Date.parse(faellig)) / 864e5) : null;
        return { ...row(v), tage_ueberfaellig: tage };
      }).filter((p) => (p.offen ?? 0) > 5e-3).filter((p) => !args.overdue_only || (p.tage_ueberfaellig ?? -1) > 0).sort((a, b) => (b.tage_ueberfaellig ?? -1e9) - (a.tage_ueberfaellig ?? -1e9));
      return {
        anzahl: posten.length,
        summe_offen: sum(posten, "offen"),
        davon_ueberfaellig: posten.filter((p) => (p.tage_ueberfaellig ?? -1) > 0).length,
        abgeschnitten: res.truncated,
        posten
      };
    }
  },
  {
    name: "revenue",
    title: "Umsatz im Zeitraum",
    description: "Umsatz \xFCber einen Zeitraum, aus der Belegliste gerechnet. basis='gestellt' z\xE4hlt alle gestellten Rechnungen (open,paid \u2014 periodengerecht), basis='bezahlt' nur die bezahlten (Zufluss). Entw\xFCrfe und Stornos z\xE4hlen nie mit. Die Betr\xE4ge sind BRUTTO \u2014 die Belegliste f\xFChrt keine Nettowerte; f\xFCr Netto die Belege einzeln \xFCber get_document holen.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: str("Von 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        basis: str("'gestellt' (Default) oder 'bezahlt'."),
        limit: int("Maximal zu ber\xFCcksichtigende Rechnungen (1\u2013500, Default 500).")
      },
      required: ["date_from", "date_to"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const basis = String(args.basis ?? "gestellt").toLowerCase();
      if (!["gestellt", "bezahlt"].includes(basis)) {
        throw new LexwareError("basis muss 'gestellt' oder 'bezahlt' sein.");
      }
      const status = basis === "bezahlt" ? "paid" : "open,paid";
      const res = await ctx.lex.paginate(
        "/v1/voucherlist",
        {
          voucherType: "invoice",
          voucherStatus: status,
          voucherDateFrom: date(args.date_from, "date_from"),
          voucherDateTo: date(args.date_to, "date_to"),
          sort: "voucherDate,ASC"
        },
        Math.min(500, Math.max(1, Number(args.limit) || 500))
      );
      const proMonat = {};
      for (const v of res.items) {
        const m = String(v.voucherDate ?? "").slice(0, 7);
        if (m) proMonat[m] = Math.round(((proMonat[m] ?? 0) + (Number(v.totalAmount) || 0)) * 100) / 100;
      }
      return {
        zeitraum: { von: args.date_from, bis: args.date_to },
        basis,
        beruecksichtigte_status: status,
        anzahl_rechnungen: res.items.length,
        summe_brutto: sum(res.items, "totalAmount"),
        noch_offen: sum(res.items, "openAmount"),
        pro_monat: proMonat,
        abgeschnitten: res.truncated,
        ...res.truncated ? { warnung: "Nicht alle Rechnungen im Zeitraum wurden geladen \u2014 die Summe ist unvollst\xE4ndig. Zeitraum verkleinern." } : {},
        hinweis: "Betr\xE4ge sind brutto. Die Lexware-Belegliste liefert keine Nettowerte."
      };
    }
  },
  {
    name: "reference_data",
    title: "Stammdaten",
    description: "Nachschlagelisten von Lexware: Buchungskategorien (f\xFCr create_voucher n\xF6tig), Zahlungsbedingungen, L\xE4nder, Drucklayouts und wiederkehrende Rechnungen.",
    inputSchema: {
      type: "object",
      properties: {
        kind: str(
          "Eine aus: posting-categories, payment-conditions, countries, print-layouts, recurring-templates"
        )
      },
      required: ["kind"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const kind = String(req(args, "kind")).toLowerCase();
      const simple = {
        "posting-categories": "/v1/posting-categories",
        "payment-conditions": "/v1/payment-conditions",
        countries: "/v1/countries",
        "print-layouts": "/v1/print-layouts"
      };
      if (simple[kind]) return { kind, daten: await ctx.lex.json(simple[kind]) };
      if (kind === "recurring-templates") {
        const res = await ctx.lex.paginate("/v1/recurring-templates", {}, 100);
        return { kind, anzahl: res.items.length, abgeschnitten: res.truncated, daten: res.items };
      }
      throw new LexwareError(
        `kind '${kind}' unbekannt. Erlaubt: ${[...Object.keys(simple), "recurring-templates"].join(", ")}`
      );
    }
  }
];

// servers/lexware/src/tools/write.ts
var TAX_TYPES = ["net", "gross", "vatfree"];
var LINE_TYPES = ["custom", "material", "service", "text"];
var CREATABLE = {
  invoice: "invoices",
  quotation: "quotations",
  orderconfirmation: "order-confirmations",
  creditnote: "credit-notes",
  deliverynote: "delivery-notes"
};
var LINE_ITEMS_SCHEMA = {
  type: "array",
  description: "Die Positionen des Belegs, in Reihenfolge.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Bezeichnung der Position." },
      quantity: { type: "number", description: "Menge." },
      unit_name: { type: "string", description: "Einheit, z. B. 'St\xFCck' oder 'Stunde'." },
      net_price: { type: "number", description: "Netto-Einzelpreis." },
      tax_rate: { type: "number", description: "Steuersatz in Prozent, z. B. 19. Default 19." },
      description: { type: "string", description: "Optionaler Langtext." },
      type: { type: "string", description: `Positionsart: ${LINE_TYPES.join(", ")}. Default custom.` }
    },
    required: ["name", "quantity", "unit_name", "net_price"],
    additionalProperties: false
  }
};
function buildLineItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new LexwareError("line_items darf nicht leer sein.");
  }
  return items.map((li, i) => {
    const at = (msg) => new LexwareError(`Position ${i + 1}: ${msg}`);
    if (!li?.name) throw at("'name' fehlt.");
    const type = li.type ?? "custom";
    if (!LINE_TYPES.includes(type)) throw at(`type '${type}' ung\xFCltig. Erlaubt: ${LINE_TYPES.join(", ")}`);
    if (type === "text") return { type: "text", name: li.name, description: li.description ?? "" };
    if (typeof li.quantity !== "number") throw at("'quantity' muss eine Zahl sein.");
    if (typeof li.net_price !== "number") throw at("'net_price' muss eine Zahl sein.");
    if (!li.unit_name) throw at("'unit_name' fehlt.");
    return {
      type,
      name: li.name,
      description: li.description ?? "",
      quantity: li.quantity,
      unitName: li.unit_name,
      unitPrice: {
        currency: "EUR",
        netAmount: li.net_price,
        taxRatePercentage: li.tax_rate ?? 19
      }
    };
  });
}
function taxType(value) {
  const t = String(value ?? "net").toLowerCase();
  if (!TAX_TYPES.includes(t)) {
    throw new LexwareError(`tax_type '${t}' ung\xFCltig. Erlaubt: ${TAX_TYPES.join(", ")}`);
  }
  return t;
}
function isoDate(value, name, fallbackToday = false) {
  if (!value) {
    if (fallbackToday) return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    throw new LexwareError(`${name} fehlt.`);
  }
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new LexwareError(`${name} muss 'YYYY-MM-DD' sein.`);
  return s;
}
var writeTools = [
  {
    name: "create_contact",
    title: "Kontakt anlegen",
    description: "Kontakt anlegen \u2014 entweder als Firma (company_name) oder als Person (last_name). Mindestens eine Rolle ist Pflicht: Kunde und/oder Lieferant. Lexware dedupliziert NICHT: derselbe Aufruf zweimal erzeugt zwei Kontakte.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: str("Firmenname. Entweder dieser oder last_name ist Pflicht."),
        first_name: str("Vorname (bei Personen)."),
        last_name: str("Nachname. Pflicht, wenn kein Firmenname gesetzt ist."),
        salutation: str("Anrede, z. B. 'Herr' oder 'Frau'."),
        email: str("Gesch\xE4ftliche E-Mail."),
        phone: str("Gesch\xE4ftliche Telefonnummer."),
        street: str("Stra\xDFe und Hausnummer."),
        zip: str("PLZ."),
        city: str("Ort."),
        country_code: str("L\xE4ndercode nach ISO-3166-1 alpha-2, Default DE."),
        is_customer: bool("Als Kunde anlegen. Default true."),
        is_vendor: bool("Als Lieferant anlegen. Default false."),
        note: str("Notiz zum Kontakt.")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const isVendor = args.is_vendor === true;
      const isCustomer = args.is_customer !== false || !isVendor;
      if (!args.company_name && !args.last_name) {
        throw new LexwareError(
          "Entweder company_name (Firma) oder last_name (Person) angeben \u2014 Lexware lehnt einen Kontakt ohne beides ab."
        );
      }
      const roles = {};
      if (isCustomer) roles.customer = {};
      if (isVendor) roles.vendor = {};
      const body = { version: 0, roles };
      if (args.company_name) {
        body.company = {
          name: args.company_name,
          ...args.last_name ? {
            contactPersons: [
              {
                salutation: args.salutation ?? "",
                firstName: args.first_name ?? "",
                lastName: args.last_name,
                primary: true,
                emailAddress: args.email ?? "",
                phoneNumber: args.phone ?? ""
              }
            ]
          } : {}
        };
      } else {
        body.person = {
          salutation: args.salutation ?? "",
          firstName: args.first_name ?? "",
          lastName: args.last_name
        };
      }
      if (args.street || args.zip || args.city) {
        body.addresses = {
          billing: [
            {
              street: args.street ?? "",
              zip: args.zip ?? "",
              city: args.city ?? "",
              countryCode: args.country_code ?? "DE"
            }
          ]
        };
      }
      if (args.email) body.emailAddresses = { business: [args.email] };
      if (args.phone) body.phoneNumbers = { business: [args.phone] };
      if (args.note) body.note = args.note;
      const created = await ctx.lex.json("/v1/contacts", { method: "POST", body });
      const full = await ctx.lex.json(`/v1/contacts/${created.id}`);
      return {
        id: created.id,
        version: full.version,
        name: full.company?.name ?? [full.person?.firstName, full.person?.lastName].filter(Boolean).join(" "),
        nummer: full.roles?.customer?.number ?? full.roles?.vendor?.number ?? null,
        rollen: Object.keys(full.roles ?? {})
      };
    }
  },
  {
    name: "create_article",
    title: "Artikel anlegen",
    description: "Artikel oder Leistung in den Stamm aufnehmen. leading_price bestimmt, ob der Netto- oder der Bruttopreis f\xFChrend ist; den jeweils anderen rechnet Lexware aus.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("Bezeichnung."),
        type: str("PRODUCT (Ware) oder SERVICE (Leistung). Default SERVICE."),
        unit_name: str("Einheit, z. B. 'St\xFCck' oder 'Stunde'."),
        net_price: num("Nettopreis."),
        tax_rate: num("Steuersatz in Prozent, Default 19."),
        description: str("Beschreibung."),
        article_number: str("Eigene Artikelnummer.")
      },
      required: ["title", "unit_name", "net_price"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = String(args.type ?? "SERVICE").toUpperCase();
      if (!["PRODUCT", "SERVICE"].includes(type)) {
        throw new LexwareError("type muss PRODUCT oder SERVICE sein.");
      }
      const net = req(args, "net_price");
      const rate = args.tax_rate ?? 19;
      const body = {
        title: req(args, "title"),
        type,
        unitName: req(args, "unit_name"),
        price: {
          netPrice: net,
          grossPrice: Math.round(net * (1 + rate / 100) * 100) / 100,
          leadingPrice: "NET",
          taxRate: rate
        }
      };
      if (args.description) body.description = args.description;
      if (args.article_number) body.articleNumber = args.article_number;
      const created = await ctx.lex.json("/v1/articles", { method: "POST", body });
      return { id: created.id, version: created.version, ...body };
    }
  },
  {
    name: "create_document",
    title: "Beleg anlegen",
    description: "Rechnung, Angebot, Auftragsbest\xE4tigung, Gutschrift oder Lieferschein anlegen. \u26A0 finalize=true macht den Beleg verbindlich, vergibt die Belegnummer und erzeugt das PDF \u2014 das l\xE4sst sich nicht zur\xFCcknehmen. Ohne finalize entsteht ein Entwurf, den man in Lexware Office noch bearbeiten kann; ein Entwurf hat aber kein PDF.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart \u2014 eine aus: ${Object.keys(CREATABLE).join(", ")}`),
        contact_id: str("Kontakt-UUID des Empf\xE4ngers aus search_contacts."),
        line_items: LINE_ITEMS_SCHEMA,
        voucher_date: str("Belegdatum 'YYYY-MM-DD'. Default heute."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        finalize: bool("true = verbindlich finalisieren. Default false (Entwurf)."),
        title: str("Titel des Belegs, z. B. 'Rechnung'."),
        intro: str("Einleitungstext."),
        remark: str("Schlussbemerkung."),
        payment_term_days: int("Zahlungsziel in Tagen (nur bei Rechnungen sinnvoll).")
      },
      required: ["doc_type", "contact_id", "line_items"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const type = String(req(args, "doc_type")).toLowerCase();
      const path = CREATABLE[type];
      if (!path) {
        throw new LexwareError(
          `doc_type '${type}' kann dieser Server nicht anlegen. M\xF6glich: ${Object.keys(CREATABLE).join(", ")}. Mahnungen laufen \xFCber create_dunning.`
        );
      }
      const body = {
        voucherDate: isoDate(args.voucher_date, "voucher_date", true),
        address: { contactId: req(args, "contact_id") },
        lineItems: buildLineItems(req(args, "line_items")),
        totalPrice: { currency: "EUR" },
        taxConditions: { taxType: taxType(args.tax_type) }
      };
      if (args.title) body.title = args.title;
      if (args.intro) body.introduction = args.intro;
      if (args.remark) body.remark = args.remark;
      if (args.payment_term_days) {
        body.paymentConditions = { paymentTermLabel: `Zahlbar innerhalb ${args.payment_term_days} Tagen`, paymentTermDuration: args.payment_term_days };
      }
      const finalize = args.finalize === true;
      const created = await ctx.lex.json(`/v1/${path}`, {
        method: "POST",
        query: { finalize },
        body
      });
      const full = await ctx.lex.json(`/v1/${docPath(type)}/${created.id}`).catch(() => null);
      return {
        id: created.id,
        doc_type: type,
        finalisiert: finalize,
        nr: full?.voucherNumber ?? null,
        status: full?.voucherStatus ?? null,
        summe_netto: full?.totalPrice?.totalNetAmount ?? null,
        summe_brutto: full?.totalPrice?.totalGrossAmount ?? null,
        hinweis: finalize ? "PDF \xFCber download_document abrufbar." : "Entwurf \u2014 noch keine Belegnummer und kein PDF. Zum Finalisieren in Lexware Office \xF6ffnen oder erneut mit finalize=true anlegen."
      };
    }
  },
  {
    name: "create_dunning",
    title: "Mahnung anlegen",
    description: "Mahnung zu einer bestehenden Rechnung anlegen. Die Rechnung ist Pflicht \u2014 eine Mahnung ohne Bezugsrechnung lehnt Lexware ab. Hinweis: Lexware meldet f\xFCr Mahnungen auch bei finalize=true den Status 'draft' zur\xFCck, erzeugt das PDF aber trotzdem sofort.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: str("UUID der zu mahnenden Rechnung."),
        contact_id: str("Kontakt-UUID des Empf\xE4ngers."),
        line_items: LINE_ITEMS_SCHEMA,
        voucher_date: str("Belegdatum 'YYYY-MM-DD'. Default heute."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        finalize: bool("true = finalisieren. Default true."),
        title: str("Titel, z. B. 'Zahlungserinnerung'."),
        intro: str("Einleitungstext.")
      },
      required: ["invoice_id", "contact_id", "line_items"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const body = {
        voucherDate: isoDate(args.voucher_date, "voucher_date", true),
        address: { contactId: req(args, "contact_id") },
        lineItems: buildLineItems(req(args, "line_items")),
        totalPrice: { currency: "EUR" },
        taxConditions: { taxType: taxType(args.tax_type) }
      };
      if (args.title) body.title = args.title;
      if (args.intro) body.introduction = args.intro;
      const created = await ctx.lex.json("/v1/dunnings", {
        method: "POST",
        query: {
          precedingSalesVoucherId: req(args, "invoice_id"),
          finalize: args.finalize !== false
        },
        body
      });
      return {
        id: created.id,
        hinweis: "Lexware kennt keine Liste f\xFCr Mahnungen. Die id hier aufheben \u2014 sie ist sonst nur \xFCber die relatedVouchers der Rechnung wiederzufinden. PDF \xFCber download_document mit doc_type=dunning."
      };
    }
  },
  {
    name: "create_voucher",
    title: "Buchungsbeleg anlegen",
    description: "Buchungsbeleg (z. B. Eingangsrechnung) f\xFCr die Buchhaltung anlegen. Jede Position braucht eine categoryId aus reference_data(kind='posting-categories') \u2014 ohne die lehnt Lexware ab.",
    inputSchema: {
      type: "object",
      properties: {
        type: str("Belegart, z. B. purchaseinvoice (Eingangsrechnung) oder salesinvoice."),
        voucher_date: str("Belegdatum 'YYYY-MM-DD'."),
        total_gross: num("Bruttosumme."),
        total_tax: num("Steuersumme."),
        tax_type: str(`Steuerart: ${TAX_TYPES.join(", ")}. Default net.`),
        items: {
          type: "array",
          description: "Belegpositionen.",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Nettobetrag der Position." },
              tax_amount: { type: "number", description: "Steuerbetrag der Position." },
              tax_rate: { type: "number", description: "Steuersatz in Prozent." },
              category_id: { type: "string", description: "UUID aus posting-categories." }
            },
            required: ["amount", "tax_amount", "tax_rate", "category_id"],
            additionalProperties: false
          }
        },
        voucher_number: str("Belegnummer des Lieferanten."),
        contact_id: str("Kontakt-UUID des Lieferanten.")
      },
      required: ["type", "voucher_date", "total_gross", "total_tax", "items"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    async handler(args, ctx) {
      const items = req(args, "items");
      if (!Array.isArray(items) || !items.length) throw new LexwareError("items darf nicht leer sein.");
      const body = {
        type: req(args, "type"),
        voucherDate: isoDate(args.voucher_date, "voucher_date"),
        totalGrossAmount: req(args, "total_gross"),
        totalTaxAmount: req(args, "total_tax"),
        taxType: taxType(args.tax_type),
        voucherItems: items.map((it, i) => {
          if (!it?.category_id) {
            throw new LexwareError(
              `Position ${i + 1}: category_id fehlt. G\xFCltige Werte liefert reference_data(kind='posting-categories').`
            );
          }
          return {
            amount: it.amount,
            taxAmount: it.tax_amount,
            taxRatePercent: it.tax_rate,
            categoryId: it.category_id
          };
        })
      };
      if (args.voucher_number) body.voucherNumber = args.voucher_number;
      if (args.contact_id) body.contactId = args.contact_id;
      const created = await ctx.lex.json("/v1/vouchers", { method: "POST", body });
      return { id: created.id, version: created.version, typ: body.type };
    }
  },
  {
    name: "upload_file",
    title: "Datei hochladen",
    description: "Datei nach Lexware hochladen (z. B. einen Beleg als PDF oder Foto) und optional direkt an einen Buchungsbeleg h\xE4ngen. Inhalt entweder als url (wird geladen) oder als content_base64.",
    inputSchema: {
      type: "object",
      properties: {
        filename: str("Dateiname inklusive Endung."),
        url: str("\xD6ffentlich erreichbare URL der Datei. Alternative zu content_base64."),
        content_base64: str("Dateiinhalt base64-kodiert. Alternative zu url."),
        voucher_id: str("Optional: Buchungsbeleg, an den die Datei geh\xE4ngt wird.")
      },
      required: ["filename"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async handler(args, ctx) {
      const filename = req(args, "filename");
      const hasUrl = Boolean(args.url);
      const hasB64 = Boolean(args.content_base64);
      if (hasUrl === hasB64) throw new LexwareError("Genau eins angeben: url ODER content_base64.");
      let bytes;
      if (hasUrl) {
        const res = await fetch(String(args.url));
        if (!res.ok) throw new LexwareError(`Datei nicht ladbar: HTTP ${res.status} von ${args.url}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const raw = String(args.content_base64).replace(/^data:[^,]*,/, "");
        let bin;
        try {
          bin = atob(raw);
        } catch {
          throw new LexwareError("content_base64 ist kein g\xFCltiges Base64.");
        }
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (bytes.byteLength > 2e7) throw new LexwareError("Datei gr\xF6\xDFer als 20 MB.");
      const form = new FormData();
      form.set("file", new Blob([bytes]), filename);
      form.set("type", "voucher");
      const target = args.voucher_id ? `/v1/vouchers/${encodeURIComponent(String(args.voucher_id))}/files` : "/v1/files";
      const created = await ctx.lex.json(target, { method: "POST", form });
      return {
        file_id: created?.id ?? null,
        filename,
        bytes: bytes.byteLength,
        angehaengt_an_beleg: args.voucher_id ?? null
      };
    }
  }
];

// servers/lexware/src/index.ts
var LOGO = composeLogo(LEXWARE_MARK);
var tools = [...readTools, ...writeTools];
var config = {
  brand: {
    name: "Lexware Office MCP",
    system: "Lexware",
    tagline: "Buchhaltung f\xFCr Claude",
    accent: LEXWARE_MARK.accent,
    logoSvg: LOGO,
    fields: [
      {
        name: "apiKey",
        label: "Lexware-API-Key",
        placeholder: "Public-API-Key aus Lexware Office"
      }
    ],
    credentialHelp: 'Den Key erzeugst du in Lexware Office unter <b>Einstellungen \u2192 Public API</b> (<a href="https://app.lexware.de/addons/public-api">app.lexware.de/addons/public-api</a>). Die Public API setzt <b>Lexware Office XL</b> voraus. Widerrufen kannst du den Zugriff jederzeit, indem du den Key dort l\xF6schst.',
    summary: "Model-Context-Protocol-Server f\xFCr Lexware Office \u2014",
    bullets: [
      "<b>Lesen</b> \u2014 Firmenprofil, Kontakte, Belege aller Art, Belegdetails, PDF-Links, Artikel, Zahlungen, offene Posten, Umsatzauswertung, Stammdaten",
      "<b>Schreiben</b> \u2014 Kontakte, Artikel, Rechnungen, Angebote, Auftragsbest\xE4tigungen, Gutschriften, Lieferscheine, Mahnungen, Buchungsbelege, Dateien",
      "<b>Nicht enthalten</b> \u2014 \xC4ndern und L\xF6schen. Lexware sperrt \xC4nderungen optimistisch \xFCber ein version-Feld; wer es falsch mitschickt, \xFCberschreibt fremde \xC4nderungen."
    ]
  },
  serverInfo: {
    name: "lexware-office",
    title: "Lexware Office",
    version: "1.0.0",
    websiteUrl: "https://www.lexware.de/lexware-office/"
  },
  scopes: "lexware:read lexware:write",
  instructions: `Lexware Office \u2014 Buchhaltung und Rechnungswesen im Gespr\xE4ch. 17 Tools (Lesen \xB7 Anlegen \xB7 Upload \xB7 Download), kein \xC4ndern und kein L\xF6schen. Drei Dinge, die man wissen muss: (1) Rechnungen und andere Belege listet man \xFCber list_vouchers, nicht \xFCber eine eigene Rechnungsliste. (2) Die erlaubten Statuswerte h\xE4ngen von der Belegart ab; ein falscher Wert liefert bei Lexware keine Fehlermeldung, sondern eine leere Liste \u2014 dieser Server pr\xFCft ihn deshalb vorher. (3) Lexware erlaubt nur 2 Anfragen pro Sekunde, gro\xDFe Auswertungen dauern also sp\xFCrbar; Zeitr\xE4ume lieber eingrenzen. Einstieg: \u201Ewer schuldet uns noch was?" (open_items) oder \u201EUmsatz letztes Quartal" (revenue). Datumsangaben immer als 'YYYY-MM-DD'.`,
  tools,
  async validate({ apiKey }) {
    const who = await new Lexware(apiKey).whoami();
    return { account: who.company, user: who.user };
  },
  async context({ apiKey }, kv, origin) {
    return { lex: new Lexware(apiKey), credential: apiKey, kv, origin };
  },
  extraRoutes: serveFile
};
var index_default = createWorker(config);
export {
  index_default as default
};
