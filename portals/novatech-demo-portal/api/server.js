const express = require("express");
const multer = require("multer");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "");
const SUPABASE_DB_SCHEMA = String(process.env.SUPABASE_DB_SCHEMA || "developer_test").trim();
const ENCRYPTION_KEY = String(process.env.NOVATECH_CREDENTIALS_ENCRYPTION_KEY || "");
const ALLOWED_ORIGIN = String(process.env.NOVATECH_ALLOWED_ORIGIN || "https://novatech-demo-portal-test-61nh.onrender.com");
const COOKIE_SECURE = process.env.NODE_ENV !== "development";
const MAX_API_RESPONSE = 1024 * 1024;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function cookie(name, value, maxAge) {
  return name + "=" + encodeURIComponent(value || "") + "; Path=/api; HttpOnly; " +
    (COOKIE_SECURE ? "Secure; " : "") + "SameSite=None; Max-Age=" + maxAge;
}
function clearCookies(res) {
  res.append("Set-Cookie", cookie("novatech_access", "", 0));
  res.append("Set-Cookie", cookie("novatech_refresh", "", 0));
}
function setSessionCookies(res, session) {
  res.append("Set-Cookie", cookie("novatech_access", session.access_token, Math.max(60, Number(session.expires_in || 3600))));
  if (session.refresh_token) res.append("Set-Cookie", cookie("novatech_refresh", session.refresh_token, 60 * 60 * 24 * 30));
}
function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}
function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY));
}

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return jsonError(res, 403, "ORIGIN_NOT_ALLOWED", "Origine non autorisée.");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});
app.use(express.json({ limit: "128kb" }));

const windows = new Map();
function limit(maximum, windowMs) {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = windows.get(key);
    if (!entry || now - entry.start >= windowMs) windows.set(key, { start: now, count: 1 });
    else if (++entry.count > maximum) return jsonError(res, 429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard.");
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of windows) if (value.start < cutoff) windows.delete(key);
}, 10 * 60 * 1000).unref();

async function supabaseFetch(path, options = {}, accessToken = "") {
  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(path.startsWith("/rest/v1/") && !path.startsWith("/rest/v1/rpc/")
        ? (String(options.method || "GET").toUpperCase() === "GET"
          ? { "Accept-Profile": SUPABASE_DB_SCHEMA }
          : { "Content-Profile": SUPABASE_DB_SCHEMA })
        : {}),
      ...(options.headers || {})
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || data?.hint || "Erreur Supabase.");
    error.status = response.status;
    error.code = data?.code || data?.error || "SUPABASE_ERROR";
    throw error;
  }
  return data;
}
async function refreshSession(refreshToken, res) {
  const session = await supabaseFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: refreshToken })
  });
  setSessionCookies(res, session);
  return session.access_token;
}
async function requireUser(req, res, next) {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "Le service de compte NOVATECH n'est pas encore configuré.");
  const cookies = parseCookies(req.headers.cookie || "");
  let token = cookies.novatech_access || "";
  const refresh = cookies.novatech_refresh || "";
  if (!token && !refresh) return jsonError(res, 401, "AUTH_REQUIRED", "Connectez-vous à votre espace développeur.");
  try {
    let user;
    try {
      user = await supabaseFetch("/auth/v1/user", { method: "GET" }, token);
    } catch (error) {
      if (error.status !== 401 || !refresh) throw error;
      token = await refreshSession(refresh, res);
      user = await supabaseFetch("/auth/v1/user", { method: "GET" }, token);
    }
    if (!user?.id || user.is_anonymous) return jsonError(res, 401, "AUTH_REQUIRED", "Session développeur invalide.");
    req.user = user;
    req.accessToken = token;
    await ensureDemoProfile(req);
    next();
  } catch (error) {
    if (error.code === "DEMO_ACCOUNT_DISABLED") return jsonError(res, 403, "DEMO_ACCOUNT_DISABLED", "Cet espace développeur est suspendu.");
    clearCookies(res);
    return jsonError(res, 401, "SESSION_EXPIRED", "Votre session a expiré. Reconnectez-vous.");
  }
}

