const express = require("express");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "");
const ENCRYPTION_KEY = String(process.env.NOVATECH_CREDENTIALS_ENCRYPTION_KEY || "");
const ALLOWED_ORIGIN = String(process.env.NOVATECH_ALLOWED_ORIGIN || "https://novatech-demo-portal-public.onrender.com");
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
      "X-External-User-ID": "NOVATECH-DEMO-" + userId,
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
  const projectId = String(connection.project_id || "").trim();
  if (!projectId) throw new Error("L'identifiant du projet API est obligatoire.");
  if (endpoint === "status") return "/apps/" + encodeURIComponent(projectId) + "/status";
  if (endpoint === "files") return "/apps/" + encodeURIComponent(projectId) + "/files?limit=10";
  if (endpoint === "usage") return "/usage";
  throw new Error("Démonstration API inconnue.");
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "novatech-developer-playground", configured: configured() }));
app.get("/api/config", (_req, res) => res.json({
  app: "NOVATECH Developer Playground",
  authReady: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  credentialVaultReady: /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY),
  userApiKeysInRender: false
}));

app.post("/api/auth/signup", limit(5, 15 * 60 * 1000), async (req, res) => {
  if (!configured()) return jsonError(res, 503, "SERVICE_NOT_CONFIGURED", "L'inscription n'est pas encore configurée.");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.display_name || "").trim().slice(0, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(res, 400, "EMAIL_INVALID", "Adresse e-mail invalide.");
  if (password.length < 10) return jsonError(res, 400, "PASSWORD_TOO_SHORT", "Choisissez un mot de passe d'au moins 10 caractères.");
  try {
    const result = await supabaseFetch("/auth/v1/signup", {
      method: "POST", body: JSON.stringify({ email, password, data: { full_name: displayName } })
    });
    if (result.access_token) {
      setSessionCookies(res, result);
      const user = result.user || result;
      req.user = user; req.accessToken = result.access_token;
      await ensureDemoProfile(req);
      return res.status(201).json({ created: true, authenticated: true, message: "Votre espace développeur est créé." });
    }
    return res.status(201).json({ created: true, authenticated: false, message: "Compte créé. Vérifiez votre e-mail pour confirmer l'inscription, puis connectez-vous." });
  } catch (error) {
    return jsonError(res, error.status || 400, error.code || "SIGNUP_FAILED", error.message);
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
  if (!projectId || !apiKey || apiKey.length > 2048) return jsonError(res, 400, "CONFIGURATION_INCOMPLETE", "L'identifiant du projet et la clé API sont obligatoires.");
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

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return jsonError(res, 413, "REQUEST_TOO_LARGE", "Requête trop volumineuse.");
  return jsonError(res, 500, "INTERNAL_ERROR", "Une erreur interne est survenue.");
});
app.listen(PORT, () => console.log("NOVATECH Developer Playground listening on " + PORT));
