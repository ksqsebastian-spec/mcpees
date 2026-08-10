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
var SEVDESK_MARK = {
  inner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="7.8889 7.5556 16.2222 15.7778"><path fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd" d="M22.4444 7.55556C21.524 7.55556 20.7778 8.30175 20.7778 9.22222V21.6667C20.7778 22.5871 21.524 23.3333 22.4444 23.3333C23.3649 23.3333 24.1111 22.5871 24.1111 21.6667V9.22222C24.1111 8.30175 23.3649 7.55556 22.4444 7.55556ZM14.3333 13.8889C14.3333 12.9684 15.0795 12.2222 16 12.2222C16.9205 12.2222 17.6667 12.9684 17.6667 13.8889V21.6667C17.6667 22.5871 16.9205 23.3333 16 23.3333C15.0795 23.3333 14.3333 22.5871 14.3333 21.6667V13.8889ZM7.88889 17.8889C7.88889 16.9684 8.63508 16.2222 9.55556 16.2222C10.476 16.2222 11.2222 16.9684 11.2222 17.8889V21.6667C11.2222 22.5871 10.476 23.3333 9.55556 23.3333C8.63508 23.3333 7.88889 22.5871 7.88889 21.6667V17.8889Z"/></svg>',
  bg: "#FB523B",
  accent: "#FB523B",
  fill: 0.507
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
var SEVDESK_ICON = {
  png512: "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T39UvQD43gVWAAQAAgCoWwB0r/4nASAAEABAXd4B8LsAuPFatwA8BYAAAIYNgGsrGABrfmoFwAoAAgAQAAJAACAAAAEgAAQAAgAEgAAQAAIAAQACQAAIAAGAAAABIAAEgABAAIAAEAACQAAgAEAACAABIAAQACAABIAAEAAIABAAAkAACAAEAAgAASAABIAAAASAABAACABAAAgAAYAAAASAABAACABAAAgAAYAAAASAABAACABAAAgAAYAAAASAABAACABAAAgAAYAAAASAABAACABAAAgAAYAAAAEgAASAAEAAgAAQAAJAACAAQAAIAAEgABAAIAAEgAAQAAgAEAACQAAIAAQACAABIAAEAAIABIAAEAACQAAYCBAAAkAAIAAAASAABAACABAAAkAAIAAAASAABAACABAAAkAAIAAAASAABAACABAAAkAAIAAAASAABAACgCo68AMhO+qAkJ+wMORfOil0zv9y6Jx7Rsi/eGLIP314yI6YH7L99zROwwXANQJAAAgABAD97uAkdM46NXTXXhfC88+P/KLzzNO9b7r5KZ8K2X5/YxwFgAAQAAgA+t5+7w6db341hPvumbgJ4rY1vVUC4ysABIAAQADQjxfAs5eEsHHDpF6M8pOOFgACQAAIAAQA/SBfvCiEhx6YugnjtrUhO3xfmwAFgAAQAAgApsX894Tu6mum58KUZaGz/EwBIAAEgABAADCljl4QwuOPTP/kccsNvX0HbgEIAAEgABAATPaS/7GHhLB5U39dpGry+KAVAAEgABAATM/k/+nD+/NC9eC6kH3o3VYABIAAEAAIACbc4fuG8Nyz/TuR3HFLyIZ2swIgAASAAEAAMJEb/sIjD/X99apzxQorAAJAAAgABAATNvHctqY016x8yYlWAASAABAACADGfWE75/RyXbSe3xKyj82zAiAABIAAQAAwZgd+IIRNz5VvUll9jRUAASAABAACgDFPOD/5YWmvXfnxh1kBEAACQAAgABi1j38whE6nvBPLXT+3AiAABIAAQAAw6slm1crSX7+K9xZYARAAAkAAIAAY8WN/e/Tet1/6yeWnP7ICIAAEgABAADDii9myz1fjAlY8EVCh3woQAAJAACAAmOTn/tdW5hqWn3KcWwACQAAIAAQA2/TBgRA6eXUmmCsvtQIgAASAAEAAsC35CQurdRF7+EErAAJAAAgABADbvJCdt7Ry17FiVcMKgAAQAAIAAcBwk8yP/m/1AuDI/QWAABAAAgABwPAbANdU7jqWL17kFoAAEAACAAHAsJPMnbdW7jrWOetUKwACQAAIAAQAw04y/++26gXARecIAAEgAAQAAoBhJ5m7KhgA/3SxWwACQAAIAAQAtQuAH1xiBUAACAABgABAAAgAASAABAACAAEgAASAABAACAABIAAEgAAQAAJAACAABIAAEAACAAGAABAAAkAACAAEAAJAAAgAASAAEAAIAAEgAASAAEAAIAAEgAAQAAIAAYAAEAACQAAIAAQAAkAACAABIAAQAAgAASAABIAAQAAgAASAABAAAgABgAAQAAJAAAgABAACQAAIAAEgABAACAABIAAEgABAACAABIAAEAACAAGAABAAAkAACAAEAAJAAAgAASAAEAAIAAEgAASAAEAAIAAEgAAQAAJAABgEASAABIAAEAAIAASAABAAAkAAIAAQAAJAAAgAAYAAQAAIAAEgAAQAAgABIAAEgAAQAAgABIAAEAACQAAgABAAAkAACAABgABAAAgAASAABAACAAEgAASAABAACAAEgAAQAAJAACAAEAACQAAIAAGAAEAACAABIAAEAAIAASAABIAAEAAIAASAABAAAkAAIAAQAAJAAAgAAYAAQAAIAAEgAAQAAgABIAAEgAAQAAgAASAABIAAEAAIAASAABAAAkAAIAAQAAJAAAgAAYAAQAAIAAEgAAQAAgABIAAEgAAQAAgABIAAEAACQAAgABAAAkAACAABgABAAAgAASAABAACAAEgAASAABAACAAEgAAQAAJAACAAEAACQAAIAAGAAEAACAABIAAEAAIAASAABIAAEAAIAASAABAAAkAAIAAQAAJAAAgAAYAAQAAIAAEgAAQAAgABIAAEgAAQAAgAASAABIAAEACuiQIAASAABIAAEAAIAASAABAAAkAAIAAQAAJAAAgAAYAAoOSTzJ23Vi8ALruoGudm1crqBcCN11YjAL5zbvUC4Fe/dE0UANQqAH62unoBcMl51ZhkrlhRvQC45opqnJtvLKveubnrNtdEAUCtAuD6n1QvAC74SjUmmUu/Xb1zs/L71Tg3Xz+tegFwyw2uiQKAOulc8f3KXcjypSf7ltmvAXDROZU4N/lpf1+9APjJD10TBQC1CoBzz6heAPyfj1Vjkvn8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",
  png180: "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",
  ico: "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"
};

// servers/sevdesk/src/api.generated.ts
var OPERATIONS = {
  "GET /Tools/bookkeepingSystemVersion": {},
  "GET /CheckAccount": {},
  "POST /CheckAccount/Factory/fileImportAccount": {},
  "POST /CheckAccount/Factory/clearingAccount": {},
  "GET /CheckAccount/{checkAccountId}": { p: ["checkAccountId"] },
  "PUT /CheckAccount/{checkAccountId}": { p: ["checkAccountId"] },
  "DELETE /CheckAccount/{checkAccountId}": { p: ["checkAccountId"] },
  "GET /CheckAccount/{checkAccountId}/getBalanceAtDate": { p: ["checkAccountId"], q: { "date": { t: "string", r: 1 } } },
  "GET /CheckAccountTransaction": { q: { "checkAccount[id]": { t: "integer" }, "checkAccount[objectName]": { t: "string" }, "isBooked": { t: "boolean" }, "paymtPurpose": { t: "string" }, "startDate": { t: "string" }, "endDate": { t: "string" }, "payeePayerName": { t: "string" }, "onlyCredit": { t: "boolean" }, "onlyDebit": { t: "boolean" } } },
  "POST /CheckAccountTransaction": {},
  "GET /CheckAccountTransaction/{checkAccountTransactionId}": { p: ["checkAccountTransactionId"] },
  "PUT /CheckAccountTransaction/{checkAccountTransactionId}": { p: ["checkAccountTransactionId"] },
  "DELETE /CheckAccountTransaction/{checkAccountTransactionId}": { p: ["checkAccountTransactionId"] },
  "PUT /CheckAccountTransaction/{checkAccountTransactionId}/enshrine": { p: ["checkAccountTransactionId"] },
  "GET /Contact/Factory/getNextCustomerNumber": {},
  "GET /Contact/Factory/findContactsByCustomFieldValue": { q: { "value": { t: "string", r: 1 }, "customFieldSetting[id]": { t: "string" }, "customFieldSetting[objectName]": { t: "string" }, "customFieldName": { t: "string", r: 1 } } },
  "GET /Contact/Mapper/checkCustomerNumberAvailability": { q: { "customerNumber": { t: "string" } } },
  "GET /Contact": { q: { "depth": { t: "string", e: ["0", "1"] }, "customerNumber": { t: "string" } } },
  "POST /Contact": {},
  "GET /Contact/{contactId}": { p: ["contactId"] },
  "PUT /Contact/{contactId}": { p: ["contactId"] },
  "DELETE /Contact/{contactId}": { p: ["contactId"] },
  "GET /Contact/{contactId}/getTabsItemCount": { p: ["contactId"] },
  "POST /ContactAddress": {},
  "GET /ContactAddress": {},
  "GET /ContactAddress/{contactAddressId}": { p: ["contactAddressId"] },
  "PUT /ContactAddress/{contactAddressId}": { p: ["contactAddressId"] },
  "DELETE /ContactAddress/{contactAddressId}": { p: ["contactAddressId"] },
  "GET /CommunicationWay": { q: { "contact[id]": { t: "string" }, "contact[objectName]": { t: "string" }, "type": { t: "string", e: ["PHONE", "EMAIL", "WEB", "MOBILE"] }, "main": { t: "string", e: ["0", "1"] } } },
  "POST /CommunicationWay": {},
  "GET /CommunicationWay/{communicationWayId}": { p: ["communicationWayId"] },
  "DELETE /CommunicationWay/{communicationWayId}": { p: ["communicationWayId"] },
  "PUT /CommunicationWay/{communicationWayId}": { p: ["communicationWayId"] },
  "GET /CommunicationWayKey": {},
  "GET /AccountingContact": { q: { "contact[id]": { t: "string" }, "contact[objectName]": { t: "string" } } },
  "POST /AccountingContact": {},
  "GET /AccountingContact/{accountingContactId}": { p: ["accountingContactId"] },
  "PUT /AccountingContact/{accountingContactId}": { p: ["accountingContactId"] },
  "DELETE /AccountingContact/{accountingContactId}": { p: ["accountingContactId"] },
  "GET /Textparser/fetchDictionaryEntriesByType": { q: { "objectName": { t: "string", e: ["Invoice", "CreditNote", "Order", "Contact", "Letter", "Email"], r: 1 }, "subObjectName": { t: "string", e: ["Invoice", "CreditNote", "Order", "Contact", "Letter"] } } },
  "GET /ContactCustomField": {},
  "POST /ContactCustomField": {},
  "GET /ContactCustomField/{contactCustomFieldId}": { p: ["contactCustomFieldId"] },
  "PUT /ContactCustomField/{contactCustomFieldId}": { p: ["contactCustomFieldId"] },
  "DELETE /ContactCustomField/{contactCustomFieldId}": { p: ["contactCustomFieldId"] },
  "GET /ContactCustomFieldSetting": {},
  "POST /ContactCustomFieldSetting": {},
  "GET /ContactCustomFieldSetting/{contactCustomFieldSettingId}": { p: ["contactCustomFieldSettingId"] },
  "PUT /ContactCustomFieldSetting/{contactCustomFieldSettingId}": { p: ["contactCustomFieldSettingId"] },
  "DELETE /ContactCustomFieldSetting/{contactCustomFieldSettingId}": { p: ["contactCustomFieldSettingId"] },
  "GET /ContactCustomFieldSetting/{contactCustomFieldSettingId}/getReferenceCount": { p: ["contactCustomFieldSettingId"] },
  "GET /CreditNote": { q: { "status": { t: "string", e: ["100", "200", "300", "500", "750", "1000"] }, "creditNoteNumber": { t: "string" }, "startDate": { t: "integer" }, "endDate": { t: "integer" }, "contact[id]": { t: "integer" }, "contact[objectName]": { t: "string" } } },
  "POST /CreditNote/Factory/saveCreditNote": {},
  "POST /CreditNote/Factory/createFromInvoice": {},
  "POST /CreditNote/Factory/createFromVoucher": {},
  "GET /CreditNote/{creditNoteId}": { p: ["creditNoteId"] },
  "PUT /CreditNote/{creditNoteId}": { p: ["creditNoteId"] },
  "DELETE /CreditNote/{creditNoteId}": { p: ["creditNoteId"] },
  "GET /CreditNote/{creditNoteId}/sendByWithRender": { p: ["creditNoteId"], q: { "sendType": { t: "string", r: 1 } } },
  "PUT /CreditNote/{creditNoteId}/sendBy": { p: ["creditNoteId"] },
  "PUT /CreditNote/{creditNoteId}/enshrine": { p: ["creditNoteId"] },
  "GET /CreditNote/{creditNoteId}/getPdf": { p: ["creditNoteId"], q: { "download": { t: "boolean" }, "preventSendBy": { t: "boolean" } } },
  "POST /CreditNote/{creditNoteId}/sendViaEmail": { p: ["creditNoteId"] },
  "PUT /CreditNote/{creditNoteId}/bookAmount": { p: ["creditNoteId"] },
  "PUT /CreditNote/{creditNoteId}/resetToOpen": { p: ["creditNoteId"] },
  "PUT /CreditNote/{creditNoteId}/resetToDraft": { p: ["creditNoteId"] },
  "GET /CreditNotePos": { q: { "creditNote[id]": { t: "integer" }, "creditNote[objectName]": { t: "string" } } },
  "PUT /SevClient/{SevClientId}/updateExportConfig": { p: ["SevClientId"] },
  "GET /Export/datevCSV": { q: { "Download": { t: "boolean" }, "startDate": { t: "integer", r: 1 }, "endDate": { t: "integer", r: 1 }, "scope": { t: "string", r: 1 }, "withUnpaidDocuments": { t: "boolean" }, "withEnshrinedDocuments": { t: "boolean" }, "enshrine": { t: "boolean" } } },
  "GET /Export/createDatevCsvZipExportJob": { q: { "startDate": { t: "integer", r: 1 }, "endDate": { t: "integer", r: 1 }, "scope": { t: "string", r: 1 }, "exportByPaydate": { t: "boolean" }, "includeEnshrined": { t: "boolean" }, "enshrineDocuments": { t: "boolean" }, "includeDocumentImages": { t: "boolean" } } },
  "GET /Export/createDatevXmlZipExportJob": { q: { "startDate": { t: "integer", r: 1 }, "endDate": { t: "integer", r: 1 }, "scope": { t: "string", r: 1 }, "exportByPaydate": { t: "boolean" }, "includeEnshrined": { t: "boolean" }, "includeExportedDocuments": { t: "boolean" }, "includeDocumentXml": { t: "boolean" } } },
  "GET /Progress/generateDownloadHash": { q: { "jobId": { t: "string", r: 1 } } },
  "GET /Progress/getProgress": { q: { "hash": { t: "string", r: 1 } } },
  "GET /ExportJob/jobDownloadInfo": { q: { "jobId": { t: "string", r: 1 } } },
  "GET /Export/invoiceCsv": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/invoiceZip": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/creditNoteCsv": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/voucherListCsv": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/transactionsCsv": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/voucherZip": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Export/contactListCsv": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Part": { q: { "partNumber": { t: "string" }, "name": { t: "string" } } },
  "POST /Part": {},
  "GET /Part/{partId}": { p: ["partId"] },
  "PUT /Part/{partId}": { p: ["partId"] },
  "GET /Part/{partId}/getStock": { p: ["partId"] },
  "GET /Invoice": { q: { "status": { t: "number", e: [100, 200, 1e3] }, "invoiceNumber": { t: "string" }, "startDate": { t: "integer" }, "endDate": { t: "integer" }, "contact[id]": { t: "integer" }, "contact[objectName]": { t: "string" } } },
  "POST /Invoice/Factory/saveInvoice": {},
  "GET /Invoice/{invoiceId}": { p: ["invoiceId"] },
  "GET /Invoice/{invoiceId}/getPositions": { p: ["invoiceId"], q: { "limit": { t: "integer" }, "offset": { t: "integer" }, "embed": { t: "array" } } },
  "POST /Invoice/Factory/createInvoiceFromOrder": {},
  "POST /Invoice/Factory/createInvoiceReminder": { q: { "invoice[id]": { t: "integer", r: 1 }, "invoice[objectName]": { t: "string", r: 1 } } },
  "GET /Invoice/{invoiceId}/getIsPartiallyPaid": { p: ["invoiceId"] },
  "POST /Invoice/{invoiceId}/cancelInvoice": { p: ["invoiceId"] },
  "POST /Invoice/{invoiceId}/render": { p: ["invoiceId"] },
  "POST /Invoice/{invoiceId}/sendViaEmail": { p: ["invoiceId"] },
  "GET /Invoice/{invoiceId}/getPdf": { p: ["invoiceId"], q: { "download": { t: "boolean" }, "preventSendBy": { t: "boolean" } } },
  "GET /Invoice/{invoiceId}/getXml": { p: ["invoiceId"] },
  "PUT /Invoice/{invoiceId}/sendBy": { p: ["invoiceId"] },
  "PUT /Invoice/{invoiceId}/enshrine": { p: ["invoiceId"] },
  "PUT /Invoice/{invoiceId}/bookAmount": { p: ["invoiceId"] },
  "PUT /Invoice/{invoiceId}/resetToOpen": { p: ["invoiceId"] },
  "PUT /Invoice/{invoiceId}/resetToDraft": { p: ["invoiceId"] },
  "GET /InvoicePos": { q: { "id": { t: "number" }, "invoice[id]": { t: "number" }, "invoice[objectName]": { t: "string" }, "part[id]": { t: "number" }, "part[objectName]": { t: "string" } } },
  "GET /DocServer/getLetterpapersWithThumb": {},
  "GET /DocServer/getTemplatesWithThumb": { q: { "type": { t: "string", e: ["Invoice", "invoicereminder", "Order", "Contractnote", "Packinglist", "Letter", "Creditnote"] } } },
  "PUT /Invoice/{invoiceId}/changeParameter": { p: ["invoiceId"] },
  "PUT /Order/{orderId}/changeParameter": { p: ["orderId"] },
  "PUT /CreditNote/{creditNoteId}/changeParameter": { p: ["creditNoteId"] },
  "GET /Order": { q: { "status": { t: "integer", e: [100, 200, 300, 500, 750, 1e3] }, "orderNumber": { t: "string" }, "startDate": { t: "integer" }, "endDate": { t: "integer" }, "contact[id]": { t: "integer" }, "contact[objectName]": { t: "string" } } },
  "POST /Order/Factory/saveOrder": {},
  "GET /Order/{orderId}": { p: ["orderId"] },
  "PUT /Order/{orderId}": { p: ["orderId"] },
  "DELETE /Order/{orderId}": { p: ["orderId"] },
  "GET /Order/{orderId}/getPositions": { p: ["orderId"], q: { "limit": { t: "integer" }, "offset": { t: "integer" }, "embed": { t: "array" } } },
  "GET /Order/{orderId}/getDiscounts": { p: ["orderId"], q: { "limit": { t: "integer" }, "offset": { t: "integer" }, "embed": { t: "array" } } },
  "GET /Order/{orderId}/getRelatedObjects": { p: ["orderId"], q: { "includeItself": { t: "boolean" }, "sortByType": { t: "boolean" }, "embed": { t: "array" } } },
  "POST /Order/{orderId}/sendViaEmail": { p: ["orderId"] },
  "POST /Order/Factory/createPackingListFromOrder": { q: { "order[id]": { t: "integer", r: 1 }, "order[objectName]": { t: "string", r: 1 } } },
  "POST /Order/Factory/createContractNoteFromOrder": { q: { "order[id]": { t: "integer", r: 1 }, "order[objectName]": { t: "string", r: 1 } } },
  "GET /Order/{orderId}/getPdf": { p: ["orderId"], q: { "download": { t: "boolean" }, "preventSendBy": { t: "boolean" } } },
  "PUT /Order/{orderId}/sendBy": { p: ["orderId"] },
  "GET /OrderPos": { q: { "order[id]": { t: "integer" }, "order[objectName]": { t: "string" } } },
  "GET /OrderPos/{orderPosId}": { p: ["orderPosId"] },
  "PUT /OrderPos/{orderPosId}": { p: ["orderPosId"] },
  "DELETE /OrderPos/{orderPosId}": { p: ["orderPosId"] },
  "POST /Voucher/Factory/saveVoucher": {},
  "POST /Voucher/Factory/uploadTempFile": {},
  "GET /Voucher": { q: { "status": { t: "number", e: [50, 100, 1e3] }, "creditDebit": { t: "string", e: ["C", "D"] }, "descriptionLike": { t: "string" }, "startDate": { t: "integer" }, "endDate": { t: "integer" }, "contact[id]": { t: "integer" }, "contact[objectName]": { t: "string" } } },
  "GET /Voucher/{voucherId}": { p: ["voucherId"] },
  "PUT /Voucher/{voucherId}": { p: ["voucherId"] },
  "PUT /Voucher/{voucherId}/enshrine": { p: ["voucherId"] },
  "PUT /Voucher/{voucherId}/bookAmount": { p: ["voucherId"] },
  "PUT /Voucher/{voucherId}/resetToOpen": { p: ["voucherId"] },
  "PUT /Voucher/{voucherId}/resetToDraft": { p: ["voucherId"] },
  "GET /VoucherPos": { q: { "voucher[id]": { t: "integer" }, "voucher[objectName]": { t: "string" } } },
  "GET /ReceiptGuidance/forAllAccounts": {},
  "GET /ReceiptGuidance/forAccountNumber": { q: { "accountNumber": { t: "integer", r: 1 } } },
  "GET /ReceiptGuidance/forTaxRule": { q: { "taxRule": { t: "string", r: 1 } } },
  "GET /ReceiptGuidance/forRevenue": {},
  "GET /ReceiptGuidance/forExpense": {},
  "GET /Report/invoicelist": { q: { "download": { t: "boolean" }, "view": { t: "string", r: 1 }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Report/orderlist": { q: { "download": { t: "boolean" }, "view": { t: "string", r: 1 }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Report/contactlist": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Report/voucherlist": { q: { "download": { t: "boolean" }, "sevQuery": { t: "object", r: 1 } } },
  "GET /Tag": { q: { "id": { t: "number" }, "name": { t: "string" } } },
  "GET /Tag/{tagId}": { p: ["tagId"] },
  "PUT /Tag/{tagId}": { p: ["tagId"] },
  "DELETE /Tag/{tagId}": { p: ["tagId"] },
  "POST /Tag/Factory/create": {},
  "GET /TagRelation": {}
};

// servers/sevdesk/src/client.ts
var SEVDESK_BASE = "https://my.sevdesk.de/api/v1";
var MIN_INTERVAL_MS = 250;
var MAX_RETRIES = 3;
var GLOBAL_QUERY = /* @__PURE__ */ new Set(["limit", "offset", "countAll", "embed"]);
var UNDOCUMENTED_QUERY = {
  "GET /ContactAddress": ["contact[id]", "contact[objectName]"]
};
var PAGE_SIZE = 100;
var SevdeskError = class extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
    this.name = "SevdeskError";
  }
};
var ref = (objectName, id) => ({
  id: typeof id === "string" ? id : String(id),
  objectName
});
function refQuery(field, objectName, id) {
  if (id === void 0 || id === null || id === "") return {};
  return { [`${field}[id]`]: id, [`${field}[objectName]`]: objectName };
}
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
function fillPath(template, spec, values) {
  for (const name of spec.p ?? []) {
    if (values[name] === void 0 || values[name] === null || values[name] === "") {
      throw new SevdeskError(`Pfadparameter '${name}' fehlt f\xFCr ${template}.`);
    }
  }
  return template.replace(
    /\{(\w+)\}/g,
    (_m, name) => encodeURIComponent(String(values[name]))
  );
}
function checkQuery(key, spec, query) {
  for (const [name, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    if (GLOBAL_QUERY.has(name)) continue;
    if (UNDOCUMENTED_QUERY[key]?.includes(name)) continue;
    const def = spec.q?.[name];
    if (!def) {
      const known = [...Object.keys(spec.q ?? {}), ...GLOBAL_QUERY].sort().join(", ");
      throw new SevdeskError(
        `Query-Parameter '${name}' kennt ${key} nicht. sevdesk w\xFCrde ihn stillschweigend ignorieren und ungefiltert antworten. Bekannt: ${known || "keine"}.`
      );
    }
    if (def.e && !def.e.some((allowed) => String(allowed) === String(value))) {
      throw new SevdeskError(
        `'${value}' ist kein erlaubter Wert f\xFCr ${name} bei ${key}. Erlaubt: ${def.e.join(", ")}.`
      );
    }
  }
}
var Sevdesk = class {
  constructor(token) {
    this.token = token;
  }
  calls = 0;
  async throttle() {
    const slot = slotFor(this.token);
    const now = Date.now();
    const wait = Math.max(0, slot.nextAt - now);
    slot.nextAt = Math.max(now, slot.nextAt) + MIN_INTERVAL_MS;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  /**
   * Ein Aufruf gegen sevdesk. `template` ist der Pfad AUS DER BESCHREIBUNG, also mit
   * Platzhaltern ("/Invoice/{invoiceId}") — nur so lässt sich der Aufruf prüfen.
   */
  request(method, template, opts = {}) {
    const key = `${method} ${template}`;
    const spec = OPERATIONS[key];
    if (!spec) {
      throw new SevdeskError(
        `${key} steht nicht in der sevdesk-Beschreibung. Entweder ist der Pfad falsch geschrieben oder der Endpunkt existiert nicht.`
      );
    }
    const query = opts.query ?? {};
    checkQuery(key, spec, query);
    const path = fillPath(template, spec, opts.path ?? {});
    const run = async () => {
      const url = new URL(SEVDESK_BASE + path);
      for (const [k, v] of Object.entries(query)) {
        if (v !== void 0 && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
      const headers = {
        // Ohne "Bearer" — sevdesk erwartet den nackten Token.
        Authorization: this.token,
        Accept: opts.accept ?? "application/json",
        // Die Doku bittet ausdrücklich um einen sprechenden User-Agent.
        "User-Agent": "mcpees-sevdesk-mcp (github.com/ksqsebastian-spec/mcpees)"
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
        const res = await fetch(url.toString(), { method, headers, body });
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1e3 : 1e3 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return res;
      }
    };
    const slot = slotFor(this.token);
    const queued = slot.chain.then(run, run);
    slot.chain = queued.catch(() => void 0);
    return queued;
  }
  /** Aufruf + JSON-Antwort, ohne die `objects`-Hülle. */
  async call(method, template, opts = {}) {
    const res = await this.request(method, template, opts);
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
      }
      throw new SevdeskError(explain(res.status, `${method} ${template}`, detail), detail);
    }
    if (!text) return void 0;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SevdeskError(`sevdesk lieferte kein JSON f\xFCr ${template}`, text.slice(0, 300));
    }
    return parsed && typeof parsed === "object" && "objects" in parsed ? parsed.objects : parsed;
  }
  /** Wie `call`, aber mit der Gesamtzahl aus `countAll`. */
  async callWithTotal(method, template, opts = {}) {
    const res = await this.request(method, template, opts);
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 800);
      try {
        detail = JSON.parse(text);
      } catch {
      }
      throw new SevdeskError(explain(res.status, `${method} ${template}`, detail), detail);
    }
    const parsed = text ? JSON.parse(text) : {};
    const objects = Array.isArray(parsed?.objects) ? parsed.objects : [];
    const total = parsed?.total === void 0 ? null : Number(parsed.total);
    return { objects, total: Number.isFinite(total) ? total : null };
  }
  /**
   * Alle Seiten einer Liste holen.
   *
   * `maxItems` begrenzt sichtbar: das Ergebnis sagt, ob abgeschnitten wurde. Eine gekappte
   * Liste, die wie eine vollständige aussieht, ist eine falsche Antwort.
   */
  async paginate(template, query, maxItems = 200) {
    const want = Math.max(1, maxItems);
    const size = Math.min(PAGE_SIZE, want);
    const items = [];
    let total = null;
    let pages = 0;
    for (let offset = 0; ; offset += size) {
      const page2 = await this.callWithTotal("GET", template, {
        query: { ...query, limit: size, offset, countAll: true }
      });
      pages++;
      items.push(...page2.objects);
      if (page2.total !== null) total = page2.total;
      if (items.length >= want) break;
      if (page2.objects.length < size) break;
      if (pages > 40) break;
    }
    const kept = items.slice(0, want);
    const truncated = total !== null ? total > kept.length : items.length > kept.length || pages > 40;
    return { items: kept, total, truncated, pages };
  }
  /**
   * Prüft den Token und liefert zurück, in welcher Buchhaltungswelt das Konto lebt.
   *
   * Das ist keine Zierde: mit dem sevdesk-Update 2.0 hat `taxRule` das alte `taxType`
   * abgelöst. Wer die falsche Angabe schickt, bekommt 422 — oder, schlimmer, einen Beleg
   * mit falscher Steuerregel. Deshalb steht die Version schon beim Verbinden fest.
   */
  async whoami() {
    const v = await this.call("GET", "/Tools/bookkeepingSystemVersion");
    const version = String(v?.version ?? "");
    if (version !== "1.0" && version !== "2.0") {
      throw new SevdeskError(
        "sevdesk antwortet auf die Versionsabfrage nicht wie erwartet. Ist der Token vollst\xE4ndig (32 Hexzeichen) und aus dem richtigen Konto?",
        v
      );
    }
    const accounts = await this.call("GET", "/CheckAccount", { query: { limit: 100 } });
    return { version, accounts: Array.isArray(accounts) ? accounts.length : 0 };
  }
};
function explain(status, op, detail) {
  const message = typeof detail === "object" && detail !== null ? detail.error?.message ?? detail.message ?? "" : "";
  const suffix = message ? ` sevdesk sagt: ${String(message).slice(0, 300)}` : "";
  switch (status) {
    case 401:
      return `sevdesk lehnt den Token ab (401). Der Token geh\xF6rt zu keinem aktiven Benutzer mehr.${suffix}`;
    case 403:
      return `Keine Berechtigung f\xFCr ${op} (403). Der Benutzer hinter dem Token darf das nicht.${suffix}`;
    case 404:
      return `Nicht gefunden: ${op} (404).${suffix}`;
    case 422:
      return `sevdesk weist die Daten zur\xFCck (422) bei ${op}. Typischerweise passen Steuerregel, Steuersatz und Buchungskonto nicht zusammen \u2014 'booking_accounts' zeigt die erlaubten Kombinationen.${suffix}`;
    case 429:
      return `sevdesk drosselt (429) bei ${op} \u2014 auch nach mehreren Wiederholungen. Die Grenze gilt pro Minute und ist nicht ver\xF6ffentlicht; kleineres limit oder engerer Zeitraum hilft.${suffix}`;
    case 500:
      return `sevdesk meldet einen internen Fehler (500) bei ${op}. Die Doku sagt selbst, dass dahinter oft ein nicht abgefangener Eingabefehler steckt \u2014 Werte pr\xFCfen.${suffix}`;
    default:
      return `sevdesk HTTP ${status} bei ${op}.${suffix}`;
  }
}