async function optionalUser(req, res, next) {
  if (!configured()) return next();
  const cookies = parseCookies(req.headers.cookie || "");
  let token = cookies.novatech_access || "";
  const refresh = cookies.novatech_refresh || "";
  try {
    if (!token && refresh) token = await refreshSession(refresh, res);
    if (token) {
      let user;
      try {
        user = await supabaseFetch("/auth/v1/user", { method: "GET" }, token);
      } catch (error) {
        if (error.status !== 401 || !refresh) throw error;
        token = await refreshSession(refresh, res);
        user = await supabaseFetch("/auth/v1/user", { method: "GET" }, token);
      }
      if (user?.id && !user.is_anonymous) {
        req.user = user;
        req.accessToken = token;
      }
    }
  } catch {
    // Public statistics remain readable even when an optional session has expired.
  }
  next();
}

async function ensureDemoProfile(req) {
  await supabaseFetch("/rest/v1/userdemo?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: req.user.id,
      email: req.user.email || "",
      display_name: req.user.user_metadata?.full_name || req.user.user_metadata?.name || null,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }, req.accessToken);
  const profiles = await supabaseFetch("/rest/v1/userdemo?id=eq." + encodeURIComponent(req.user.id) + "&select=account_status", {}, req.accessToken);
  if (!profiles?.[0] || profiles[0].account_status !== "active") {
    throw Object.assign(new Error("DEMO_ACCOUNT_DISABLED"), { code: "DEMO_ACCOUNT_DISABLED" });
  }
}
function encryptionKey() {
  if (!/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) throw new Error("NOVATECH_CREDENTIALS_ENCRYPTION_KEY doit contenir 32 octets hexadécimaux.");
  return Buffer.from(ENCRYPTION_KEY, "hex");
}
function externalUserId(userId) {
  return "novatech-" + crypto.createHmac("sha256", encryptionKey())
    .update("external-user:" + String(userId))
    .digest("hex");
}
function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return { api_key_ciphertext: ciphertext.toString("base64"), api_key_iv: iv.toString("base64"), api_key_tag: cipher.getAuthTag().toString("base64"), encryption_version: 1 };
}
function decryptSecret(row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(row.api_key_iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.api_key_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.api_key_ciphertext, "base64")), decipher.final()]).toString("utf8");
}
async function db(req, path, options = {}) {
  return supabaseFetch("/rest/v1/" + path, options, req.accessToken);
}
function cleanConnection(row) {
  return {
    id: row.id, label: row.label, api_base_url: row.api_base_url, project_id: row.project_id,
    is_active: row.is_active, last_verified_at: row.last_verified_at, last_status: row.last_status,
    created_at: row.created_at
  };
}
function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const p = address.split(".").map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
  }
  if (family === 6) {
    const v = address.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") ||
      v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") ||
      v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  return true;
}
async function validateApiBase(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("Adresse API invalide."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Utilisez une adresse HTTPS publique, sans identifiant, paramètre ni fragment.");
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) throw new Error("Les adresses locales ne sont pas autorisées.");
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error("Cette adresse ne peut pas être utilisée depuis le serveur de démonstration.");
  return url.toString().replace(/\/+$/, "");
}
async function getConnection(req, id) {
  const rows = await db(req, "userdemo_api_connections?id=eq." + encodeURIComponent(id) + "&select=*");
  return rows?.[0] || null;
}
async function recordTest(req, connectionId, label, method, success, status, code, duration, summary) {
  try {
    await db(req, "userdemo_api_test_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        userdemo_id: req.user.id, connection_id: connectionId, endpoint_label: label,
        http_method: method, success, http_status: status || null, error_code: code || null,
        duration_ms: duration, response_summary: summary || {}
      })
    });
  } catch { /* Un échec de journalisation ne doit pas divulguer la clé ni masquer la réponse API. */ }
}
async function callUserApi(connection, userId, suffix, method = "GET", body) {
  const base = await validateApiBase(connection.api_base_url);
  const apiKey = decryptSecret(connection);
  const url = base + suffix;
  const started = Date.now();
  const response = await fetch(url, {
    method,
    headers: {
      "X-API-Key": apiKey,
      "X-External-User-ID": externalUserId(userId),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(20000)
  });
  const raw = await response.text();
  if (raw.length > MAX_API_RESPONSE) throw Object.assign(new Error("Réponse API trop volumineuse."), { status: response.status, code: "RESPONSE_TOO_LARGE", duration: Date.now() - started });
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw.slice(0, 500) }; }
  if (!response.ok) {
    const nested = payload?.error;
    const message = (nested && typeof nested === "object" && nested.message) || payload?.message || (typeof nested === "string" ? nested : "L'API a refusé la requête.");
    throw Object.assign(new Error(String(message).slice(0, 400)), { status: response.status, code: (nested && nested.code) || payload?.code || "API_REQUEST_FAILED", duration: Date.now() - started, payload });
  }
  return { payload, status: response.status, duration: Date.now() - started };
}
function projectSuffix(connection, endpoint) {
  // La colonne historique project_id stocke ici l'api_client_id public de la ressource.
  const apiClientId = String(connection.project_id || "").trim();
  if (!apiClientId) throw new Error("L'identifiant client API (api_client_id) est obligatoire.");
  const resource = "/apps/" + encodeURIComponent(apiClientId);
  if (endpoint === "status") return resource + "/status";
  if (endpoint === "files") return resource + "/files";
  if (endpoint === "usage") return "/usage";
  if (endpoint === "stats") return "/stats";
  throw new Error("Démonstration API inconnue.");
}

