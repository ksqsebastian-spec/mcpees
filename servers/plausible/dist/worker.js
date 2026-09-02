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
function publicToolList(tools) {
  return tools.map((t) => ({
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
var PLAUSIBLE_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.36 60"><defs><linearGradient id="pl-a" x1="14.8413403" y1="22.5436904" x2="27.4731407" y2="44.6493411" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#909cf7"/><stop offset="1" stop-color="#4b38d8"/></linearGradient><linearGradient id="pl-b" x1="7.9837957" y1="-1.3582919" x2="21.0009873" y2="21.4217935" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#909cf7"/><stop offset="1" stop-color="#4b38d8"/></linearGradient></defs><path fill="url(#pl-a)" d="M45.2456059,22.6027536c-1.0911024,10.4557623-10.2327486,18.2272825-20.7452872,18.2272807h-4.047804v9.570007c0,5.3019285-4.2980623,9.5999908-9.5999908,9.5999908H3.3599854c-1.8556687,0-3.3599854-1.5043167-3.3599854-3.3599854v-19.7025146l5.0380685-7.0686343c.9118097-1.2793096,2.587965-1.7566996,4.0369945-1.1497867l2.8657142,1.2002785c1.4444817.6050081,3.1153774.12945,4.0247968-1.1455083l6.7172007-9.417163c.9071158-1.2717288,2.5743943-1.7450816,4.0144283-1.1397262l5.5198678,2.3204187c1.4430268.6066135,3.1137697.1319561,4.0223175-1.1427389l6.4594145-9.0625757c2.0248091,3.5597961,3.0145069,7.7887694,2.5468032,12.2706573Z"/><path fill="url(#pl-b)" d="M3.2920959,28.8726296c.82329-1.1551271,2.0209115-2.0434967,3.4138697-2.3114381,1.0861554-.2089265,2.156905-.0992829,3.1472499.3155174l2.8649902,1.1999512c.1651001.0691528.3388672.104187.5164795.104187.4365845,0,.8488159-.2124634,1.1026611-.5683594l6.5942097-9.2447929c.8231505-1.154021,2.0204067-2.0410099,3.4124878-2.3083136,1.0821376-.2077892,2.1463585-.0989034,3.1282512.3138487l5.5198364,2.3204346c.1665649.0700684.3417969.1055298.5206909.1055298.4351807,0,.8456421-.2113647,1.0979614-.5653687l6.9192505-9.7077637C37.8272145,3.3644409,31.7802174,0,24.9450124,0H3.3599904C1.5043217,0,.000005,1.5043167.000005,3.3599854v30.1316528l3.2920909-4.6190085Z"/></svg>',
  /*
   * Weiße Kachel mit Haarlinie statt einer Farbfläche: das Zeichen ist selbst ein
   * Farbverlauf und steht bei Plausible auf Weiß. Auf eine eigene Farbe gesetzt wäre es
   * nicht mehr das Zeichen des Anbieters, sondern eine Auslegung davon.
   */
  bg: "#ffffff",
  border: true,
  accent: "#4b38d8",
  fill: 0.62
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
var PLAUSIBLE_ICON = {
  png512: "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",
  png180: "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",
  ico: "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"
};

// servers/plausible/src/client.ts
var PLAUSIBLE_BASE = "https://plausible.io";
var METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "views_per_visit",
  "bounce_rate",
  "visit_duration",
  "events",
  "scroll_depth",
  "percentage",
  "conversion_rate",
  "group_conversion_rate",
  "average_revenue",
  "total_revenue",
  "time_on_page"
];
var DIMENSIONS = [
  "event:page",
  "event:goal",
  "event:hostname",
  "visit:entry_page",
  "visit:exit_page",
  "visit:source",
  "visit:referrer",
  "visit:channel",
  "visit:utm_medium",
  "visit:utm_source",
  "visit:utm_campaign",
  "visit:utm_content",
  "visit:utm_term",
  "visit:device",
  "visit:browser",
  "visit:browser_version",
  "visit:os",
  "visit:os_version",
  "visit:country",
  "visit:region",
  "visit:city",
  "visit:country_name",
  "visit:region_name",
  "visit:city_name"
];
var TIME_DIMENSIONS = ["time:day", "time:week", "time:month", "time:hour"];
var PROPS_PREFIX = "event:props:";
var FILTER_OPERATORS = ["is", "is_not", "contains", "contains_not"];
var PlausibleError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "PlausibleError";
  }
};
var isProp = (d) => d.startsWith(PROPS_PREFIX) && d.length > PROPS_PREFIX.length;
function checkMetric(m) {
  if (!METRICS.includes(m)) {
    throw new PlausibleError(
      `'${m}' ist keine Kennzahl der Stats API. M\xF6glich sind: ${METRICS.join(", ")}.`
    );
  }
  return m;
}
function checkDimension(d) {
  if (DIMENSIONS.includes(d) || isProp(d)) return d;
  if (TIME_DIMENSIONS.includes(d)) return d;
  throw new PlausibleError(
    `'${d}' ist keine Dimension der Stats API. M\xF6glich sind: ${DIMENSIONS.join(", ")} \u2014 oder eine eigene Ereignis-Eigenschaft als '${PROPS_PREFIX}<name>'.`
  );
}
function checkDay(value, name) {
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new PlausibleError(`${name} muss 'YYYY-MM-DD' sein, war '${s}'.`);
  }
  const d = /* @__PURE__ */ new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new PlausibleError(`${name} ist kein g\xFCltiges Datum: '${s}'.`);
  }
  return s;
}
var RANGE_SHORTCUT = /^(\d+h|\d+d|\d+mo|day|month|year|all)$/;
function encodeDateRange(range) {
  const s = String(range ?? "").trim();
  if (RANGE_SHORTCUT.test(s)) return s;
  const parts = s.split(",");
  if (parts.length === 2) {
    return [checkDay(parts[0].trim(), "Startdatum"), checkDay(parts[1].trim(), "Enddatum")];
  }
  throw new PlausibleError(
    `Zeitraum '${s}' ist unbekannt. Erlaubt sind K\xFCrzel ('7d', '30d', '12mo', 'day', 'month', 'year', 'all') oder ein absoluter Zeitraum 'YYYY-MM-DD,YYYY-MM-DD'.`
  );
}
function preferReadableGeo(dimension) {
  const map = {
    "visit:country": "visit:country_name",
    "visit:region": "visit:region_name",
    "visit:city": "visit:city_name"
  };
  return map[dimension] ?? dimension;
}
function buildFilter(property, operator, values) {
  if (!values.length) {
    throw new PlausibleError(`Filter auf '${property}' braucht mindestens einen Wert.`);
  }
  if (!FILTER_OPERATORS.includes(operator)) {
    throw new PlausibleError(
      `Operator '${operator}' gibt es nicht. M\xF6glich: ${FILTER_OPERATORS.join(", ")}.`
    );
  }
  let target;
  if (property.includes(":")) {
    target = checkDimension(property);
  } else {
    target = `${PROPS_PREFIX}${property}`;
  }
  if (target === "event:goal" && operator !== "is" && operator !== "contains") {
    throw new PlausibleError(
      `Ziele lassen sich nicht ausschlie\xDFen: '${operator}' ist auf event:goal nicht erlaubt, Plausible kennt dort nur 'is' und 'contains'.`
    );
  }
  return [operator, target, values];
}
function pageFilter(page2) {
  return page2.endsWith("*") ? ["contains", "event:page", [page2.slice(0, -1)]] : ["is", "event:page", [page2]];
}
function goalFilter(goal) {
  return ["is", "event:goal", [goal]];
}
function checkConversionRate(metrics, dimensions, filters) {
  const wantsRate = metrics.some((m) => m === "conversion_rate" || m === "group_conversion_rate");
  if (!wantsRate) return;
  const hasGoal = dimensions.includes("event:goal") || filters.some(([, target]) => target === "event:goal");
  if (!hasGoal) {
    throw new PlausibleError(
      "conversion_rate rechnet gegen ein Ziel. Entweder nach 'event:goal' aufschl\xFCsseln oder ein Ziel filtern \u2014 sonst wei\xDF Plausible nicht, welche Rate gemeint ist."
    );
  }
}
function zip(raw, metrics, dimensions) {
  return (raw.results ?? []).map((r) => {
    const row = {};
    dimensions.forEach((d, i) => {
      row[d] = r.dimensions?.[i] ?? null;
    });
    metrics.forEach((m, i) => {
      row[m] = r.metrics?.[i] ?? null;
    });
    return row;
  });
}
var Plausible = class {
  constructor(apiKey, defaultSite, baseUrl = PLAUSIBLE_BASE) {
    this.apiKey = apiKey;
    this.defaultSite = defaultSite;
    this.baseUrl = baseUrl;
  }
  get site() {
    return this.defaultSite;
  }
  /**
   * Eine Abfrage stellen und benannte Zeilen zurückgeben.
   *
   * Geprüft wird vor dem Absenden: Kennzahlen, Dimensionen, Zeitraum und der
   * Ziel-Bezug von conversion_rate. Was hier durchgeht, scheitert nicht mehr an der
   * Form der Anfrage.
   */
  async query(input) {
    const metrics = input.metrics.map(checkMetric);
    const dimensions = (input.dimensions ?? []).map(checkDimension);
    const filters = input.filters ?? [];
    checkConversionRate(metrics, dimensions, filters);
    const body = {
      site_id: input.site?.trim() || this.defaultSite,
      metrics,
      date_range: encodeDateRange(input.dateRange)
    };
    if (dimensions.length) body.dimensions = dimensions;
    if (filters.length) body.filters = filters;
    if (input.limit !== void 0) {
      body.pagination = { limit: input.limit, ...input.offset ? { offset: input.offset } : {} };
    }
    const raw = await this.post(body);
    return { rows: zip(raw, metrics, dimensions), metrics, dimensions };
  }
  async post(body) {
    const res = await fetch(`${this.baseUrl}/api/v2/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await this.error(res);
    return await res.json();
  }
  /**
   * Aus der Antwort einen brauchbaren Fehler machen.
   *
   * Plausible meldet Fehler als `{"error": "..."}`. Der Text ist meist präzise und
   * gehört deshalb weitergereicht — allerdings gekürzt, denn er kann die ganze Anfrage
   * zurückspiegeln. Die Statuscodes bekommen eine Erklärung dazu, weil 401 und 402 bei
   * Plausible verschiedene Ursachen haben, die man ohne Hinweis verwechselt.
   */
  async error(res) {
    const text = await res.text().catch(() => "");
    let detail;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.error === "string" && parsed.error) detail = parsed.error.slice(0, 400);
    } catch {
    }
    const hint = {
      400: "Die Anfrage passt nicht zur Stats API.",
      401: "Der API-Key gilt nicht (mehr). In Plausible unter Account Settings \u2192 API Keys pr\xFCfen.",
      402: "Die Stats API ist f\xFCr dieses Plausible-Abo nicht freigeschaltet.",
      403: "Der Key darf diese Seite nicht lesen.",
      404: "Diese Seite gibt es in dem Plausible-Konto nicht \u2014 Domain genau wie dort schreiben.",
      429: "Zu viele Anfragen (Plausible erlaubt 600 pro Stunde). Sp\xE4ter erneut versuchen."
    };
    const parts = [`Plausible antwortet mit ${res.status}.`, hint[res.status], detail].filter(
      Boolean
    );
    return new PlausibleError(parts.join(" "), detail);
  }
  /**
   * Zugangsdaten prüfen — ein echter, minimaler Aufruf.
   *
   * Plausible hat keinen Endpunkt, der nur „Key gültig?" beantwortet. Die Liste der
   * Seiten (Sites API) ist ein anderes Recht und mit einem reinen Stats-Key nicht
   * abrufbar; sie taugt hier also nicht. Eine Abfrage auf die hinterlegte Seite prüft
   * dagegen genau das, worauf es ankommt: dass der Key gilt UND diese Seite sieht.
   */
  async whoami() {
    const { rows } = await this.query({ metrics: ["visitors"], dateRange: "day" });
    const value = rows[0]?.visitors;
    return { site: this.defaultSite, visitorsToday: typeof value === "number" ? value : 0 };
  }
};

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

// servers/plausible/src/tools/read.ts
var siteArg = str(
  "Domain der Plausible-Seite, z. B. 'example.com'. Weglassen = die beim Verbinden hinterlegte Seite."
);
var dateRangeArg = str(
  "Zeitraum: K\xFCrzel wie '7d', '30d', '12mo', 'day' (heute), 'month' (laufender Monat), 'year', 'all' \u2014 oder absolut als 'YYYY-MM-DD,YYYY-MM-DD'."
);
var pageArg = str(
  "Nur diese Seite, z. B. '/preise'. Ein '*' am Ende sucht mit Pr\xE4fix: '/blog*'."
);
var goalArg = str("Nur dieses Ziel, z. B. 'Signup'. Name genau wie in Plausible.");
var metricsArg = {
  type: "array",
  items: { type: "string", enum: [...METRICS] },
  description: "Kennzahlen. Voreinstellung: visitors, pageviews, bounce_rate, visit_duration. conversion_rate braucht immer einen Ziel-Bezug."
};
var filtersArg = {
  type: "array",
  description: "Zus\xE4tzliche Filter, mit UND verkn\xFCpft. Je Eintrag: property (Dimension wie 'visit:channel' oder der blo\xDFe Name einer eigenen Ereignis-Eigenschaft wie 'plan'), operator (is | is_not | contains | contains_not, Vorgabe is) und values (Liste).",
  items: {
    type: "object",
    properties: {
      property: { type: "string" },
      operator: { type: "string", enum: ["is", "is_not", "contains", "contains_not"] },
      values: { type: "array", items: { type: "string" } }
    },
    required: ["property", "values"]
  }
};
var DEFAULT_METRICS = ["visitors", "pageviews", "bounce_rate", "visit_duration"];
var metricsOf = (args, fallback = DEFAULT_METRICS) => {
  const m = args.metrics;
  if (!m) return fallback;
  if (!Array.isArray(m) || m.some((x) => typeof x !== "string")) {
    throw new PlausibleError("'metrics' muss eine Liste von Kennzahlnamen sein.");
  }
  return m.length ? m : fallback;
};
function collectFilters(args) {
  const out = [];
  const extra = args.filters;
  if (extra !== void 0 && !Array.isArray(extra)) {
    throw new PlausibleError("'filters' muss eine Liste sein.");
  }
  const entries = Array.isArray(extra) ? extra : [];
  for (const [name, dimension, value] of [
    ["page", "event:page", args.page],
    ["goal", "event:goal", args.goal]
  ]) {
    if (!value) continue;
    if (entries.some((e) => e?.property === dimension)) {
      throw new PlausibleError(
        `'${name}' und ein Eintrag in 'filters' zielen beide auf ${dimension}. Zusammen treffen sie fast nie etwas \u2014 die ganze Bedingung in 'filters' schreiben und '${name}' weglassen.`
      );
    }
    out.push(name === "page" ? pageFilter(String(value)) : goalFilter(String(value)));
  }
  for (const e of entries) {
    if (!e || typeof e !== "object" || typeof e.property !== "string") {
      throw new PlausibleError("Jeder Filter braucht ein 'property'.");
    }
    if (!Array.isArray(e.values)) {
      throw new PlausibleError(`Filter auf '${e.property}' braucht 'values' als Liste.`);
    }
    out.push(
      buildFilter(
        e.property,
        e.operator ?? "is",
        e.values.map((v) => String(v))
      )
    );
  }
  return out;
}
var head = (site, args, extra = {}) => ({
  site,
  zeitraum: String(args.date_range),
  ...extra
});
var overview = {
  name: "overview",
  title: "\xDCberblick",
  description: 'Die Eckwerte eines Zeitraums als eine Zeile: Besucher, Seitenaufrufe, Absprungrate, Verweildauer. Der richtige Einstieg f\xFCr \u201Ewie lief letzte Woche?" und die Grundlage, bevor man mit breakdown ins Detail geht.',
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg
    },
    required: ["date_range"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req(args, "date_range");
    const metrics = metricsOf(args);
    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      filters: collectFilters(args),
      site: args.site
    });
    return { ...head(args.site || pl.site, args), werte: rows[0] ?? null };
  }
};
var timeseries = {
  name: "timeseries",
  title: "Verlauf",
  description: "Kennzahlen \xFCber die Zeit, in Tagen, Wochen, Monaten oder Stunden. Daf\xFCr da, Ausschl\xE4ge zu finden \u2014 etwa ob ein Deploy am Dienstag den Verkehr auf /preise ver\xE4ndert hat.",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      granularity: {
        type: "string",
        enum: ["hour", "day", "week", "month"],
        description: "Gr\xF6\xDFe der Zeitschritte. Vorgabe: day."
      },
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg
    },
    required: ["date_range"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req(args, "date_range");
    const granularity = String(args.granularity ?? "day");
    if (!["hour", "day", "week", "month"].includes(granularity)) {
      throw new PlausibleError(
        `granularity '${granularity}' gibt es nicht \u2014 m\xF6glich: hour, day, week, month.`
      );
    }
    const metrics = metricsOf(args);
    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      dimensions: [`time:${granularity}`],
      filters: collectFilters(args),
      site: args.site
    });
    return {
      ...head(args.site || pl.site, args, { schritt: granularity, punkte: rows.length }),
      verlauf: rows
    };
  }
};
var breakdown = {
  name: "breakdown",
  title: "Aufschl\xFCsselung",
  description: 'Kennzahlen nach einer Dimension aufgeschl\xFCsselt und absteigend sortiert: Top-Seiten, Herkunft, Land, Ger\xE4t, Browser, UTM-Parameter oder eine eigene Ereignis-Eigenschaft. Das Tool f\xFCr \u201Ewelche Seite l\xE4uft am besten?" und \u201Ewoher kommen die Leute?".',
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      dimension: {
        type: "string",
        description: `Wonach aufgeschl\xFCsselt wird \u2014 z. B. event:page, visit:source, visit:channel, visit:country, visit:device \u2014 oder eine eigene Eigenschaft als '${PROPS_PREFIX}<name>'. M\xF6glich: ${DIMENSIONS.join(", ")}.`
      },
      limit: int("H\xF6chstzahl Zeilen, 1\u20131000. Vorgabe: 20."),
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg
    },
    required: ["date_range", "dimension"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req(args, "date_range");
    const wanted = String(req(args, "dimension"));
    const dimension = preferReadableGeo(wanted);
    const limit = Math.min(1e3, Math.max(1, Number(args.limit) || 20));
    const metrics = metricsOf(args, ["visitors", "pageviews", "bounce_rate"]);
    const { rows } = await pl.query({
      metrics,
      dateRange: String(args.date_range),
      dimensions: [dimension],
      filters: collectFilters(args),
      limit,
      site: args.site
    });
    return {
      ...head(args.site || pl.site, args, {
        dimension,
        // Sichtbar machen, dass getauscht wurde — sonst wundert sich, wer 'visit:country'
        // gefragt hat, über den Feldnamen in der Antwort.
        ...dimension !== wanted ? { statt: wanted, grund: "Klarnamen statt ISO-Codes" } : {},
        zeilen: rows.length,
        ...rows.length === limit ? { hinweis: `Bei ${limit} abgeschnitten.` } : {}
      }),
      werte: rows
    };
  }
};
var conversions = {
  name: "conversions",
  title: "Ziele",
  description: "Zielerreichungen mit Rate: wie oft wurde ein Ziel ausgel\xF6st und von welchem Anteil der Besucher. Wahlweise je Seite, um zu sehen, welche Seite die Abschl\xFCsse bringt. Setzt voraus, dass in Plausible Ziele eingerichtet sind.",
  inputSchema: {
    type: "object",
    properties: {
      date_range: dateRangeArg,
      goal: goalArg,
      per_page: bool("Zus\xE4tzlich nach Seite aufschl\xFCsseln. Vorgabe: nein."),
      limit: int("H\xF6chstzahl Zeilen, 1\u20131000. Vorgabe: 50."),
      site: siteArg,
      page: pageArg,
      filters: filtersArg
    },
    required: ["date_range"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    req(args, "date_range");
    const dimensions = args.per_page ? ["event:goal", "event:page"] : ["event:goal"];
    const { rows } = await pl.query({
      metrics: ["visitors", "events", "conversion_rate"],
      dateRange: String(args.date_range),
      dimensions,
      filters: collectFilters(args),
      limit: Math.min(1e3, Math.max(1, Number(args.limit) || 50)),
      site: args.site
    });
    return {
      ...head(args.site || pl.site, args, { ziele: rows.length }),
      ...rows.length === 0 ? { hinweis: "Keine Zielerreichungen. Sind in Plausible \xFCberhaupt Ziele angelegt?" } : {},
      werte: rows
    };
  }
};
var compare = {
  name: "compare",
  title: "Zeitr\xE4ume vergleichen",
  description: 'Zwei beliebige Zeitr\xE4ume nebeneinander, mit Differenz absolut und in Prozent. F\xFCr \u201Ewie war der Januar gegen den Dezember?" oder \u201Evor und nach der Umstellung".',
  inputSchema: {
    type: "object",
    properties: {
      range_a: str("Erster Zeitraum (der Vergleichsma\xDFstab). Formate wie bei date_range."),
      range_b: str("Zweiter Zeitraum (der bewertete). Formate wie bei date_range."),
      site: siteArg,
      page: pageArg,
      goal: goalArg,
      metrics: metricsArg,
      filters: filtersArg
    },
    required: ["range_a", "range_b"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  async handler(args, { pl }) {
    const rangeA = String(req(args, "range_a"));
    const rangeB = String(req(args, "range_b"));
    const metrics = metricsOf(args);
    const filters = collectFilters(args);
    const site = args.site;
    const [a, b] = await Promise.all([
      pl.query({ metrics, dateRange: rangeA, filters, site }),
      pl.query({ metrics, dateRange: rangeB, filters, site })
    ]);
    const rowA = a.rows[0] ?? {};
    const rowB = b.rows[0] ?? {};
    const delta = {};
    for (const m of metrics) {
      const va = rowA[m];
      const vb = rowB[m];
      if (typeof va !== "number" || typeof vb !== "number") {
        delta[m] = { absolut: null, prozent: null };
        continue;
      }
      const abs = vb - va;
      delta[m] = {
        absolut: Math.round(abs * 100) / 100,
        // Von null aus gibt es keine prozentuale Veränderung. Eine Zahl zu erfinden
        // (0 oder 100) wäre schlimmer als die Lücke einzugestehen.
        prozent: va !== 0 ? Math.round(abs / va * 1e4) / 100 : null
      };
    }
    return {
      site: site || pl.site,
      a: { zeitraum: rangeA, werte: rowA },
      b: { zeitraum: rangeB, werte: rowB },
      veraenderung: delta
    };
  }
};
var readTools = [overview, timeseries, breakdown, conversions, compare];

// servers/plausible/src/index.ts
var config = {
  brand: {
    name: "Plausible MCP",
    system: "Plausible",
    tagline: "Web-Statistik f\xFCr Claude",
    accent: PLAUSIBLE_MARK.accent,
    logoSvg: composeLogo(PLAUSIBLE_MARK),
    icon: PLAUSIBLE_ICON,
    /*
     * Zwei Felder, nicht eines: die Stats API kennt keinen Endpunkt, der ohne Angabe
     * einer Seite antwortet, und die Sites API — die die Seiten eines Kontos auflisten
     * könnte — gibt es nur im Enterprise-Tarif. Ohne eine Domain wüsste der Server also
     * weder, wogegen er den Key prüfen soll, noch was er ohne nähere Angabe abfragen soll.
     *
     * Es ist aber eine VORGABE, keine Bindung: jedes Tool nimmt ein optionales 'site'.
     * Wer zehn Seiten hat, braucht trotzdem nur diese eine Verbindung. Das muss die
     * Beschriftung hergeben — stand hier nur „Domain der Seite", las sich das wie eine
     * Verbindung je Seite.
     */
    fields: [
      {
        name: "apiKey",
        label: "Plausible-API-Key",
        placeholder: "beginnt mit  plausible-",
        secret: true
      },
      {
        name: "site",
        label: "Standard-Seite (Domain)",
        placeholder: "example.com"
      }
    ],
    credentialHelp: 'Den Key erzeugst du in Plausible unter <b>Account Settings \u2192 API Keys \u2192 New API Key</b> (Typ <b>Stats API</b>). Er wird nur einmal angezeigt. <b>Eine Verbindung reicht f\xFCr alle deine Seiten.</b> Die Domain hier ist blo\xDF die Vorgabe f\xFCr Fragen ohne Ortsangabe \u2014 jede andere Seite, die der Key sehen darf, fragst du einfach mit Namen ab (\u201EBesucher von kunde-b.de letzte Woche"). Trag sie genau so ein, wie sie in Plausible steht: ohne <code>https://</code> und ohne Schr\xE4gstrich am Ende, also <code>example.com</code>. Welche Seiten es in deinem Konto gibt, kann dieser Server nicht auflisten \u2014 daf\xFCr br\xE4uchte es die Sites API, und die gibt Plausible nur im Enterprise-Tarif frei. Der Key liest nur; schreibende Aufrufe bietet die Stats API gar nicht an. Zur\xFCckziehen kannst du den Zugriff jederzeit, indem du den Key in Plausible l\xF6schst.',
    summary: "Model-Context-Protocol-Server f\xFCr Plausible Analytics \u2014",
    bullets: [
      "<b>\xDCberblick</b> \u2014 Besucher, Seitenaufrufe, Absprungrate und Verweildauer f\xFCr jeden Zeitraum, wahlweise auf eine Seite oder ein Ziel eingegrenzt",
      "<b>Verlauf</b> \u2014 dieselben Kennzahlen \xFCber die Zeit, in Stunden, Tagen, Wochen oder Monaten; daf\xFCr da, Ausschl\xE4ge einem Datum zuzuordnen",
      "<b>Aufschl\xFCsselung</b> \u2014 nach Seite, Herkunft, Kanal, Land, Ger\xE4t, Browser, UTM-Parametern oder einer eigenen Ereignis-Eigenschaft",
      "<b>Ziele und Vergleich</b> \u2014 Zielerreichungen mit Rate, und zwei beliebige Zeitr\xE4ume nebeneinander samt Differenz",
      "<b>Mehrere Seiten</b> \u2014 eine Verbindung gen\xFCgt. Die hinterlegte Domain ist nur die Vorgabe; jedes Tool nimmt daneben eine beliebige andere Seite entgegen, die der Key sehen darf.",
      "<b>Nicht enthalten</b> \u2014 alles Schreibende. Die Stats API von Plausible ist ausschlie\xDFlich lesend; es gibt nichts, was dieser Server ver\xE4ndern k\xF6nnte."
    ]
  },
  serverInfo: {
    name: "plausible",
    title: "Plausible Web-Statistik",
    version: "1.0.0",
    websiteUrl: "https://plausible.io"
  },
  scopes: "plausible:read",
  instructions: "Plausible \u2014 Web-Statistik im Gespr\xE4ch. 5 Tools, alle lesend. Der Einstieg ist fast immer 'overview' (die Eckwerte), danach 'breakdown' f\xFCr das Warum und 'timeseries' f\xFCr das Wann. Vier Dinge vorweg: (1) Zeitr\xE4ume sind entweder K\xFCrzel ('7d', '30d', '12mo', 'day', 'month', 'year', 'all') oder absolut als 'YYYY-MM-DD,YYYY-MM-DD' \u2014 dazwischen gibt es nichts. (2) Eine Vorgabe-Seite steckt in den Zugangsdaten und gilt, wenn keine genannt wird; derselbe Key kann aber mehrere Seiten sehen \u2014 f\xFCr eine andere Domain einfach 'site' setzen, eine zweite Verbindung braucht es nie. Welche Seiten es gibt, kann der Server nicht auflisten (daf\xFCr w\xE4re die Sites API n\xF6tig, die nur Enterprise hat) \u2014 im Zweifel nachfragen. (3) conversion_rate rechnet gegen ein Ziel \u2014 ohne Ziel-Aufschl\xFCsselung oder Zielfilter ist sie nicht zu haben, daf\xFCr gibt es 'conversions'. (4) Ziele lassen sich filtern, aber nicht ausschlie\xDFen. Absprungrate und Verweildauer sind Besuchs-Kennzahlen: zusammen mit einer Seiten-Dimension beziehen sie sich auf den Besuch, der die Seite enthielt, nicht auf die Seite allein.",
  tools: readTools,
  /**
   * Zugangsdaten prüfen.
   *
   * Beide Angaben werden gegen Plausible geprüft, nicht nur der Key: eine Abfrage auf die
   * genannte Domain scheitert mit 404, wenn es sie im Konto nicht gibt. Genau das ist der
   * häufigste Tippfehler beim Verbinden — 'https://example.com' oder 'www.example.com'
   * statt 'example.com' — und es würde sonst erst beim ersten Tool-Aufruf auffallen.
   */
  async validate({ apiKey, site }) {
    const key = String(apiKey ?? "").trim();
    const domain = String(site ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!key) throw new PlausibleError("Ohne API-Key geht es nicht.");
    if (!domain) throw new PlausibleError("Die Domain der Plausible-Seite fehlt.");
    if (domain.includes("/")) {
      throw new PlausibleError(
        `'${domain}' enth\xE4lt einen Pfad. Gemeint ist nur die Domain, also z. B. 'example.com'.`
      );
    }
    const who = await new Plausible(key, domain).whoami();
    return {
      account: who.site,
      user: who.visitorsToday === 1 ? "1 Besucher heute" : `${who.visitorsToday} Besucher heute`
    };
  },
  async context({ apiKey, site }) {
    const domain = String(site).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return { pl: new Plausible(String(apiKey).trim(), domain) };
  }
};
var index_default = createWorker(config);
export {
  index_default as default
};