// servers/sevdesk/src/files.ts
var MAX_MINUTES = 60 * 24;
var PDF_PATHS = {
  invoice: "/Invoice/{invoiceId}/getPdf",
  order: "/Order/{orderId}/getPdf",
  creditnote: "/CreditNote/{creditNoteId}/getPdf"
};
var PDF_PARAM = {
  invoice: "invoiceId",
  order: "orderId",
  creditnote: "creditNoteId"
};
async function createFileLink(kv, credential, doc, minutes) {
  const ttl = Math.max(1, Math.min(MAX_MINUTES, Math.round(minutes)));
  const token = randomToken("smcp_dl_");
  await kv.put(
    `dl:${await sha256hex(token)}`,
    JSON.stringify({
      sealed: await sealJSON(token, { credential }),
      docType: doc.docType,
      id: String(doc.id),
      filename: doc.filename
    }),
    { expirationTtl: ttl * 60 }
  );
  return { token, expiresInMinutes: ttl };
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  const template = PDF_PATHS[rec.docType];
  if (!template) return new Response("Unbekannte Belegart.", { status: 404 });
  let doc;
  try {
    doc = await new Sevdesk(credential).call("GET", template, {
      path: { [PDF_PARAM[rec.docType]]: rec.id },
      // preventSendBy: Das Abrufen des PDFs setzt bei sevdesk sonst das Versanddatum —
      // ein Download würde den Beleg als versendet markieren. Lesen darf nichts verändern.
      query: { preventSendBy: true }
    });
  } catch (err) {
    return new Response(`sevdesk liefert die Datei nicht aus: ${err.message}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  const content = doc?.content;
  if (typeof content !== "string") {
    return new Response("sevdesk hat kein PDF zur\xFCckgegeben.", { status: 502 });
  }
  const bytes = doc?.base64encoded === false ? new TextEncoder().encode(content) : fromBase64(content);
  const filename = String(doc?.filename || rec.filename || "beleg.pdf");
  return new Response(bytes, {
    headers: {
      "content-type": String(doc?.mimeType || "application/pdf"),
      "content-disposition": `inline; filename="${filename.replace(/["\\]/g, "")}"`,
      // Der Link ist ein Geheimnis: nirgends zwischenspeichern.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