app.get("/", (_req, res) => {
  res.status(200).type("html").send(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#102a25">
<meta name="description" content="NOVATECH Developer Playground — accédez à votre espace développeur UDCShare.">
<title>NOVATECH — Developer Playground</title>
<style>
:root{color-scheme:dark;--bg:#0b1715;--panel:#122521;--line:#29443c;--mint:#b7f3d5;--green:#55d69b;--muted:#a8bdb4}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 80% 10%,#1b4538 0,transparent 42%),linear-gradient(145deg,#0b1715,#10231f 60%,#0b1715);color:#f4fbf7;font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column}
header,main,footer{width:min(1080px,calc(100% - 40px));margin-inline:auto}header{height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff16}
.brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.13em}.mark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,#b7f3d5,#52c891);color:#10251d;font-size:23px;letter-spacing:0}
.brand small{display:block;font-size:9px;letter-spacing:.2em;color:var(--muted);font-weight:600}.live{font-size:12px;color:var(--mint);border:1px solid #55d69b55;border-radius:99px;padding:7px 12px}
main{flex:1;display:grid;grid-template-columns:1.15fr .85fr;align-items:center;gap:64px;padding-block:72px}
.eyebrow{font-size:11px;letter-spacing:.2em;color:var(--green);font-weight:800}.hero h1{font-size:clamp(42px,6vw,70px);line-height:1.04;letter-spacing:-.055em;margin:20px 0}.hero h1 span{color:var(--mint)}.hero p{max-width:600px;color:var(--muted);font-size:18px;line-height:1.75}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:54px;padding:0 22px;border-radius:12px;text-decoration:none;font-weight:800;transition:transform .2s,background .2s}.btn:hover{transform:translateY(-2px)}.primary{background:var(--mint);color:#10251d}.secondary{border:1px solid var(--line);color:#e9f5ef;background:#ffffff08}
.panel{border:1px solid var(--line);border-radius:22px;padding:26px;background:linear-gradient(155deg,#18342cdd,#10201ddd);box-shadow:0 28px 90px #0005}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.panel h2{font-size:17px;margin:0}.pill{font-size:10px;letter-spacing:.12em;color:var(--mint);background:#55d69b18;padding:6px 9px;border-radius:99px}
.row{display:flex;align-items:center;gap:12px;padding:15px 0;border-top:1px solid #ffffff12}.symbol{width:36px;height:36px;border-radius:10px;background:#55d69b17;color:var(--mint);display:grid;place-items:center;font-weight:800}.row strong{display:block;font-size:13px}.row small{display:block;color:var(--muted);font-size:11px}.arrow{margin-left:auto;color:var(--green)}.note{font-size:12px;color:var(--muted);margin:18px 0 0}
footer{padding:22px 0;border-top:1px solid #ffffff16;color:#8da69b;font-size:12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}footer a{color:var(--mint);text-decoration:none}
@media(max-width:760px){main{grid-template-columns:1fr;gap:36px;padding-block:52px}.hero h1{font-size:48px}.hero p{font-size:16px}.panel{padding:20px}header,main,footer{width:min(100% - 32px,1080px)}}
</style>
</head>
<body>
<header><a class="brand" href="/"><span class="mark">N</span><span>NOVATECH<small>DEVELOPER PLAYGROUND</small></span></a><span class="live">● API EN LIGNE</span></header>
<main>
<section class="hero"><span class="eyebrow">L'ESPACE DES DÉVELOPPEURS</span><h1>Construisez.<br><span>Testez. Explorez.</span></h1><p>Bienvenue sur NOVATECH Developer Playground, l'environnement public pour découvrir et tester les API UDCShare avec vos propres projets et identifiants.</p><div class="actions"><a class="btn primary" href="https://novatech-demo-portal-test-61nh.onrender.com">Accéder à la plateforme <span aria-hidden="true">→</span></a><a class="btn secondary" href="https://github.com/SALEMEDO/udcshare-api-examples/blob/main/docs/NOVATECH_PLAYGROUND_GUIDE_FR.md">Lire le guide</a></div></section>
<aside class="panel"><div class="panel-head"><h2>Ressources NOVATECH</h2><span class="pill">PUBLIC PLAYGROUND</span></div>
<a class="row" href="https://novatech-demo-portal-test-61nh.onrender.com" style="color:inherit;text-decoration:none"><span class="symbol">↗</span><span><strong>Portail développeur</strong><small>Créer un compte et gérer vos connexions</small></span><span class="arrow">→</span></a>
<a class="row" href="/health" style="color:inherit;text-decoration:none"><span class="symbol">✓</span><span><strong>État du service</strong><small>Vérifier la disponibilité de l'API</small></span><span class="arrow">→</span></a>
<a class="row" href="https://github.com/SALEMEDO/udcshare-api-examples/blob/main/docs/NOVATECH_PLAYGROUND_GUIDE_FR.md" style="color:inherit;text-decoration:none"><span class="symbol">⌘</span><span><strong>Documentation</strong><small>Guide de démarrage et exemples</small></span><span class="arrow">→</span></a>
<p class="note">Chaque visiteur dispose de son propre espace. Les clés API personnelles ne sont pas partagées entre les comptes.</p></aside>
</main>
<footer><span>© NOVATECH · Developer Playground</span><span>Propulsé par <a href="https://udcshare.com">UDCShare</a></span></footer>
</body></html>`);
});
// Public keep-alive endpoints for an external uptime monitor (no secrets, no database work).
app.get("/ping", (_req, res) => res.status(200).json({ status: "ok", service: "novatech-demo-api", ts: Date.now() }));
app.get("/wake", (_req, res) => res.status(200).type("text/plain").send("awake"));
app.get("/health", (_req, res) => res.json({ ok: true, service: "novatech-developer-playground", configured: configured() }));
app.get("/api/config", (_req, res) => res.json({
  app: "NOVATECH Developer Playground",
  authReady: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  credentialVaultReady: /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY),
  userApiKeysInRender: false
}));
app.get("/api/health", (_req, res) => res.json({
  ok: true,
  service: "novatech-developer-playground",
  configured: configured(),
  authReady: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  credentialVaultReady: /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)
}));
app.get("/api/openapi.json", (_req, res) => {
  const definitions = [
    ["/health", "get", "État du service"],
    ["/api/health", "get", "État de configuration et santé de l'API"],
    ["/api/config", "get", "Configuration publique du portail"],
    ["/api/auth/signup", "post", "Créer un compte développeur"],
    ["/api/auth/login", "post", "Ouvrir une session"],
    ["/api/auth/me", "get", "Consulter la session"],
    ["/api/connections", "get", "Lister les connexions API"],
    ["/api/connections", "post", "Enregistrer une connexion API"],
    ["/api/history", "get", "Historique des tests"],
    ["/api/demos/{slug}/engagement", "get", "Lire les vues et J'aime publics"],
    ["/api/demos/{slug}/view", "post", "Enregistrer une vue"],
    ["/api/demos/{slug}/like", "post", "Ajouter ou retirer un J'aime"],
    ["/api/client-demo/overview", "get", "Charger le portail client"]
  ];
  const paths = {};
  for (const [route, method, summary] of definitions) {
    paths[route] ||= {};
    paths[route][method] = { summary, responses: { "200": { description: summary } } };
  }
  res.json({
    openapi: "3.1.0",
    info: { title: "NOVATECH Developer Playground API", version: "1.0.0", description: "API du portail de démonstration NOVATECH." },
    servers: [{ url: "/" }],
    paths
  });
});
app.get("/api/docs", (_req, res) => res.status(200).type("html").send(`<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Documentation API NOVATECH</title>
<style>body{font:16px/1.6 system-ui;background:#0b1715;color:#edf8f1;max-width:850px;margin:48px auto;padding:0 20px}a{color:#8bf0bd}code{background:#17352b;padding:3px 6px;border-radius:5px}li{margin:10px 0}</style>
<h1>NOVATECH — Documentation API</h1><p>API du portail développeur et de ses démonstrations.</p>
<p><a href="/api/openapi.json">Consulter le document OpenAPI 3.1 (JSON)</a></p>
<h2>État et configuration</h2><ul><li><code>GET /health</code></li><li><code>GET /api/health</code></li><li><code>GET /api/config</code></li></ul>
<h2>Authentification</h2><ul><li><code>POST /api/auth/signup</code></li><li><code>POST /api/auth/login</code></li><li><code>GET /api/auth/me</code></li><li><code>POST /api/auth/logout</code></li></ul>
<h2>Démonstrations</h2><ul><li><code>GET /api/demos/{slug}/engagement</code></li><li><code>POST /api/demos/{slug}/view</code></li><li><code>POST /api/demos/{slug}/like</code></li><li><code>GET /api/client-demo/overview</code></li></ul>
<p><a href="/">Retour à NOVATECH</a></p></html>`));


app.post("/api/auth/callback", limit(10, 15 * 60 * 1000), async (req, res) => {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "Le service de compte NOVATECH n'est pas configuré.");
  const accessToken = String(req.body?.access_token || "");
  const refreshToken = String(req.body?.refresh_token || "");
  if (accessToken.length < 40 || accessToken.length > 10000 || refreshToken.length < 10 || refreshToken.length > 1000) {
    return jsonError(res, 400, "AUTH_CALLBACK_INVALID", "Lien de confirmation invalide ou incomplet.");
  }
  try {
    const user = await supabaseFetch("/auth/v1/user", { method: "GET" }, accessToken);
    if (!user?.id || !user.email_confirmed_at) return jsonError(res, 401, "EMAIL_NOT_CONFIRMED", "L'adresse e-mail n'est pas encore confirmée.");
    setSessionCookies(res, { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
    return res.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.user_metadata?.full_name || user.user_metadata?.name || "" } });
  } catch {
    return jsonError(res, 401, "AUTH_CALLBACK_FAILED", "La confirmation a expiré. Demandez un nouvel e-mail de confirmation.");
  }
});

app.post("/api/auth/signup", limit(5, 15 * 60 * 1000), async (req, res) => {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "L'inscription n'est pas encore configurée.");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.display_name || "").trim().slice(0, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(res, 400, "EMAIL_INVALID", "Adresse e-mail invalide.");
  if (password.length < 10) return jsonError(res, 400, "PASSWORD_TOO_SHORT", "Choisissez un mot de passe d'au moins 10 caractères.");
  try {
    const confirmationRedirect = "https://novatech-demo-portal-test-61nh.onrender.com/app.html";
    const result = await supabaseFetch("/auth/v1/signup?redirect_to=" + encodeURIComponent(confirmationRedirect), {
      method: "POST", body: JSON.stringify({ email, password, data: { full_name: displayName } })
    });
    if (result.access_token) {
      setSessionCookies(res, result);
      const user = result.user || result;
      req.user = user; req.accessToken = result.access_token;
      await ensureDemoProfile(req);
      return res.status(201).json({ created: true, authenticated: true, message: "Votre espace développeur est créé." });
    }
    return res.status(201).json({ created: true, authenticated: false, message: "Demande reçue. Si vous avez déjà un compte UDCShare avec cette adresse, utilisez directement l’onglet Connexion avec le même mot de passe. Sinon, vérifiez votre boîte de réception et les courriers indésirables, puis utilisez le bouton de renvoi si nécessaire." });
  } catch (error) {
    return jsonError(res, error.status || 400, error.code || "SIGNUP_FAILED", error.message);
  }
});
app.post("/api/auth/resend-confirmation", limit(3, 15 * 60 * 1000), async (req, res) => {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "Le service de compte NOVATECH n'est pas encore configuré.");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const at = email.indexOf("@");
  if (!email || email.includes(" ") || at < 1 || email.lastIndexOf(".") < at + 2) {
    return jsonError(res, 400, "EMAIL_INVALID", "Saisissez une adresse e-mail valide.");
  }
  try {
    await supabaseFetch("/auth/v1/resend", {
      method: "POST",
      body: JSON.stringify({ type: "signup", email })
    });
    return res.json({
      sent: true,
      message: "Demande traitée. Si cette adresse attend une confirmation, un nouvel e-mail vient d'être demandé. Vérifiez aussi les courriers indésirables."
    });
  } catch (error) {
    const status = error.status || 400;
    const message = status === 429
      ? "Trop de demandes. Attendez quelques minutes avant de réessayer."
      : error.message || "Impossible de demander un nouvel e-mail pour le moment.";
    return jsonError(res, status, error.code || "RESEND_FAILED", message);
  }
});
app.post("/api/auth/login", limit(8, 15 * 60 * 1000), async (req, res) => {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "La connexion n'est pas encore configurée.");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  try {
    const session = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST", body: JSON.stringify({ email, password })
    });
    setSessionCookies(res, session);
    const user = await supabaseFetch("/auth/v1/user", { method: "GET" }, session.access_token);
    req.user = user; req.accessToken = session.access_token;
    await ensureDemoProfile(req);
    return res.json({ authenticated: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    return jsonError(res, error.status || 401, error.code || "LOGIN_FAILED", error.status === 400 || error.status === 401 ? "E-mail ou mot de passe incorrect, ou e-mail non confirmé." : error.message);
  }
});
app.post("/api/auth/logout", (_req, res) => { clearCookies(res); return res.json({ authenticated: false }); });
app.get("/api/auth/me", requireUser, (req, res) => res.json({ authenticated: true, user: { id: req.user.id, email: req.user.email, name: req.user.user_metadata?.full_name || req.user.user_metadata?.name || "" } }));

app.get("/api/connections", requireUser, async (req, res) => {
  try {
    const rows = await db(req, "userdemo_api_connections?select=id,label,api_base_url,project_id,is_active,last_verified_at,last_status,created_at&order=created_at.desc");
    res.json({ connections: (rows || []).map(cleanConnection) });
  } catch (error) { jsonError(res, 502, "CONNECTIONS_READ_FAILED", "Impossible de charger vos configurations API."); }
});
app.post("/api/connections", requireUser, limit(10, 60 * 60 * 1000), async (req, res) => {
  const label = String(req.body?.label || "Mon API").trim().slice(0, 80) || "Mon API";
  const projectId = String(req.body?.project_id || "").trim().slice(0, 180);
  const apiKey = String(req.body?.api_key || "").trim();
  if (!projectId || !apiKey || apiKey.length > 2048) return jsonError(res, 400, "CONFIGURATION_INCOMPLETE", "L'identifiant client API (api_client_id) et la clé API sont obligatoires.");
  try {
    const apiBaseUrl = await validateApiBase(req.body?.api_base_url);
    const secret = encryptSecret(apiKey);
    const rows = await db(req, "userdemo_api_connections", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        userdemo_id: req.user.id, label, api_base_url: apiBaseUrl, project_id: projectId,
        ...secret, is_active: true
      })
    });
    if (!rows?.[0]) throw new Error("La configuration n'a pas été enregistrée.");
    res.status(201).json({ connection: cleanConnection(rows[0]), message: "Configuration enregistrée et clé chiffrée." });
  } catch (error) {
    jsonError(res, error.status || 400, error.code || "CONNECTION_SAVE_FAILED", error.message || "Impossible d'enregistrer cette configuration.");
  }
});
app.delete("/api/connections/:id", requireUser, async (req, res) => {
  try {
    await db(req, "userdemo_api_connections?id=eq." + encodeURIComponent(req.params.id), { method: "DELETE", headers: { Prefer: "return=minimal" } });
    res.json({ deleted: true });
  } catch { jsonError(res, 502, "CONNECTION_DELETE_FAILED", "Impossible de supprimer cette configuration."); }
});
app.get("/api/history", requireUser, async (req, res) => {
  try {
    const rows = await db(req, "userdemo_api_test_runs?select=id,connection_id,endpoint_label,http_method,success,http_status,error_code,duration_ms,created_at&order=created_at.desc&limit=50");
    res.json({ history: rows || [] });
  } catch { jsonError(res, 502, "HISTORY_READ_FAILED", "Impossible de charger votre historique."); }
});

app.post("/api/connections/:id/test/:endpoint", requireUser, limit(60, 60 * 60 * 1000), async (req, res) => {
  const endpoint = req.params.endpoint;
  const label = ({ status: "État du projet", files: "Liste des fichiers", usage: "Consommation API" })[endpoint];
  if (!label) return jsonError(res, 404, "DEMO_NOT_FOUND", "Démonstration inconnue.");
  const started = Date.now();
  let connection;
  try {
    connection = await getConnection(req, req.params.id);
    if (!connection || !connection.is_active) return jsonError(res, 404, "CONNECTION_NOT_FOUND", "Configuration API introuvable ou désactivée.");
    const suffix = projectSuffix(connection, endpoint);
    const result = await callUserApi(connection, req.user.id, suffix);
    const safePayload = result.payload && typeof result.payload === "object" ? result.payload : { result: result.payload };
    const summary = endpoint === "files"
      ? { files_count: Array.isArray(safePayload.files) ? safePayload.files.length : (Array.isArray(safePayload) ? safePayload.length : null) }
      : endpoint === "usage"
        ? { plan: safePayload.plan?.name || safePayload.plan || null, quota: safePayload.quota || null }
        : { overall_status: safePayload.overall_status || safePayload.status || null, api_status: safePayload.api?.status || null, drive_status: safePayload.google_drive?.status || null };
    await recordTest(req, connection.id, label, "GET", true, result.status, null, result.duration, summary);
    await db(req, "userdemo_api_connections?id=eq." + encodeURIComponent(connection.id), {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_verified_at: new Date().toISOString(), last_status: "connected" })
    });
    return res.json({ ok: true, endpoint, status: result.status, duration_ms: result.duration, data: safePayload });
  } catch (error) {
    const status = error.status || 502;
    const code = error.code || "API_UNAVAILABLE";
    if (connection) {
      await recordTest(req, connection.id, label, "GET", false, status, code, error.duration || (Date.now() - started), { message: String(error.message || "").slice(0, 250) });
      try {
        await db(req, "userdemo_api_connections?id=eq." + encodeURIComponent(connection.id), {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_verified_at: new Date().toISOString(), last_status: status === 401 ? "invalid_key" : "error" })
        });
      } catch {}
    }
    return jsonError(res, status >= 400 && status < 500 ? status : 502, code, error.message || "Impossible de joindre cette API.");
  }
});


const demoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

function validDemoSlug(slug) {
  return slug === "portail-client" || slug === "playground-api";
}
async function engagementStats(slug, visitorHash, accessToken = "") {
  return supabaseFetch("/rest/v1/rpc/novatech_demo_engagement", {
    method: "POST",
    body: JSON.stringify({ p_demo_slug: slug, p_visitor_hash: visitorHash || null })
  }, accessToken);
}
app.get("/api/demos/:slug/engagement", optionalUser, async (req, res) => {
  if (!validDemoSlug(req.params.slug)) return jsonError(res, 404, "DEMO_NOT_FOUND", "Démonstration inconnue.");
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "Les compteurs publics ne sont pas configurés.");
  try {
    return res.json(await engagementStats(req.params.slug, null, req.accessToken || ""));
  } catch {
    return jsonError(res, 502, "ENGAGEMENT_UNAVAILABLE", "Impossible de charger les compteurs.");
  }
});
app.post("/api/demos/:slug/view", limit(120, 60 * 60 * 1000), optionalUser, async (req, res) => {
  if (!validDemoSlug(req.params.slug)) return jsonError(res, 404, "DEMO_NOT_FOUND", "Démonstration inconnue.");
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "Les compteurs publics ne sont pas configurés.");
  const visitorKey = String(req.body?.visitor_key || "");
  if (visitorKey.length < 16 || visitorKey.length > 160) return jsonError(res, 400, "VISITOR_KEY_INVALID", "Identifiant visiteur invalide.");
  const visitorHash = crypto.createHash("sha256").update(visitorKey).digest("hex");
  try {
    return res.json(await engagementStats(req.params.slug, visitorHash, req.accessToken || ""));
  } catch {
    return jsonError(res, 502, "VIEW_NOT_RECORDED", "La vue n'a pas pu être enregistrée.");
  }
});
app.post("/api/demos/:slug/like", requireUser, limit(30, 60 * 60 * 1000), async (req, res) => {
  if (!validDemoSlug(req.params.slug)) return jsonError(res, 404, "DEMO_NOT_FOUND", "Démonstration inconnue.");
  if (typeof req.body?.liked !== "boolean") return jsonError(res, 400, "LIKE_VALUE_INVALID", "Action J'aime invalide.");
  try {
    const result = await db(req, "rpc/novatech_demo_toggle_like", {
      method: "POST",
      body: JSON.stringify({ p_demo_slug: req.params.slug, p_liked: req.body.liked })
    });
    return res.json(result);
  } catch {
    return jsonError(res, 502, "LIKE_NOT_SAVED", "Impossible d'enregistrer votre J'aime.");
  }
});

async function clientDemoConnection(req) {
  const rows = await db(req, "userdemo_api_connections?select=*&is_active=eq.true&order=created_at.desc&limit=1");
  return rows?.[0] || null;
}
async function requireClientDemoConnection(req, res) {
  const connection = await clientDemoConnection(req);
  if (!connection) {
    jsonError(res, 409, "API_CONNECTION_REQUIRED", "Connectez d'abord votre clé API UDCShare dans le Playground. Elle sera conservée chiffrée côté serveur.");
    return null;
  }
  return connection;
}
app.get("/api/client-demo/overview", requireUser, async (req, res) => {
  try {
    const connection = await requireClientDemoConnection(req, res);
    if (!connection) return;
    const [status, files, stats, usage] = await Promise.all([
      callUserApi(connection, req.user.id, projectSuffix(connection, "status")),
      callUserApi(connection, req.user.id, projectSuffix(connection, "files") + "?limit=50"),
      callUserApi(connection, req.user.id, projectSuffix(connection, "stats")),
      callUserApi(connection, req.user.id, projectSuffix(connection, "usage"))
    ]);
    const project = stats.payload?.project || {};
    const account = {
      full_name: "Ressource API " + (project.api_client_id || connection.project_id),
      plan: project.environment || status.payload?.api?.environment || "—"
    };
    return res.json({
      account,
      files: files.payload,
      stats: stats.payload,
      status: status.payload,
      usage: usage.payload,
      connection: { label: connection.label, api_base_url: connection.api_base_url, api_client_id: connection.project_id }
    });
  } catch (error) {
    return jsonError(res, error.status || 502, error.code || "CLIENT_DEMO_LOAD_FAILED", error.message || "Impossible de charger le portail client.");
  }
});
app.post("/api/client-demo/upload", requireUser, demoUpload.single("file"), async (req, res) => {
  if (!req.file) return jsonError(res, 400, "FILE_REQUIRED", "Choisissez un fichier à envoyer.");
  try {
    const connection = await requireClientDemoConnection(req, res);
    if (!connection) return;
    const base = await validateApiBase(connection.api_base_url);
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" }), req.file.originalname);
    const started = Date.now();
    const response = await fetch(base + projectSuffix(connection, "files"), {
      method: "POST",
      headers: {
        "X-API-Key": decryptSecret(connection),
        "X-External-User-ID": externalUserId(req.user.id)
      },
      body: form,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(120000)
    });
    const raw = await response.text();
    if (raw.length > MAX_API_RESPONSE) return jsonError(res, 502, "RESPONSE_TOO_LARGE", "La réponse de l'API est trop volumineuse.");
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw.slice(0, 400) }; }
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || payload?.error || "L'API UDCShare a refusé l'envoi.";
      return jsonError(res, response.status, payload?.code || "UPLOAD_FAILED", String(detail).slice(0, 400));
    }
    return res.status(201).json({ ok: true, duration_ms: Date.now() - started, data: payload });
  } catch (error) {
    return jsonError(res, error.status || 502, error.code || "UPLOAD_FAILED", error.message || "L'envoi a échoué.");
  }
});
app.delete("/api/client-demo/files/:id", requireUser, async (req, res) => {
  const fileId = String(req.params.id || "").trim();
  if (!fileId || fileId.length > 180 || /[/?#]/.test(fileId)) return jsonError(res, 400, "FILE_ID_INVALID", "Identifiant de fichier invalide.");
  try {
    const connection = await requireClientDemoConnection(req, res);
    if (!connection) return;
    const result = await callUserApi(connection, req.user.id, projectSuffix(connection, "files") + "/" + encodeURIComponent(fileId), "DELETE");
    return res.json({ ok: true, data: result.payload });
  } catch (error) {
    return jsonError(res, error.status || 502, error.code || "FILE_DELETE_FAILED", error.message || "Impossible de supprimer ce fichier.");
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large" || error?.code === "LIMIT_FILE_SIZE") return jsonError(res, 413, "REQUEST_TOO_LARGE", "Fichier trop volumineux. La démonstration accepte jusqu’à 50 Mo par fichier.");
  if (error?.code === "LIMIT_FILE_COUNT" || error?.code === "LIMIT_UNEXPECTED_FILE") return jsonError(res, 400, "UPLOAD_INVALID", "Un seul fichier est accepté à la fois.");
  return jsonError(res, 500, "INTERNAL_ERROR", "Une erreur interne est survenue.");
});
app.listen(PORT, () => console.log("NOVATECH Developer Playground listening on " + PORT));