// servers/sevdesk/src/defaults.ts
var TTL_SECONDS = 12 * 60 * 60;
function idOf(value) {
  if (value && typeof value === "object" && "id" in value) {
    const id = value.id;
    return id === void 0 || id === null ? null : String(id);
  }
  return null;
}
async function learn(sev) {
  const version = (await sev.call("GET", "/Tools/bookkeepingSystemVersion"))?.version ?? "";
  const quelle = [];
  const out = {
    version: String(version),
    contactPersonId: null,
    unityId: null,
    countryId: null,
    smallSettlement: null,
    currency: "EUR",
    quelle
  };
  const invoices = await sev.call("GET", "/Invoice", {
    query: { limit: 1, embed: "contactPerson,addressCountry" }
  });
  const invoice = Array.isArray(invoices) ? invoices[0] : null;
  if (invoice) {
    out.contactPersonId = idOf(invoice.contactPerson);
    out.countryId = idOf(invoice.addressCountry);
    if (invoice.currency) out.currency = String(invoice.currency);
    if (invoice.smallSettlement !== void 0) {
      out.smallSettlement = invoice.smallSettlement === true || invoice.smallSettlement === "1";
    }
    quelle.push(`Rechnung ${invoice.invoiceNumber ?? invoice.id}`);
  }
  if (!out.contactPersonId) {
    const orders = await sev.call("GET", "/Order", {
      query: { limit: 1, embed: "contactPerson,addressCountry" }
    });
    const order = Array.isArray(orders) ? orders[0] : null;
    if (order) {
      out.contactPersonId = idOf(order.contactPerson);
      out.countryId ??= idOf(order.addressCountry);
      quelle.push(`Auftrag ${order.orderNumber ?? order.id}`);
    }
  }
  const parts = await sev.call("GET", "/Part", { query: { limit: 1, embed: "unity" } });
  const part = Array.isArray(parts) ? parts[0] : null;
  if (part && idOf(part.unity)) {
    out.unityId = idOf(part.unity);
    quelle.push(`Artikel ${part.partNumber ?? part.id}`);
  } else {
    const pos = await sev.call("GET", "/InvoicePos", { query: { limit: 1, embed: "unity" } });
    const first = Array.isArray(pos) ? pos[0] : null;
    if (first && idOf(first.unity)) {
      out.unityId = idOf(first.unity);
      quelle.push("Rechnungsposition");
    }
  }
  return out;
}
async function accountDefaults(sev, kv, salt) {
  const key = `sevdefaults:${await sha256hex(salt)}`;
  const cached = await kv.get(key, "json");
  if (cached) return cached;
  const fresh = await learn(sev);
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: TTL_SECONDS });
  return fresh;
}
function needId(defaults, field, override) {
  if (override !== void 0 && override !== null && override !== "") return String(override);
  const value = defaults[field];
  if (value) return value;
  const hinweis = {
    contactPersonId: "Kontaktperson (SevUser). sevdesk hat keinen Endpunkt, der Benutzer auflistet \u2014 die ID wird sonst aus der neuesten Rechnung oder dem neuesten Auftrag gelesen. Dieses Konto hat weder das eine noch das andere.",
    unityId: "Einheit (Unity). sevdesk hat keinen Endpunkt, der Einheiten auflistet \u2014 die ID wird sonst aus einem vorhandenen Artikel oder einer Rechnungsposition gelesen. Dieses Konto hat weder das eine noch das andere.",
    countryId: "Land (StaticCountry). sevdesk hat keinen Endpunkt, der L\xE4nder auflistet \u2014 die ID wird sonst aus der neuesten Rechnung gelesen. Dieses Konto hat keine."
  };
  throw new SevdeskError(
    `Es fehlt die ${hinweis[field]} Entweder in sevdesk einmal von Hand einen solchen Beleg anlegen, oder die ID hier direkt mitgeben.`
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

// servers/sevdesk/src/tools/read.ts
var money = (v) => {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
var sum = (rows, field) => Math.round(rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) * 100) / 100;
function unixDay(value, name, endOfDay = false) {
  if (value === void 0 || value === null || value === "") return void 0;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new SevdeskError(`${name} muss 'YYYY-MM-DD' sein, war '${s}'.`);
  }
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(ms)) throw new SevdeskError(`${name} ist kein g\xFCltiges Datum: '${s}'.`);
  return Math.floor(ms / 1e3) + (endOfDay ? 86399 : 0);
}
function isoDay(value) {
  if (value === void 0 || value === null || value === "") return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1e3).toISOString().slice(0, 10);
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}
var limitOf = (args, fallback, max = 500) => Math.min(max, Math.max(1, Number(args.limit) || fallback));
var nested = (o, ...names) => {
  if (!o || typeof o !== "object") return null;
  for (const n of names) if (o[n]) return String(o[n]);
  return o.id ? `#${o.id}` : null;
};
var INVOICE_STATUS = {
  "50": "Entwurf (nicht verschickt)",
  "100": "Entwurf",
  "200": "offen / verschickt",
  "750": "teilweise bezahlt",
  "1000": "bezahlt"
};
var VOUCHER_STATUS = {
  "50": "Entwurf",
  "100": "offen / f\xE4llig",
  "1000": "bezahlt"
};
var ORDER_STATUS = {
  "100": "Entwurf",
  "200": "verschickt",
  "300": "abgelehnt",
  "500": "angenommen",
  "750": "teilweise berechnet",
  "1000": "berechnet"
};
var label = (map, status) => map[String(status)] ?? `unbekannt (${status})`;
function invoiceRow(inv) {
  return {
    id: inv.id,
    nr: inv.invoiceNumber ?? null,
    typ: inv.invoiceType ?? null,
    status: label(INVOICE_STATUS, inv.status),
    status_code: inv.status ?? null,
    datum: isoDay(inv.invoiceDate),
    kunde: nested(inv.contact, "name", "familyname"),
    contactId: inv.contact?.id ?? null,
    netto: money(inv.sumNet),
    brutto: money(inv.sumGross),
    bezahlt: money(inv.paidAmount),
    offen: Math.round(((Number(inv.sumGross) || 0) - (Number(inv.paidAmount) || 0)) * 100) / 100,
    waehrung: inv.currency ?? null,
    zahlungsziel_tage: inv.timeToPay ?? null
  };
}
var readTools = [
  {
    name: "system_info",
    title: "Konto und Buchhaltungsversion",
    description: "Zeigt, mit welchem sevdesk-Konto gesprochen wird und in welcher Buchhaltungswelt es lebt. Das ist kein Beiwerk: seit dem sevdesk-Update 2.0 hei\xDFt die Steuerregel taxRule und nicht mehr taxType. Wer beim Anlegen die falsche schickt, bekommt 422 oder einen Beleg mit falscher Steuerregel. Guter erster Aufruf. Nennt au\xDFerdem die Bankkonten und die n\xE4chste freie Kundennummer.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async handler(_args, ctx) {
      const version = (await ctx.sev.call("GET", "/Tools/bookkeepingSystemVersion"))?.version;
      const accounts = await ctx.sev.call("GET", "/CheckAccount", { query: { limit: 100 } });
      const next = await ctx.sev.call("GET", "/Contact/Factory/getNextCustomerNumber");
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      return {
        buchhaltungsversion: String(version ?? "unbekannt"),
        steuerangabe: String(version) === "2.0" ? "taxRule (Objekt mit id) \u2014 taxType ist abgel\xF6st" : "taxType (default/eu/noteu/ss) \u2014 taxRule gibt es hier noch nicht",
        naechste_kundennummer: typeof next === "string" || typeof next === "number" ? next : null,
        waehrung: defaults.currency,
        kleinunternehmer: defaults.smallSettlement,
        bankkonten: (accounts ?? []).map((a) => ({
          id: a.id,
          name: a.name ?? null,
          typ: a.type ?? null,
          iban: a.iban ?? null,
          waehrung: a.currency ?? null,
          status: a.status ?? null
        })),
        vorgaben_fuers_anlegen: {
          kontaktperson_id: defaults.contactPersonId,
          einheit_id: defaults.unityId,
          land_id: defaults.countryId,
          gelernt_aus: defaults.quelle,
          hinweis: "sevdesk hat keine Endpunkte, die Benutzer, Einheiten oder L\xE4nder auflisten. Diese IDs stammen aus vorhandenen Belegen des Kontos."
        }
      };
    }
  },
  {
    name: "search_contacts",
    title: "Kontakte suchen",
    description: "Kontakte auflisten oder suchen. Wichtig zu wissen: sevdesk dokumentiert f\xFCr die Kontaktliste nur den Filter customerNumber. Eine Namenssuche gibt es dort nicht \u2014 dieser Server holt deshalb Seiten und filtert den Namen selbst. Bei gro\xDFen Adressbest\xE4nden also lieber die Kundennummer nehmen oder limit erh\xF6hen. Das Ergebnis sagt, wie gefiltert wurde.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Name, Firma oder Nachname \u2014 Teiltreffer, Gro\xDF-/Kleinschreibung egal. Wird lokal gefiltert."),
        customer_number: str("Kundennummer. Wird von sevdesk selbst gefiltert und ist damit exakt."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const needle = args.name ? String(args.name).toLowerCase() : null;
      const fetchMax = needle ? Math.max(limit, 500) : limit;
      const res = await ctx.sev.paginate(
        "/Contact",
        { customerNumber: args.customer_number, depth: "1" },
        fetchMax
      );
      const all = res.items.map((c) => ({
        id: c.id,
        kundennummer: c.customerNumber ?? null,
        name: c.name || [c.surename, c.familyname].filter(Boolean).join(" ") || `#${c.id}`,
        typ: c.name ? "Firma" : "Person",
        kategorie: nested(c.category, "name"),
        status: c.status ?? null,
        ust_id: c.vatNumber ?? null,
        steuernummer: c.taxNumber ?? null,
        zahlungsziel_tage: c.defaultTimeToPay ?? null
      }));
      const hits = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;
      return {
        gefiltert: needle ? "Name lokal, Kundennummer von sevdesk" : "von sevdesk",
        anzahl: Math.min(hits.length, limit),
        gesamt_im_konto: res.total,
        durchsucht: all.length,
        ...needle && res.truncated ? {
          hinweis: `Es wurden ${all.length} von ${res.total ?? "?"} Kontakten durchsucht. Weiter hinten k\xF6nnten weitere Treffer liegen.`
        } : {},
        kontakte: hits.slice(0, limit)
      };
    }
  },
  {
    name: "get_contact",
    title: "Kontakt im Detail",
    description: "Ein Kontakt mit Adressen und Kommunikationswegen. Adressen und Telefon/E-Mail sind bei sevdesk eigene Objekte und stehen NICHT am Kontakt \u2014 dieser Aufruf holt sie mit.",
    inputSchema: {
      type: "object",
      properties: { contact_id: int("Die Kontakt-ID aus search_contacts.") },
      required: ["contact_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "contact_id");
      const list = await ctx.sev.call("GET", "/Contact/{contactId}", {
        path: { contactId: id },
        query: { embed: "category,parent" }
      });
      const c = Array.isArray(list) ? list[0] : list;
      if (!c) throw new SevdeskError(`Kontakt ${id} gibt es nicht.`);
      const rawAddresses = await ctx.sev.call("GET", "/ContactAddress", {
        query: { ...refQuery("contact", "Contact", id), limit: 50, embed: "country,contact" }
      });
      const addresses = (rawAddresses ?? []).filter(
        (a) => !a.contact?.id || String(a.contact.id) === String(id)
      );
      const ways = await ctx.sev.call("GET", "/CommunicationWay", {
        query: { ...refQuery("contact", "Contact", id), limit: 50 }
      });
      return {
        id: c.id,
        kundennummer: c.customerNumber ?? null,
        name: c.name || [c.surename, c.familyname].filter(Boolean).join(" "),
        typ: c.name ? "Firma" : "Person",
        kategorie: nested(c.category, "name"),
        beschreibung: c.description ?? null,
        ust_id: c.vatNumber ?? null,
        steuernummer: c.taxNumber ?? null,
        iban: c.bankAccount ?? null,
        zahlungsziel_tage: c.defaultTimeToPay ?? null,
        skonto_prozent: c.defaultCashbackPercent ?? null,
        adressen: (addresses ?? []).map((a) => ({
          id: a.id,
          strasse: a.street ?? null,
          plz: a.zip ?? null,
          ort: a.city ?? null,
          land: nested(a.country, "name", "code"),
          name: a.name ?? null
        })),
        kontaktwege: (ways ?? []).map((w) => ({
          typ: w.type ?? null,
          wert: w.value ?? null,
          haupt: w.main === "1" || w.main === true
        }))
      };
    }
  },
  {
    name: "search_invoices",
    title: "Rechnungen suchen",
    description: "Ausgangsrechnungen suchen. Nach Status filtern geht nur mit 100 (Entwurf), 200 (offen/verschickt) und 1000 (bezahlt) \u2014 die Rechnungen selbst k\xF6nnen auch 50 und 750 (teilweise bezahlt) haben, danach l\xE4sst sich aber nicht filtern. Die Kundennamen werden mitgeholt; ohne das st\xFCnde an jeder Rechnung nur eine ID.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("100 = Entwurf, 200 = offen/verschickt, 1000 = bezahlt."),
        contact_id: int("Nur Rechnungen dieses Kunden."),
        invoice_number: str("Nach Rechnungsnummer suchen."),
        date_from: str("Rechnungsdatum ab 'YYYY-MM-DD'."),
        date_to: str("Rechnungsdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate(
        "/Invoice",
        {
          status: args.status,
          invoiceNumber: args.invoice_number,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.contact_id),
          embed: "contact"
        },
        limit
      );
      const rows = res.items.map(invoiceRow);
      return {
        anzahl: rows.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...res.truncated ? { hinweis: `Es gibt mehr als ${limit} Treffer. Zeitraum eingrenzen oder limit erh\xF6hen.` } : {},
        summe_netto: sum(res.items, "sumNet"),
        summe_brutto: sum(res.items, "sumGross"),
        rechnungen: rows
      };
    }
  },
  {
    name: "get_invoice",
    title: "Rechnung im Detail",
    description: "Eine Rechnung mit allen Positionen, Steuerangaben und Betr\xE4gen. Die Positionen sind ein eigener Aufruf bei sevdesk und werden hier mitgeholt.",
    inputSchema: {
      type: "object",
      properties: { invoice_id: int("Die Rechnungs-ID aus search_invoices.") },
      required: ["invoice_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "invoice_id");
      const list = await ctx.sev.call("GET", "/Invoice/{invoiceId}", {
        path: { invoiceId: id },
        query: { embed: "contact,contactPerson,addressCountry,taxRule" }
      });
      const inv = Array.isArray(list) ? list[0] : list;
      if (!inv) throw new SevdeskError(`Rechnung ${id} gibt es nicht.`);
      const positions = await ctx.sev.call("GET", "/Invoice/{invoiceId}/getPositions", {
        path: { invoiceId: id },
        query: { limit: 500, embed: "unity,part" }
      });
      return {
        ...invoiceRow(inv),
        kopftext: inv.headText ?? null,
        fusstext: inv.footText ?? null,
        anschrift: inv.address ?? null,
        liefer_datum: isoDay(inv.deliveryDate),
        versendet_am: isoDay(inv.sendDate),
        bezahlt_am: isoDay(inv.payDate),
        steuerregel: nested(inv.taxRule, "name") ?? inv.taxType ?? null,
        steuertext: inv.taxText ?? null,
        festgeschrieben: Boolean(inv.enshrined),
        preise_sind: inv.showNet === true || inv.showNet === "1" ? "netto" : "brutto",
        positionen: (positions ?? []).map((p) => ({
          nr: p.positionNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          menge: money(p.quantity),
          einheit: nested(p.unity, "translationCode", "name"),
          einzelpreis: money(p.price),
          steuersatz: money(p.taxRate),
          rabatt: money(p.discount),
          summe_netto: money(p.sumNet),
          summe_brutto: money(p.sumGross),
          artikel_id: p.part?.id ?? null
        }))
      };
    }
  },
  {
    name: "download_document",
    title: "Beleg als PDF",
    description: "Erzeugt einen zeitlich begrenzten Download-Link auf das PDF einer Rechnung, eines Auftrags oder einer Gutschrift. sevdesk liefert PDFs nur als base64 gegen den Token, deshalb stellt dieser Server die Datei \xFCber einen eigenen, nicht erratbaren Link bereit. Der Abruf setzt bewusst preventSendBy \u2014 ein Download darf den Beleg nicht als versendet markieren. Eingangsbelege (Voucher) haben kein PDF \xFCber die API.",
    inputSchema: {
      type: "object",
      properties: {
        doc_type: str(`Belegart \u2014 eine aus: ${Object.keys(PDF_PATHS).join(", ")}`),
        document_id: int("Die ID des Belegs."),
        minutes: int("G\xFCltigkeit des Links in Minuten (1\u20131440, Default 30).")
      },
      required: ["doc_type", "document_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const docType = String(req(args, "doc_type")).toLowerCase();
      if (!PDF_PATHS[docType]) {
        throw new SevdeskError(
          `doc_type '${docType}' kennt dieser Server nicht. Erlaubt: ${Object.keys(PDF_PATHS).join(", ")}.`
        );
      }
      const id = req(args, "document_id");
      const link = await createFileLink(
        ctx.kv,
        ctx.credential,
        { docType, id, filename: `${docType}-${id}.pdf` },
        Number(args.minutes) || 30
      );
      return {
        url: `${ctx.origin}/f/${link.token}`,
        gueltig_minuten: link.expiresInMinutes,
        hinweis: "Der Link ist ein Geheimnis und funktioniert ohne Anmeldung. Entw\xFCrfe haben je nach Konto noch kein PDF."
      };
    }
  },
  {
    name: "search_vouchers",
    title: "Eingangsbelege suchen",
    description: "Belege (Voucher) sind bei sevdesk die Eingangsseite: Lieferantenrechnungen, Quittungen, Kassenbons. creditDebit trennt Einnahme (C) von Ausgabe (D). Status: 50 Entwurf, 100 offen/f\xE4llig, 1000 bezahlt.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("50 = Entwurf, 100 = offen/f\xE4llig, 1000 = bezahlt."),
        credit_debit: str("'C' = Einnahme, 'D' = Ausgabe."),
        supplier_id: int("Nur Belege dieses Lieferanten (Kontakt-ID)."),
        description: str("Teilstring in der Belegbeschreibung (meist die Belegnummer)."),
        date_from: str("Belegdatum ab 'YYYY-MM-DD'."),
        date_to: str("Belegdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate(
        "/Voucher",
        {
          status: args.status,
          creditDebit: args.credit_debit ? String(args.credit_debit).toUpperCase() : void 0,
          descriptionLike: args.description,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.supplier_id),
          embed: "supplier"
        },
        limit
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe_netto: sum(res.items, "sumNet"),
        summe_brutto: sum(res.items, "sumGross"),
        belege: res.items.map((v) => ({
          id: v.id,
          beschreibung: v.description ?? null,
          status: label(VOUCHER_STATUS, v.status),
          status_code: v.status ?? null,
          art: v.creditDebit === "C" ? "Einnahme" : "Ausgabe",
          typ: v.voucherType ?? null,
          datum: isoDay(v.voucherDate),
          faellig_am: isoDay(v.paymentDeadline),
          bezahlt_am: isoDay(v.payDate),
          lieferant: nested(v.supplier, "name", "familyname") ?? v.supplierName ?? null,
          netto: money(v.sumNet),
          brutto: money(v.sumGross),
          bezahlt: money(v.paidAmount)
        }))
      };
    }
  },
  {
    name: "get_voucher",
    title: "Eingangsbeleg im Detail",
    description: "Ein Beleg mit seinen Positionen. Die Positionen tragen das Buchungskonto \u2014 die eigentlich interessante Information an einem Eingangsbeleg.",
    inputSchema: {
      type: "object",
      properties: { voucher_id: int("Die Beleg-ID aus search_vouchers.") },
      required: ["voucher_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "voucher_id");
      const list = await ctx.sev.call("GET", "/Voucher/{voucherId}", {
        path: { voucherId: id },
        query: { embed: "supplier,taxRule,document" }
      });
      const v = Array.isArray(list) ? list[0] : list;
      if (!v) throw new SevdeskError(`Beleg ${id} gibt es nicht.`);
      const positions = await ctx.sev.call("GET", "/VoucherPos", {
        query: {
          ...refQuery("voucher", "Voucher", id),
          limit: 200,
          embed: "accountingType,accountDatev"
        }
      });
      return {
        id: v.id,
        beschreibung: v.description ?? null,
        status: label(VOUCHER_STATUS, v.status),
        art: v.creditDebit === "C" ? "Einnahme" : "Ausgabe",
        datum: isoDay(v.voucherDate),
        liefer_datum: isoDay(v.deliveryDate),
        faellig_am: isoDay(v.paymentDeadline),
        lieferant: nested(v.supplier, "name", "familyname") ?? v.supplierName ?? null,
        steuerregel: nested(v.taxRule, "name") ?? v.taxType ?? null,
        netto: money(v.sumNet),
        steuer: money(v.sumTax),
        brutto: money(v.sumGross),
        bezahlt: money(v.paidAmount),
        festgeschrieben: Boolean(v.enshrined),
        positionen: (positions ?? []).map((p) => ({
          konto: nested(p.accountDatev, "accountNumber", "name") ?? nested(p.accountingType, "name") ?? null,
          kommentar: p.comment ?? null,
          steuersatz: money(p.taxRate),
          netto: money(p.sumNet),
          steuer: money(p.sumTax),
          brutto: money(p.sumGross),
          anlagegut: p.isAsset === true || p.isAsset === "1"
        }))
      };
    }
  },
  {
    name: "search_orders",
    title: "Angebote und Auftr\xE4ge suchen",
    description: "Auftr\xE4ge sind bei sevdesk drei Dinge zugleich: Angebot (AN), Auftragsbest\xE4tigung (AB) und Lieferschein (LI) \u2014 unterschieden \xFCber orderType. Status: 100 Entwurf, 200 verschickt, 300 abgelehnt, 500 angenommen, 750 teilweise berechnet, 1000 berechnet.",
    inputSchema: {
      type: "object",
      properties: {
        status: int("100, 200, 300, 500, 750 oder 1000 \u2014 siehe Beschreibung."),
        contact_id: int("Nur Auftr\xE4ge dieses Kunden."),
        order_number: str("Nach Auftragsnummer suchen."),
        date_from: str("Auftragsdatum ab 'YYYY-MM-DD'."),
        date_to: str("Auftragsdatum bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const res = await ctx.sev.paginate(
        "/Order",
        {
          status: args.status,
          orderNumber: args.order_number,
          startDate: unixDay(args.date_from, "date_from"),
          endDate: unixDay(args.date_to, "date_to", true),
          ...refQuery("contact", "Contact", args.contact_id),
          embed: "contact"
        },
        limit
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe_netto: sum(res.items, "sumNet"),
        auftraege: res.items.map((o) => ({
          id: o.id,
          nr: o.orderNumber ?? null,
          art: o.orderType === "AN" ? "Angebot" : o.orderType === "AB" ? "Auftragsbest\xE4tigung" : o.orderType === "LI" ? "Lieferschein" : o.orderType ?? null,
          status: label(ORDER_STATUS, o.status),
          status_code: o.status ?? null,
          datum: isoDay(o.orderDate),
          kunde: nested(o.contact, "name", "familyname"),
          netto: money(o.sumNet),
          brutto: money(o.sumGross)
        }))
      };
    }
  },
  {
    name: "get_order",
    title: "Auftrag im Detail",
    description: "Ein Angebot, eine Auftragsbest\xE4tigung oder ein Lieferschein mit allen Positionen.",
    inputSchema: {
      type: "object",
      properties: { order_id: int("Die Auftrags-ID aus search_orders.") },
      required: ["order_id"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const id = req(args, "order_id");
      const list = await ctx.sev.call("GET", "/Order/{orderId}", {
        path: { orderId: id },
        query: { embed: "contact,contactPerson,taxRule" }
      });
      const o = Array.isArray(list) ? list[0] : list;
      if (!o) throw new SevdeskError(`Auftrag ${id} gibt es nicht.`);
      const positions = await ctx.sev.call("GET", "/Order/{orderId}/getPositions", {
        path: { orderId: id },
        query: { limit: 500, embed: "unity,part" }
      });
      return {
        id: o.id,
        nr: o.orderNumber ?? null,
        art: o.orderType ?? null,
        status: label(ORDER_STATUS, o.status),
        datum: isoDay(o.orderDate),
        kunde: nested(o.contact, "name", "familyname"),
        kopftext: o.headText ?? null,
        fusstext: o.footText ?? null,
        netto: money(o.sumNet),
        brutto: money(o.sumGross),
        steuerregel: nested(o.taxRule, "name") ?? o.taxType ?? null,
        positionen: (positions ?? []).map((p) => ({
          nr: p.positionNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          menge: money(p.quantity),
          einheit: nested(p.unity, "translationCode", "name"),
          einzelpreis: money(p.price),
          steuersatz: money(p.taxRate),
          summe_netto: money(p.sumNet)
        }))
      };
    }
  },
  {
    name: "search_parts",
    title: "Artikel suchen",
    description: "Artikel und Leistungen aus dem Stamm. Name und Artikelnummer filtert sevdesk selbst. Der Lagerbestand ist ein eigener Aufruf pro Artikel und wird nur auf Wunsch geholt.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Artikelname."),
        part_number: str("Artikelnummer."),
        with_stock: bool("Lagerbestand mitholen. Kostet einen Aufruf pro Artikel \u2014 nur bei wenigen Treffern sinnvoll."),
        limit: int("Maximale Trefferzahl (1\u2013200, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50, 200);
      const res = await ctx.sev.paginate(
        "/Part",
        { name: args.name, partNumber: args.part_number, embed: "unity" },
        limit
      );
      const withStock = args.with_stock === true && res.items.length <= 25;
      const parts = [];
      for (const p of res.items) {
        let stock = money(p.stock);
        if (withStock) {
          const s = await ctx.sev.call("GET", "/Part/{partId}/getStock", {
            path: { partId: p.id }
          });
          stock = money(s);
        }
        parts.push({
          id: p.id,
          nr: p.partNumber ?? null,
          name: p.name ?? null,
          text: p.text ?? null,
          einheit: nested(p.unity, "translationCode", "name"),
          preis_netto: money(p.priceNet ?? p.price),
          preis_brutto: money(p.priceGross),
          einkaufspreis: money(p.pricePurchase),
          steuersatz: money(p.taxRate),
          lagerbestand: stock,
          lager_aktiv: p.stockEnabled === true || p.stockEnabled === "1",
          aktiv: String(p.status) === "100"
        });
      }
      return {
        anzahl: parts.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        ...args.with_stock === true && !withStock ? { hinweis: "Lagerbestand nur bei bis zu 25 Treffern \u2014 sonst w\xE4ren es zu viele Aufrufe." } : {},
        artikel: parts
      };
    }
  },
  {
    name: "check_accounts",
    title: "Bankkonten und Kontost\xE4nde",
    description: "Die Bankkonten des Mandanten. Der Kontostand zu einem Stichtag ist ein eigener Aufruf und wird nur geholt, wenn ein Datum mitgegeben wird.",
    inputSchema: {
      type: "object",
      properties: {
        balance_date: str("Stichtag 'YYYY-MM-DD' f\xFCr den Kontostand. Ohne Angabe kein Saldo.")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const accounts = await ctx.sev.call("GET", "/CheckAccount", { query: { limit: 100 } }) ?? [];
      const day = args.balance_date ? String(args.balance_date) : null;
      if (day) unixDay(day, "balance_date");
      const rows = [];
      for (const a of accounts) {
        let saldo = money(a.balance);
        if (day) {
          const b = await ctx.sev.call("GET", "/CheckAccount/{checkAccountId}/getBalanceAtDate", {
            path: { checkAccountId: a.id },
            query: { date: day }
          });
          saldo = money(b);
        }
        rows.push({
          id: a.id,
          name: a.name ?? null,
          typ: a.type ?? null,
          iban: a.iban ?? null,
          waehrung: a.currency ?? null,
          saldo,
          status: String(a.status) === "100" ? "aktiv" : a.status ?? null
        });
      }
      return { stichtag: day, anzahl: rows.length, konten: rows };
    }
  },
  {
    name: "search_transactions",
    title: "Bankums\xE4tze suchen",
    description: 'Ums\xE4tze auf den Bankkonten. isBooked=false zeigt genau das, was noch keinem Beleg zugeordnet ist \u2014 der \xFCbliche Einstieg f\xFCr \u201Ewas ist noch offen in der Buchhaltung?".',
    inputSchema: {
      type: "object",
      properties: {
        check_account_id: int("Nur Ums\xE4tze dieses Bankkontos."),
        is_booked: bool("true = bereits verbucht, false = noch nicht zugeordnet."),
        only_credit: bool("Nur Eing\xE4nge."),
        only_debit: bool("Nur Ausg\xE4nge."),
        payee: str("Name des Zahlungspartners."),
        purpose: str("Teilstring im Verwendungszweck."),
        date_from: str("Ab 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 50).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 50);
      const from = unixDay(args.date_from, "date_from");
      const to = unixDay(args.date_to, "date_to", true);
      const res = await ctx.sev.paginate(
        "/CheckAccountTransaction",
        {
          isBooked: args.is_booked,
          onlyCredit: args.only_credit,
          onlyDebit: args.only_debit,
          payeePayerName: args.payee,
          paymtPurpose: args.purpose,
          startDate: from === void 0 ? void 0 : String(from),
          endDate: to === void 0 ? void 0 : String(to),
          ...refQuery("checkAccount", "CheckAccount", args.check_account_id),
          embed: "checkAccount"
        },
        limit
      );
      return {
        anzahl: res.items.length,
        gesamt_treffer: res.total,
        abgeschnitten: res.truncated,
        summe: sum(res.items, "amount"),
        umsaetze: res.items.map((t) => ({
          id: t.id,
          datum: isoDay(t.valueDate ?? t.entryDate),
          betrag: money(t.amount),
          partner: t.payeePayerName ?? null,
          zweck: t.paymtPurpose ?? null,
          konto: nested(t.checkAccount, "name"),
          verbucht: String(t.status) === "200" || t.status === 200,
          status: t.status ?? null
        }))
      };
    }
  },
  {
    name: "revenue",
    title: "Umsatz auswerten",
    description: "Umsatz \xFCber einen Zeitraum, aus den Rechnungen gerechnet und nach Monat aufgeteilt. 'gestellt' z\xE4hlt alles, was verschickt oder bezahlt ist; 'bezahlt' nur Bezahltes. Entw\xFCrfe z\xE4hlen nie mit \u2014 sie sind kein Umsatz.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: str("Von 'YYYY-MM-DD'."),
        date_to: str("Bis 'YYYY-MM-DD'."),
        basis: str("'gestellt' (Default) oder 'bezahlt'."),
        limit: int("Wieviele Rechnungen h\xF6chstens einbezogen werden (Default 500).")
      },
      required: ["date_from", "date_to"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const basis = String(args.basis ?? "gestellt").toLowerCase();
      if (basis !== "gestellt" && basis !== "bezahlt") {
        throw new SevdeskError("basis muss 'gestellt' oder 'bezahlt' sein.");
      }
      const limit = Math.min(2e3, Math.max(1, Number(args.limit) || 500));
      const res = await ctx.sev.paginate(
        "/Invoice",
        {
          startDate: unixDay(req(args, "date_from"), "date_from"),
          endDate: unixDay(req(args, "date_to"), "date_to", true),
          embed: "contact"
        },
        limit
      );
      const relevant = res.items.filter((i) => Number(i.status) >= 200);
      const counted = basis === "bezahlt" ? relevant.filter((i) => Number(i.status) === 1e3) : relevant;
      const months = /* @__PURE__ */ new Map();
      for (const inv of counted) {
        const month = (isoDay(inv.invoiceDate) ?? "?").slice(0, 7);
        const m = months.get(month) ?? { netto: 0, brutto: 0, anzahl: 0 };
        m.netto += Number(inv.sumNet) || 0;
        m.brutto += Number(inv.sumGross) || 0;
        m.anzahl++;
        months.set(month, m);
      }
      return {
        zeitraum: { von: args.date_from, bis: args.date_to },
        basis,
        anzahl_rechnungen: counted.length,
        entwuerfe_ausgelassen: res.items.length - relevant.length,
        abgeschnitten: res.truncated,
        ...res.truncated ? { hinweis: `Nur die ersten ${limit} Rechnungen sind eingerechnet \u2014 die Summe ist zu niedrig.` } : {},
        summe_netto: sum(counted, "sumNet"),
        summe_brutto: sum(counted, "sumGross"),
        monate: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([monat, m]) => ({
          monat,
          anzahl: m.anzahl,
          netto: Math.round(m.netto * 100) / 100,
          brutto: Math.round(m.brutto * 100) / 100
        }))
      };
    }
  },
  {
    name: "open_items",
    title: "Offene Posten",
    description: "Rechnungen, die noch nicht vollst\xE4ndig bezahlt sind, nach \xDCberf\xE4lligkeit sortiert. Teilzahlungen z\xE4hlen mit: offen ist Brutto minus paidAmount, nicht der ganze Betrag.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: int("Nur Rechnungen dieses Kunden."),
        overdue_only: bool("Nur \xFCberf\xE4llige."),
        limit: int("Maximale Trefferzahl (1\u2013500, Default 200).")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const limit = limitOf(args, 200);
      const res = await ctx.sev.paginate(
        "/Invoice",
        { status: 200, ...refQuery("contact", "Contact", args.contact_id), embed: "contact" },
        limit
      );
      const today = Date.now();
      const rows = res.items.map((inv) => {
        const brutto = Number(inv.sumGross) || 0;
        const bezahlt = Number(inv.paidAmount) || 0;
        const offen = Math.round((brutto - bezahlt) * 100) / 100;
        const datum = isoDay(inv.invoiceDate);
        const frist = Number(inv.timeToPay) || 0;
        const faellig = datum && frist >= 0 ? new Date(Date.parse(`${datum}T00:00:00Z`) + frist * 864e5).toISOString().slice(0, 10) : null;
        const tage = faellig ? Math.floor((today - Date.parse(`${faellig}T00:00:00Z`)) / 864e5) : null;
        return {
          ...invoiceRow(inv),
          offen,
          faellig_am: faellig,
          tage_ueberfaellig: tage !== null && tage > 0 ? tage : 0
        };
      }).filter((r) => r.offen > 0).filter((r) => args.overdue_only !== true || r.tage_ueberfaellig > 0).sort((a, b) => b.tage_ueberfaellig - a.tage_ueberfaellig);
      return {
        anzahl: rows.length,
        abgeschnitten: res.truncated,
        summe_offen: Math.round(rows.reduce((s, r) => s + r.offen, 0) * 100) / 100,
        summe_ueberfaellig: Math.round(
          rows.filter((r) => r.tage_ueberfaellig > 0).reduce((s, r) => s + r.offen, 0) * 100
        ) / 100,
        hinweis: "Gefiltert wird auf Status 200 (offen). Teilweise bezahlte Rechnungen tragen bei sevdesk Status 750 und sind hier nicht dabei \u2014 sie lassen sich nicht filtern.",
        posten: rows
      };
    }
  },
  {
    name: "booking_accounts",
    title: "Erlaubte Buchungskonten",
    description: "Welche Buchungskonten es gibt und welche Steuerregeln und Steuers\xE4tze dazu passen. Vor jedem create_voucher der richtige Aufruf: sevdesk lehnt eine unpassende Kombination aus Konto, Steuerregel und Steuersatz mit 422 ab, und die Meldung von dort erkl\xE4rt nicht, welche Kombination gegangen w\xE4re. Der Wert h\xE4ngt vom Mandanten ab (Kleinunternehmer sehen andere Regeln).",
    inputSchema: {
      type: "object",
      properties: {
        richtung: str("'ausgabe' (Default), 'einnahme' oder 'alle'."),
        suche: str("Teilstring in Kontonummer, Kontoname oder Beschreibung.")
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async handler(args, ctx) {
      const richtung = String(args.richtung ?? "ausgabe").toLowerCase();
      const path = richtung === "einnahme" ? "/ReceiptGuidance/forRevenue" : richtung === "alle" ? "/ReceiptGuidance/forAllAccounts" : richtung === "ausgabe" ? "/ReceiptGuidance/forExpense" : null;
      if (!path) throw new SevdeskError("richtung muss 'ausgabe', 'einnahme' oder 'alle' sein.");
      const all = await ctx.sev.call("GET", path) ?? [];
      const needle = args.suche ? String(args.suche).toLowerCase() : null;
      const rows = (Array.isArray(all) ? all : []).filter(
        (g) => !needle || `${g.accountNumber} ${g.accountName} ${g.description ?? ""}`.toLowerCase().includes(needle)
      ).map((g) => ({
        konto_id: g.accountDatevId,
        kontonummer: g.accountNumber,
        name: g.accountName,
        beschreibung: g.description ?? null,
        belegarten: g.allowedReceiptTypes ?? [],
        steuerregeln: (g.allowedTaxRules ?? []).map((r) => ({
          id: r.id,
          name: r.description ?? r.name,
          steuersaetze: r.taxRates ?? []
        }))
      }));
      return {
        richtung,
        anzahl: rows.length,
        hinweis: "konto_id geh\xF6rt in create_voucher als konto_id, die id aus steuerregeln als steuerregel_id. Die Steuers\xE4tze stehen als Namen (ZERO, SEVEN, NINETEEN) \u2014 in der Position wird die Zahl gebraucht (0, 7, 19).",
        konten: rows
      };
    }
  }
];

// servers/sevdesk/src/tools/write.ts
var CATEGORIES = { kunde: 3, lieferant: 4, partner: 28 };
var TAX_RULE_DEFAULT = { regel: 1, text: "Umsatzsteuer ausweisen" };
var TAX_RULE_KLEINUNTERNEHMER = { regel: 11, text: "Steuer nicht erhoben nach \xA719 UStG" };
var TAX_TYPES = ["default", "eu", "noteu", "ss"];
function taxFor(version, smallSettlement, args) {
  if (version === "1.0") {
    const type = String(args.steuerart ?? (smallSettlement ? "ss" : "default")).toLowerCase();
    if (!TAX_TYPES.includes(type)) {
      throw new SevdeskError(
        `steuerart '${type}' gibt es nicht. Erlaubt: ${TAX_TYPES.join(", ")}. Dieses Konto l\xE4uft noch auf sevdesk 1.0 und kennt deshalb taxType, nicht taxRule.`
      );
    }
    return {
      body: { taxType: type },
      gewaehlt: `taxType '${type}' (sevdesk 1.0)`,
      taxText: String(args.steuertext ?? (type === "ss" ? TAX_RULE_KLEINUNTERNEHMER.text : TAX_RULE_DEFAULT.text))
    };
  }
  const fallback = smallSettlement ? TAX_RULE_KLEINUNTERNEHMER : TAX_RULE_DEFAULT;
  const id = Number(args.steuerregel_id ?? fallback.regel);
  if (!Number.isInteger(id) || id <= 0) {
    throw new SevdeskError("steuerregel_id muss eine ganze Zahl sein \u2014 siehe booking_accounts.");
  }
  return {
    body: { taxRule: ref("TaxRule", id) },
    gewaehlt: args.steuerregel_id === void 0 ? `taxRule ${id} \u2014 nicht mitgegeben, deshalb die Voreinstellung f\xFCr ${smallSettlement ? "Kleinunternehmer" : "Regelbesteuerung"}. Passende Regeln zeigt booking_accounts.` : `taxRule ${id}`,
    taxText: String(args.steuertext ?? fallback.text)
  };
}
var rounded = (n) => Math.round(n * 100) / 100;
var writeTools = [
  {
    name: "create_contact",
    title: "Kontakt anlegen",
    description: "Legt einen Kunden, Lieferanten oder Partner an. Entweder 'firma' (dann ist es eine Organisation) oder 'vorname'/'nachname' (dann eine Person) \u2014 sevdesk entscheidet den Typ genau daran. Die Kategorie ist Pflicht und l\xE4sst sich sp\xE4ter nicht \xFCber diesen Server \xE4ndern.",
    inputSchema: {
      type: "object",
      properties: {
        kategorie: str(`Eine aus: ${Object.keys(CATEGORIES).join(", ")}.`),
        firma: str("Firmenname. Gesetzt = Organisation."),
        vorname: str("Vorname. Nur f\xFCr Personen."),
        nachname: str("Nachname. Nur f\xFCr Personen."),
        kundennummer: str("Kunden-/Lieferantennummer. Ohne Angabe vergibt sevdesk selbst."),
        beschreibung: str("Freitext zum Kontakt."),
        ust_id: str("Umsatzsteuer-Identifikationsnummer."),
        steuernummer: str("Steuernummer."),
        iban: str("IBAN des Kontakts."),
        zahlungsziel_tage: int("Standard-Zahlungsziel in Tagen.")
      },
      required: ["kategorie"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const kategorie = String(req(args, "kategorie")).toLowerCase();
      const categoryId = CATEGORIES[kategorie];
      if (!categoryId) {
        throw new SevdeskError(
          `kategorie '${kategorie}' gibt es nicht. Erlaubt: ${Object.keys(CATEGORIES).join(", ")}.`
        );
      }
      if (!args.firma && !args.nachname) {
        throw new SevdeskError(
          "Entweder 'firma' (Organisation) oder 'nachname' (Person) muss gesetzt sein. sevdesk leitet den Kontakttyp genau daraus ab; ohne beides entsteht ein Kontakt ohne Namen."
        );
      }
      const created = await ctx.sev.call("POST", "/Contact", {
        body: {
          name: args.firma,
          surename: args.vorname,
          familyname: args.nachname,
          customerNumber: args.kundennummer,
          description: args.beschreibung,
          vatNumber: args.ust_id,
          taxNumber: args.steuernummer,
          bankAccount: args.iban,
          defaultTimeToPay: args.zahlungsziel_tage,
          category: ref("Category", categoryId)
        }
      });
      return {
        angelegt: true,
        id: created?.id ?? null,
        kundennummer: created?.customerNumber ?? null,
        name: created?.name || [created?.surename, created?.familyname].filter(Boolean).join(" "),
        kategorie,
        typ: args.firma ? "Firma" : "Person"
      };
    }
  },
  {
    name: "create_part",
    title: "Artikel anlegen",
    description: "Legt einen Artikel oder eine Leistung im Stamm an. Die Einheit ist bei sevdesk ein eigenes Objekt, f\xFCr das es keinen Endpunkt zum Nachschlagen gibt \u2014 sie wird deshalb aus einem vorhandenen Artikel \xFCbernommen, oder man gibt einheit_id mit. Erlaubte Steuers\xE4tze sind 0, 7 und 19.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("Artikelname."),
        artikelnummer: str("Artikelnummer. Pflicht bei sevdesk."),
        preis_netto: num("Verkaufspreis netto."),
        einkaufspreis: num("Einkaufspreis."),
        steuersatz: num("0, 7 oder 19."),
        text: str("Beschreibung."),
        lagerbestand: num("Anfangsbestand. Default 0."),
        lager_fuehren: bool("Bestandsf\xFChrung einschalten."),
        einheit_id: int("ID der Einheit, falls die gelernte nicht passt."),
        interner_kommentar: str("Interner Kommentar \u2014 erscheint nicht auf Belegen.")
      },
      required: ["name", "artikelnummer", "steuersatz"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const taxRate = Number(req(args, "steuersatz"));
      if (![0, 7, 19].includes(taxRate)) {
        throw new SevdeskError(
          `steuersatz ${taxRate} l\xE4sst sevdesk bei Artikeln nicht zu. Erlaubt sind 0, 7 und 19.`
        );
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const unityId = needId(defaults, "unityId", args.einheit_id);
      const created = await ctx.sev.call("POST", "/Part", {
        body: {
          name: req(args, "name"),
          partNumber: String(req(args, "artikelnummer")),
          text: args.text,
          taxRate,
          unity: ref("Unity", unityId),
          stock: Number(args.lagerbestand ?? 0),
          stockEnabled: args.lager_fuehren === true,
          priceNet: args.preis_netto,
          price: args.preis_netto,
          pricePurchase: args.einkaufspreis,
          internalComment: args.interner_kommentar,
          status: 100
        }
      });
      return {
        angelegt: true,
        id: created?.id ?? null,
        nr: created?.partNumber ?? null,
        name: created?.name ?? null,
        preis_netto: money(created?.priceNet ?? created?.price),
        steuersatz: money(created?.taxRate),
        einheit_id: unityId,
        einheit_gelernt_aus: args.einheit_id ? "mitgegeben" : defaults.quelle.join(", ")
      };
    }
  },
  {
    name: "create_invoice",
    title: "Rechnung als Entwurf anlegen",
    description: "Legt eine Ausgangsrechnung als ENTWURF an (Status 100). Verschickt oder gebucht wird nichts \u2014 das bleibt bewusst in sevdesk. sevdesk verlangt beim Anlegen mehrere IDs, f\xFCr die es keinen Endpunkt zum Nachschlagen gibt (Kontaktperson, Einheit, Land); die werden aus vorhandenen Belegen des Kontos gelesen. Die Antwort sagt, was tats\xE4chlich in der Rechnung gelandet ist \u2014 eine verworfene Position meldet sevdesk sonst nicht.",
    inputSchema: {
      type: "object",
      properties: {
        kontakt_id: int("Kunde, an den die Rechnung geht."),
        positionen: {
          type: "array",
          description: "Die Rechnungszeilen. Je Zeile: name, menge, einzelpreis, steuersatz (0, 7 oder 19), optional text und rabatt (Prozent).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              text: { type: "string" },
              menge: { type: "number" },
              einzelpreis: { type: "number" },
              steuersatz: { type: "number" },
              rabatt: { type: "number" }
            },
            required: ["name", "menge", "einzelpreis", "steuersatz"]
          }
        },
        datum: str("Rechnungsdatum 'YYYY-MM-DD'. Ohne Angabe heute."),
        anschrift: str("Vollst\xE4ndige Anschrift mit Zeilenumbr\xFCchen. Ohne Angabe nimmt sevdesk die des Kontakts."),
        kopftext: str("Text \xFCber den Positionen."),
        fusstext: str("Text unter den Positionen."),
        zahlungsziel_tage: int("Zahlungsziel in Tagen."),
        preise_sind: str("'netto' (Default) oder 'brutto' \u2014 wie einzelpreis zu verstehen ist."),
        steuerregel_id: int("Steuerregel (sevdesk 2.0). Ohne Angabe die Voreinstellung des Kontos \u2014 siehe booking_accounts."),
        steuerart: str("Steuerart (nur sevdesk 1.0): default, eu, noteu, ss."),
        steuertext: str("Text zur Steuerregel, erscheint auf der Rechnung."),
        kontaktperson_id: int("SevUser-ID, falls die gelernte nicht passt."),
        einheit_id: int("Unity-ID, falls die gelernte nicht passt."),
        land_id: int("StaticCountry-ID, falls die gelernte nicht passt."),
        waehrung: str("ISO-4217, z. B. 'EUR'. Ohne Angabe die des Kontos.")
      },
      required: ["kontakt_id", "positionen"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const positionen = req(args, "positionen");
      if (!Array.isArray(positionen) || positionen.length === 0) {
        throw new SevdeskError("Eine Rechnung ohne Positionen legt dieser Server nicht an.");
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const contactPersonId = needId(defaults, "contactPersonId", args.kontaktperson_id);
      const unityId = needId(defaults, "unityId", args.einheit_id);
      const countryId = needId(defaults, "countryId", args.land_id);
      const tax = taxFor(defaults.version, defaults.smallSettlement, args);
      const showNet = String(args.preise_sind ?? "netto").toLowerCase() !== "brutto";
      const heute = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const invoiceDate = unixDay(args.datum ?? heute, "datum");
      const invoicePosSave = positionen.map((p, i) => {
        const taxRate = Number(p.steuersatz);
        if (!Number.isFinite(taxRate)) {
          throw new SevdeskError(`Position ${i + 1}: steuersatz fehlt oder ist keine Zahl.`);
        }
        return {
          objectName: "InvoicePos",
          mapAll: true,
          name: String(p.name),
          text: p.text,
          quantity: Number(p.menge),
          price: Number(p.einzelpreis),
          taxRate,
          discount: p.rabatt === void 0 ? void 0 : Number(p.rabatt),
          unity: ref("Unity", unityId),
          positionNumber: i + 1
        };
      });
      const created = await ctx.sev.call("POST", "/Invoice/Factory/saveInvoice", {
        body: {
          invoice: {
            objectName: "Invoice",
            mapAll: true,
            // Entwurf. sevdesk-Update 2.0 lässt beim Anlegen ohnehin nichts anderes zu.
            status: "100",
            invoiceType: "RE",
            invoiceDate,
            contact: ref("Contact", req(args, "kontakt_id")),
            contactPerson: ref("SevUser", contactPersonId),
            addressCountry: ref("StaticCountry", countryId),
            address: args.anschrift,
            headText: args.kopftext,
            footText: args.fusstext,
            timeToPay: args.zahlungsziel_tage,
            currency: String(args.waehrung ?? defaults.currency),
            discount: 0,
            // Nicht mehr benutzt, aber Pflichtfeld: der Steuersatz steht an den Positionen.
            taxRate: 0,
            taxText: tax.taxText,
            showNet,
            smallSettlement: defaults.smallSettlement ?? void 0,
            ...tax.body
          },
          // Die Beschreibung nennt als Pflichtfeld "invoicePos", kennt aber nur
          // "invoicePosSave" als Eigenschaft. Gültig ist invoicePosSave.
          invoicePosSave
        }
      });
      const id = created?.invoice?.id ?? created?.id;
      if (!id) {
        throw new SevdeskError("sevdesk hat auf das Anlegen keine Rechnungs-ID zur\xFCckgegeben.", created);
      }
      const back = await ctx.sev.call("GET", "/Invoice/{invoiceId}", {
        path: { invoiceId: id }
      });
      const inv = Array.isArray(back) ? back[0] : back;
      const gelandet = await ctx.sev.call("GET", "/Invoice/{invoiceId}/getPositions", {
        path: { invoiceId: id },
        query: { limit: 500 }
      });
      const anzahl = Array.isArray(gelandet) ? gelandet.length : 0;
      return {
        angelegt: true,
        id,
        nr: inv?.invoiceNumber ?? null,
        status: "Entwurf (100) \u2014 nicht verschickt, nicht gebucht",
        datum: isoDay(inv?.invoiceDate),
        netto: money(inv?.sumNet),
        steuer: money(inv?.sumTax),
        brutto: money(inv?.sumGross),
        steuerangabe: tax.gewaehlt,
        preise_sind: showNet ? "netto" : "brutto",
        positionen_geschickt: invoicePosSave.length,
        positionen_gespeichert: anzahl,
        ...anzahl === invoicePosSave.length ? {} : {
          warnung: `Von ${invoicePosSave.length} Positionen sind ${anzahl} in der Rechnung gelandet. sevdesk verwirft ung\xFCltige Positionen ohne Fehlermeldung \u2014 die Rechnung in sevdesk pr\xFCfen.`
        },
        ids_verwendet: {
          kontaktperson: contactPersonId,
          einheit: unityId,
          land: countryId,
          gelernt_aus: defaults.quelle
        }
      };
    }
  },
  {
    name: "create_voucher",
    title: "Eingangsbeleg anlegen",
    description: "Legt einen Eingangsbeleg an (Lieferantenrechnung, Quittung, Kassenbon) \u2014 als Entwurf oder als offen, nie als bezahlt. Jede Position braucht ein Buchungskonto; welche es gibt und welche Steuerregeln und -s\xE4tze dazu passen, zeigt booking_accounts. Passt die Kombination nicht, antwortet sevdesk mit 422. Eine bereits hochgeladene Datei l\xE4sst sich \xFCber 'datei' anh\xE4ngen.",
    inputSchema: {
      type: "object",
      properties: {
        beschreibung: str("Belegbezeichnung, \xFCblicherweise die Belegnummer des Lieferanten."),
        positionen: {
          type: "array",
          description: "Die Buchungszeilen. Je Zeile: konto_id (aus booking_accounts), netto, steuersatz, optional kommentar und anlagegut.",
          items: {
            type: "object",
            properties: {
              konto_id: { type: "integer" },
              netto: { type: "number" },
              steuersatz: { type: "number" },
              kommentar: { type: "string" },
              anlagegut: { type: "boolean" }
            },
            required: ["konto_id", "netto", "steuersatz"]
          }
        },
        lieferant_id: int("Kontakt-ID des Lieferanten."),
        lieferant_name: str("Name des Lieferanten, falls es keinen Kontakt gibt."),
        datum: str("Belegdatum 'YYYY-MM-DD'. Ohne Angabe heute."),
        faellig_am: str("Zahlungsziel 'YYYY-MM-DD'."),
        richtung: str("'ausgabe' (Default) oder 'einnahme'."),
        entwurf: bool("true = Status 50 (Entwurf), sonst 100 (offen). Bezahlt geht hier nicht."),
        steuerregel_id: int("Steuerregel (sevdesk 2.0) \u2014 aus booking_accounts."),
        steuerart: str("Steuerart (nur sevdesk 1.0): default, eu, noteu, ss."),
        datei: str("Dateiname aus upload_voucher_file, um den Scan anzuh\xE4ngen.")
      },
      required: ["beschreibung", "positionen"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const positionen = req(args, "positionen");
      if (!Array.isArray(positionen) || positionen.length === 0) {
        throw new SevdeskError("Ein Beleg ohne Positionen legt dieser Server nicht an.");
      }
      const defaults = await accountDefaults(ctx.sev, ctx.kv, ctx.credential);
      const tax = taxFor(defaults.version, defaults.smallSettlement, args);
      const neu = defaults.version === "2.0";
      const heute = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const voucherPosSave = positionen.map((p, i) => {
        const netto = Number(p.netto);
        const taxRate = Number(p.steuersatz);
        if (!Number.isFinite(netto)) throw new SevdeskError(`Position ${i + 1}: netto fehlt.`);
        if (!Number.isFinite(taxRate)) throw new SevdeskError(`Position ${i + 1}: steuersatz fehlt.`);
        const kontoId = p.konto_id;
        if (kontoId === void 0 || kontoId === null) {
          throw new SevdeskError(
            `Position ${i + 1}: konto_id fehlt. booking_accounts zeigt die erlaubten Konten.`
          );
        }
        return {
          objectName: "VoucherPos",
          mapAll: true,
          // net = true heißt: sumNet gilt, sumGross wird von sevdesk nachgerechnet.
          net: true,
          taxRate,
          sumNet: rounded(netto),
          sumGross: rounded(netto * (1 + taxRate / 100)),
          comment: p.kommentar,
          isAsset: p.anlagegut === true,
          // Die neue Welt bucht auf accountDatev, die alte auf accountingType.
          ...neu ? { accountDatev: ref("AccountDatev", kontoId) } : { accountingType: ref("AccountingType", kontoId) }
        };
      });
      const created = await ctx.sev.call("POST", "/Voucher/Factory/saveVoucher", {
        body: {
          voucher: {
            objectName: "Voucher",
            mapAll: true,
            voucherType: "VOU",
            // 1000 (bezahlt) ist beim Anlegen nicht vorgesehen — und wäre hier auch falsch.
            status: args.entwurf === true ? 50 : 100,
            creditDebit: String(args.richtung ?? "ausgabe").toLowerCase() === "einnahme" ? "C" : "D",
            description: req(args, "beschreibung"),
            voucherDate: unixDay(args.datum ?? heute, "datum"),
            paymentDeadline: unixDay(args.faellig_am, "faellig_am"),
            supplier: args.lieferant_id ? ref("Contact", args.lieferant_id) : null,
            supplierName: args.lieferant_name,
            ...tax.body
          },
          voucherPosSave,
          filename: args.datei
        }
      });
      const id = created?.voucher?.id ?? created?.id;
      if (!id) {
        throw new SevdeskError("sevdesk hat auf das Anlegen keine Beleg-ID zur\xFCckgegeben.", created);
      }
      const back = await ctx.sev.call("GET", "/Voucher/{voucherId}", {
        path: { voucherId: id }
      });
      const v = Array.isArray(back) ? back[0] : back;
      const gelandet = await ctx.sev.call("GET", "/VoucherPos", {
        query: { "voucher[id]": id, "voucher[objectName]": "Voucher", limit: 200 }
      });
      const anzahl = Array.isArray(gelandet) ? gelandet.length : 0;
      return {
        angelegt: true,
        id,
        beschreibung: v?.description ?? null,
        status: args.entwurf === true ? "Entwurf (50)" : "offen (100)",
        art: String(args.richtung ?? "ausgabe").toLowerCase() === "einnahme" ? "Einnahme" : "Ausgabe",
        datum: isoDay(v?.voucherDate),
        netto: money(v?.sumNet),
        steuer: money(v?.sumTax),
        brutto: money(v?.sumGross),
        steuerangabe: tax.gewaehlt,
        datei_angehaengt: args.datei ? true : false,
        positionen_geschickt: voucherPosSave.length,
        positionen_gespeichert: anzahl,
        ...anzahl === voucherPosSave.length ? {} : {
          warnung: `Von ${voucherPosSave.length} Positionen sind ${anzahl} im Beleg gelandet. Das passiert, wenn Konto, Steuerregel und Steuersatz nicht zusammenpassen \u2014 booking_accounts zeigt die erlaubten Kombinationen.`
        }
      };
    }
  },
  {
    name: "upload_voucher_file",
    title: "Belegdatei hochladen",
    description: "L\xE4dt einen Scan oder ein PDF in den Zwischenspeicher von sevdesk. Der zur\xFCckgegebene Dateiname geh\xF6rt anschlie\xDFend als 'datei' in create_voucher \u2014 erst dadurch h\xE4ngt die Datei am Beleg. Ohne diesen zweiten Schritt verf\xE4llt der Upload.",
    inputSchema: {
      type: "object",
      properties: {
        dateiname: str("Dateiname mit Endung, z. B. 'rechnung-4711.pdf'."),
        inhalt_base64: str("Der Dateiinhalt als base64."),
        mime_type: str("z. B. 'application/pdf' oder 'image/jpeg'. Default application/pdf.")
      },
      required: ["dateiname", "inhalt_base64"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, ctx) {
      const name = String(req(args, "dateiname"));
      const b64 = String(req(args, "inhalt_base64")).replace(/\s+/g, "");
      let bytes;
      try {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        throw new SevdeskError("inhalt_base64 ist kein g\xFCltiges base64.");
      }
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: String(args.mime_type ?? "application/pdf") }), name);
      const res = await ctx.sev.call("POST", "/Voucher/Factory/uploadTempFile", { form });
      return {
        hochgeladen: true,
        datei: res?.filename ?? null,
        seiten: res?.pages ?? null,
        mime_type: res?.mimeType ?? null,
        naechster_schritt: "Diesen Dateinamen als 'datei' an create_voucher \xFCbergeben \u2014 sonst bleibt der Upload im Zwischenspeicher liegen und verf\xE4llt."
      };
    }
  }
];

// servers/sevdesk/src/index.ts
var tools = [...readTools, ...writeTools];
var config = {
  brand: {
    name: "sevdesk MCP",
    system: "sevdesk",
    tagline: "Buchhaltung f\xFCr Claude",
    accent: SEVDESK_MARK.accent,
    logoSvg: composeLogo(SEVDESK_MARK),
    icon: SEVDESK_ICON,
    fields: [
      {
        name: "apiToken",
        label: "sevdesk-API-Token",
        placeholder: "32 Hexzeichen"
      }
    ],
    credentialHelp: "Den Token findest du in sevdesk unter <b>Einstellungen \u2192 Benutzer \u2192 dein Benutzer \u2192 API-Token</b>. Er ist 32 Zeichen lang und gilt unbegrenzt. Der Token h\xE4ngt am Benutzer und erbt dessen Rechte \u2014 wer nur lesen lassen will, legt daf\xFCr einen eigenen Benutzer an. Zur\xFCckziehen kannst du den Zugriff jederzeit, indem du in sevdesk einen neuen Token erzeugst; der alte gilt dann nicht mehr.",
    summary: "Model-Context-Protocol-Server f\xFCr sevdesk \u2014",
    bullets: [
      "<b>Lesen</b> \u2014 Kontakte, Rechnungen, Eingangsbelege, Angebote und Auftr\xE4ge, Artikel, Bankkonten und Ums\xE4tze, Umsatzauswertung, offene Posten, erlaubte Buchungskonten, PDF-Links",
      "<b>Anlegen</b> \u2014 Kontakte, Artikel, Rechnungsentw\xFCrfe, Eingangsbelege, Belegdateien",
      "<b>Nicht enthalten</b> \u2014 \xC4ndern, L\xF6schen, Buchen, Versenden, Stornieren und Festschreiben. Festschreiben ist bei sevdesk aus rechtlichen Gr\xFCnden unwiderruflich."
    ]
  },
  serverInfo: {
    name: "sevdesk",
    title: "sevdesk Buchhaltung",
    version: "1.0.0",
    websiteUrl: "https://sevdesk.de"
  },
  scopes: "sevdesk:read sevdesk:write",
  instructions: `sevdesk \u2014 Buchhaltung im Gespr\xE4ch. 21 Tools (Lesen \xB7 Anlegen \xB7 Upload \xB7 Download), kein \xC4ndern, kein L\xF6schen, kein Buchen und kein Versenden. Vier Dinge vorweg: (1) 'system_info' zuerst \u2014 seit dem sevdesk-Update 2.0 hei\xDFt die Steuerregel taxRule statt taxType, und davon h\xE4ngt jedes Anlegen ab. (2) sevdesk trennt Ausgangsrechnungen (Invoice) von Eingangsbelegen (Voucher); \u201ERechnung vom Lieferanten" ist ein Voucher. (3) Vor create_voucher immer 'booking_accounts' aufrufen \u2014 passen Konto, Steuerregel und Steuersatz nicht zusammen, lehnt sevdesk mit 422 ab. (4) Rechnungen entstehen hier immer als Entwurf; verschickt und gebucht wird in sevdesk selbst. Einstieg: \u201Ewer schuldet uns noch was?" (open_items) oder \u201EUmsatz letztes Quartal" (revenue). Datumsangaben immer als 'YYYY-MM-DD'.`,
  tools,
  async validate({ apiToken }) {
    const token = String(apiToken ?? "").trim();
    if (!/^[0-9a-fA-F]{32}$/.test(token)) {
      throw new Error(
        "Der sevdesk-API-Token besteht aus genau 32 Hexzeichen (0\u20139, a\u2013f). Er steht in sevdesk unter Einstellungen \u2192 Benutzer \u2192 API-Token."
      );
    }
    const who = await new Sevdesk(token).whoami();
    return {
      account: `sevdesk ${who.version}`,
      user: who.accounts === 1 ? "1 Bankkonto" : `${who.accounts} Bankkonten`
    };
  },
  async context({ apiToken }, kv, origin) {
    const token = String(apiToken).trim();
    return { sev: new Sevdesk(token), credential: token, kv, origin };
  },
  extraRoutes: serveFile
};
var index_default = createWorker(config);
export {
  index_default as default
};
