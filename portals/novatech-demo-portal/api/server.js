const express = require("express");
const multer = require("multer");
const crypto = require("node:crypto");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const API_BASE = String(process.env.UDCSHARE_API_BASE_URL || "https://udcshare.com/api/v1").replace(/\/+$/, "");
const API_CLIENT_ID = String(process.env.UDCSHARE_API_CLIENT_ID || "").trim();
const EXTERNAL_USER_ID = String(process.env.UDCSHARE_EXTERNAL_USER_ID || "NOVATECH-PAYMENT-PORTAL").trim();
const API_KEY = String(process.env.UDCSHARE_API_KEY || "").trim();
const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const DEMO_MODE = process.env.NOVATECH_DEMO_MODE === "true";
const demoFiles = new Map();
let demoRegistry = { version: 0, submissions: [] };
const REGISTRY_PREFIX = "NOVATECH_DEMO_REGISTRY_";
const VALID_STATUSES = new Set(["received", "verified", "rejected"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
    callback(allowed.has(file.mimetype) ? null : new Error("FORMAT_NOT_ALLOWED"), allowed.has(file.mimetype));
  }
});

class ApiError extends Error {
  constructor(status, payload) {
    const nested = payload?.error;
    super(
      (nested && typeof nested === "object" && nested.message) ||
      payload?.message ||
      (typeof nested === "string" ? nested : "") ||
      "L'API UDCShare n'a pas pu traiter la demande."
    );
    this.status = status;
    this.payload = payload;
    this.code = (nested && typeof nested === "object" && nested.code) || payload?.code || "UDCSHARE_API_ERROR";
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function getAllowedOrigin() {
  return String(process.env.NOVATECH_ALLOWED_ORIGIN || process.env.ALLOWED_ORIGIN || "").trim();
}

function safeUdcUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !["udcshare.com", "www.udcshare.com"].includes(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function projectManageUrl() {
  return safeUdcUrl(process.env.UDCSHARE_PROJECT_URL) || "https://udcshare.com/developers";
}

function projectFilesPath() {
  if (!API_CLIENT_ID) throw new Error("La ressource API NOVATECH n'est pas configurée sur le serveur.");
  return "/apps/" + encodeURIComponent(API_CLIENT_ID) + "/files";
}

function apiHeaders(extra = {}) {
  if (!API_KEY) throw new Error("La clé API du projet NOVATECH n'est pas configurée sur le serveur.");
  return {
    "X-API-Key": API_KEY,
    "X-External-User-ID": EXTERNAL_USER_ID,
    ...extra
  };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: apiHeaders(options.headers || {}),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(120000)
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) throw new ApiError(response.status, payload);
  return { response, payload, raw };
}

async function downloadProjectFile(fileId) {
  if (DEMO_MODE) {
    const file = demoFiles.get(String(fileId));
    if (!file) throw new ApiError(404, { error: { code: "DEMO_FILE_NOT_FOUND", message: "Fichier de démonstration introuvable." } });
    return { response: { headers: { get: () => file.mimeType } }, buffer: file.buffer };
  }
  const response = await fetch(API_BASE + projectFilesPath() + "/" + encodeURIComponent(fileId) + "/download", {
    headers: apiHeaders(),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) {
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
    throw new ApiError(response.status, payload);
  }
  return { response, buffer: Buffer.from(await response.arrayBuffer()) };
}

async function listProjectFiles(limit = 100) {
  const result = await apiFetch(projectFilesPath() + "?limit=" + limit);
  const list = Array.isArray(result.payload?.files) ? result.payload.files
    : Array.isArray(result.payload?.data?.files) ? result.payload.data.files
    : Array.isArray(result.payload) ? result.payload : [];
  return list.map(item => ({
    id: item.id || item.file_id,
    name: item.name || item.filename || item.file_name || "",
    createdAt: item.created_at || item.createdAt || null,
    size: item.size ?? item.filesize ?? null,
    mimeType: item.mime_type || item.mimetype || null
  })).filter(item => item.id);
}

async function uploadProjectFile(buffer, filename, mimeType) {
  if (DEMO_MODE) {
    const id = crypto.randomUUID();
    demoFiles.set(id, { buffer: Buffer.from(buffer), mimeType: mimeType || "application/octet-stream", filename });
    return { id, name: filename, size: buffer.length, createdAt: new Date().toISOString() };
  }
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename);
  const result = await apiFetch(projectFilesPath(), { method: "POST", body: form });
  const item = result.payload?.file || result.payload?.data?.file || result.payload;
  const id = item?.id || item?.file_id || result.payload?.file_id;
  if (!id) throw new Error("L'API a accepté l'envoi mais n'a pas retourné l'identifiant du fichier.");
  return {
    id: String(id),
    name: item?.name || item?.filename || filename,
    size: item?.size ?? item?.filesize ?? buffer.length,
    createdAt: item?.created_at || new Date().toISOString()
  };
}

function connectUrlFrom(payload) {
  const nested = payload?.error;
  let value = nested && typeof nested === "object" ? nested.connect : null;
  if (value && typeof value === "object") value = value.url || value.href;
  return safeUdcUrl(value);
}

function errorJson(res, error) {
  const status = error.status || 502;
  return res.status(status).json({
    error: {
      code: error.code || "UDCSHARE_API_ERROR",
      message: error.message || "Une erreur est survenue."
    }
  });
}

function configurationReady() {
  return DEMO_MODE || (process.env.NOVATECH_PROJECT_READY === "true" && Boolean(API_CLIENT_ID && API_KEY && EXTERNAL_USER_ID));
}

app.use((req, res, next) => {
  const origin = req.get("origin");
  const allowed = getAllowedOrigin();
  if (origin && allowed && origin !== allowed) return res.status(403).json({ error: "Origine non autorisée." });
  if (origin && allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(express.json({ limit: "64kb" }));

const requestWindows = new Map();
function rateLimit({ maximum, windowMs }) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = requestWindows.get(key);
    if (!entry || now - entry.startedAt >= windowMs) {
      requestWindows.set(key, { startedAt: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > maximum) return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of requestWindows) if (value.startedAt < cutoff) requestWindows.delete(key);
}, 10 * 60 * 1000).unref();

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sessionSecret() {
  return process.env.NOVATECH_SESSION_SECRET || "";
}
function createSession() {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from("novatech-admin|" + expiresAt).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return { token: payload + "." + signature, expiresAt };
}
function isAdmin(req) {
  const secret = sessionSecret();
  if (!secret) return false;
  const token = parseCookies(req.headers.cookie || "").novatech_admin || "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const [scope, expiry] = decoded.split("|");
    return scope === "novatech-admin" && Number(expiry) > Date.now();
  } catch {
    return false;
  }
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Session agent expirée. Connectez-vous de nouveau." });
  next();
}

let registryQueue = Promise.resolve();
function withRegistryLock(work) {
  const run = registryQueue.then(work, work);
  registryQueue = run.catch(() => {});
  return run;
}

async function readRegistry() {
  if (DEMO_MODE) return { version: demoRegistry.version, submissions: [...demoRegistry.submissions] };
  const files = await listProjectFiles(100);
  const candidates = files.map(file => {
    const match = file.name.match(/^NOVATECH_DEMO_REGISTRY_(\d{8})\.json$/i);
    return match ? { ...file, revision: Number(match[1]) } : null;
  }).filter(Boolean).sort((a, b) => b.revision - a.revision);
  if (!candidates.length) return { version: 0, submissions: [] };
  const result = await downloadProjectFile(candidates[0].id);
  let registry;
  try {
    registry = JSON.parse(result.buffer.toString("utf8"));
  } catch {
    throw new Error("Le registre NOVATECH enregistré dans le Drive est illisible. Aucune donnée n'a été écrasée.");
  }
  if (!registry || !Array.isArray(registry.submissions)) {
    throw new Error("Le format du registre NOVATECH dans le Drive est invalide.");
  }
  return { version: Number(registry.version) || candidates[0].revision, submissions: registry.submissions };
}

async function writeRegistry(registry) {
  if (DEMO_MODE) {
    demoRegistry = { version: Number(registry.version || 0) + 1, submissions: [...registry.submissions] };
    return { version: demoRegistry.version, submissions: demoRegistry.submissions };
  }
  const nextVersion = Number(registry.version || 0) + 1;
  const payload = Buffer.from(JSON.stringify({
    application: "NOVATECH - Portail des preuves de paiement",
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    submissions: registry.submissions
  }), "utf8");
  const filename = REGISTRY_PREFIX + String(nextVersion).padStart(8, "0") + ".json";
  await uploadProjectFile(payload, filename, "application/json");
  return { version: nextVersion, submissions: registry.submissions };
}

function textField(value, max = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
function submissionReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return "NOVA-" + date + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}
function fileExtension(name) {
  const ext = String(name || "").toLowerCase().match(/\.(pdf|png|jpe?g)$/);
  return ext ? (ext[1] === "jpeg" ? "jpg" : ext[1]) : "file";
}

function validFileSignature(file) {
  const bytes = file.buffer;
  if (file.mimetype === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (file.mimetype === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return false;
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "novatech-demo-api", demoMode: DEMO_MODE }));

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOVATECH DEMO API</title><style>body{font:16px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6f3;color:#18221f}.panel{max-width:620px;margin:20px;padding:32px;background:white;border:1px solid #dfe7e1;border-radius:18px}h1{color:#126c4c}p{line-height:1.6;color:#687771}a{color:#126c4c;font-weight:700}</style></head><body><main class="panel"><h1>NOVATECH DEMO — API</h1><p>Backend pédagogique du portail fictif NOVATECH. Les données du mode démonstration sont temporaires et simulées. Aucun compte client réel ni aucune clé privée n'est exposé.</p><p><a href="https://novatech-demo-portal.onrender.com">Ouvrir le portail de démonstration</a> · <a href="/health">État du service</a></p></main></body></html>`);
});

app.get("/api/config", (_req, res) => res.json({
  institution: "NOVATECH DEMO — ENTREPRISE FICTIVE",
  shortName: "NOVATECH",
  demoMode: DEMO_MODE,
  apiConfigured: configurationReady(),
  adminConfigured: Boolean(process.env.NOVATECH_ADMIN_PASSWORD),
  maxProofBytes: MAX_PROOF_BYTES
}));

app.get("/api/drive/status", async (_req, res) => {
  if (DEMO_MODE) return res.json({ connected: true, demoMode: true, label: "Mode démo actif", message: "Mode démo actif : les fichiers restent temporaires et fictifs." });
  if (!configurationReady()) {
    return res.status(503).json({
      connected: false,
      code: "SERVER_CONFIGURATION_REQUIRED",
      message: "Le service de dépôt NOVATECH est momentanément indisponible."
    });
  }
  try {
    await apiFetch(projectFilesPath() + "?limit=1");
    return res.json({
      connected: true,
      label: "Drive du projet connecté",
      message: "Le service de dépôt NOVATECH est disponible."
    });
  } catch (error) {
    return res.status(200).json({
      connected: false,
      code: error.code || "DRIVE_STATUS_UNAVAILABLE",
      message: "Le service de dépôt NOVATECH est momentanément indisponible."
    });
  }
});

app.post("/api/admin/login", rateLimit({ maximum: 8, windowMs: 10 * 60 * 1000 }), (req, res) => {
  const configuredPassword = process.env.NOVATECH_ADMIN_PASSWORD || "";
  if (!configuredPassword) return res.status(503).json({ error: "Le compte agent NOVATECH n'est pas encore configuré sur le serveur." });
  if (!safeEqual(req.body?.password, configuredPassword)) return res.status(401).json({ error: "Mot de passe incorrect." });
  const session = createSession();
  res.setHeader("Set-Cookie", "novatech_admin=" + session.token + "; HttpOnly; Secure; SameSite=None; Path=/api/admin; Max-Age=43200");
  return res.json({ authenticated: true, expiresAt: new Date(session.expiresAt).toISOString() });
});

app.get("/api/admin/session", requireAdmin, (_req, res) => res.json({ authenticated: true }));

app.get("/api/admin/api-status", requireAdmin, async (_req, res) => {
  const checkedAt = new Date().toISOString();
  if (DEMO_MODE) return res.json({ ok: true, checked_at: checkedAt, overall_status: "operational", api: { status: "demo", code: "NOVATECH_DEMO_MODE", message: "Mode démonstration : aucune clé réelle n’est utilisée." }, google_drive: { required: false, mode: "individual", status: "connected", message: "Stockage fictif en mémoire ; aucune connexion Google Drive réelle." } });
  if (!configurationReady()) return res.json({
    ok: false, checked_at: checkedAt, overall_status: "blocked",
    api: { status: "not_configured", code: "SERVER_CONFIGURATION_REQUIRED", message: "La ressource API NOVATECH n’est pas encore configurée sur le serveur." },
    google_drive: { required: true, status: "not_checked", message: "La connexion Google Drive ne peut pas être vérifiée avant la configuration de la ressource API." }
  });
  try {
    const result = await apiFetch("/apps/" + encodeURIComponent(API_CLIENT_ID) + "/status");
    const payload = result.payload || {};
    const connect = payload.google_drive?.connect;
    if (connect?.mode === "company") {
      const safeUrl = safeUdcUrl(connect.url);
      if (safeUrl) payload.google_drive.connect.url = safeUrl;
      else delete payload.google_drive.connect;
    } else if (connect?.mode === "individual") delete payload.google_drive.connect;
    return res.json(payload);
  } catch (error) {
    if (error.status === 401) return res.json({
      ok: false, checked_at: checkedAt, overall_status: "action_required",
      api: { status: "invalid_key", code: error.code || "API_KEY_INVALID_OR_REVOKED", message: "La clé API NOVATECH est invalide, révoquée ou désactivée. Générez une nouvelle clé dans le projet UDCShare, puis remplacez le secret UDCSHARE_API_KEY dans Render." },
      google_drive: { required: true, status: "not_checked", message: "Le contrôle Google Drive n’a pas pu être exécuté, car la clé API n’a pas été acceptée." }
    });
    if (error.status === 403) return res.json({
      ok: false, checked_at: checkedAt, overall_status: "blocked",
      api: { status: "blocked", code: error.code || "API_ACCESS_FORBIDDEN", message: error.message || "Accès API refusé." },
      google_drive: { required: true, status: "not_checked", message: "Le contrôle Google Drive est suspendu tant que l’accès API n’est pas rétabli." }
    });
    if (error.status === 404) return res.json({
      ok: false, checked_at: checkedAt, overall_status: "blocked",
      api: { status: "resource_not_found", code: error.code || "API_RESOURCE_NOT_FOUND", message: "La ressource API du projet NOVATECH est introuvable. Vérifiez son identifiant dans Developer Console." },
      google_drive: { required: true, status: "not_checked", message: "Aucune vérification Drive n’a été possible pour cette ressource." }
    });
    return res.json({
      ok: false, checked_at: checkedAt, overall_status: "degraded",
      api: { status: "temporarily_unavailable", code: error.code || "API_STATUS_UNAVAILABLE", message: "Le diagnostic UDCShare est momentanément indisponible. Réessayez plus tard." },
      google_drive: { required: true, status: "not_checked", message: "Une erreur temporaire empêche le contrôle du Drive. Ne révoquez pas et ne reconnectez pas le compte sur la seule base de cette panne." }
    });
  }
});

async function runAdminDriveAction(res, method, endpoint, successMessage) {
  if (DEMO_MODE) return res.status(403).json({ error: "Cette action est désactivée dans la démonstration." });
  if (!configurationReady()) {
    return res.status(503).json({ error: "La ressource API NOVATECH n’est pas configurée." });
  }
  try {
    const result = await apiFetch(endpoint, { method });
    return res.json({
      ok: true,
      message: successMessage,
      ...(result.payload && typeof result.payload === "object" ? { data: result.payload } : {})
    });
  } catch (error) {
    if (error.status) return errorJson(res, error);
    return res.status(502).json({
      error: "Impossible de joindre UDCShare. Aucune confirmation de l’opération n’a été reçue."
    });
  }
}

// Ces opérations ne suppriment aucun fichier et ne retirent pas définitivement la ressource.
app.post("/api/admin/drive/disconnect", requireAdmin, async (_req, res) => {
  return runAdminDriveAction(
    res,
    "DELETE",
    "/apps/" + encodeURIComponent(API_CLIENT_ID) + "/google-drive",
    "Le Drive entreprise a été déconnecté. La reconnexion reste possible."
  );
});

app.post("/api/admin/drive/revoke", requireAdmin, async (_req, res) => {
  return runAdminDriveAction(
    res,
    "POST",
    "/apps/" + encodeURIComponent(API_CLIENT_ID) + "/google-drive/revoke",
    "L’autorisation Google a été révoquée. Une nouvelle autorisation Google sera nécessaire."
  );
});

app.get("/api/admin/api-usage", requireAdmin, async (_req, res) => {
  if (DEMO_MODE) return res.json({ plan: { name: "Sandbox (simulation)" }, quota: { used: 4, limit: 50, remaining: 46, percent: 8, level: "normal", reset_at: new Date(Date.now() + 7 * 86400000).toISOString(), message: "Statistiques fictives de démonstration — aucun quota réel consommé." }, requests: { total: 128, successful: 122, failed: 6, last_minute: 2, per_minute_limit: 100 }, uploads: { successful: demoRegistry.submissions.length, failed: 0 } });
  if (!configurationReady()) return res.status(503).json({ error: "La ressource API NOVATECH n’est pas configurée." });
  try {
    const result = await apiFetch("/usage");
    return res.json(result.payload);
  } catch (error) {
    if (error.status) return errorJson(res, error);
    return res.status(502).json({ error: "Impossible de lire la consommation API UDCShare." });
  }
});

app.get("/api/admin/drive/manage-url", requireAdmin, (_req, res) => {
  return res.json({ url: projectManageUrl() });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "novatech_admin=; HttpOnly; Secure; SameSite=None; Path=/api/admin; Max-Age=0");
  res.json({ authenticated: false });
});

app.get("/api/admin/submissions", requireAdmin, async (_req, res) => {
  try {
    const registry = await readRegistry();
    const submissions = [...registry.submissions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.json({
      submissions,
      total: submissions.length,
      counts: {
        received: submissions.filter(item => item.status === "received").length,
        verified: submissions.filter(item => item.status === "verified").length,
        rejected: submissions.filter(item => item.status === "rejected").length
      },
      registryVersion: registry.version
    });
  } catch (error) {
    if (error.status) return errorJson(res, error);
    return res.status(502).json({ error: error.message || "Impossible de lire le registre NOVATECH dans le Drive." });
  }
});

app.post("/api/admin/submissions/:id/status", requireAdmin, async (req, res) => {
  const nextStatus = textField(req.body?.status, 20);
  if (!VALID_STATUSES.has(nextStatus)) return res.status(400).json({ error: "Statut invalide." });
  try {
    const updated = await withRegistryLock(async () => {
      const registry = await readRegistry();
      const index = registry.submissions.findIndex(item => item.id === req.params.id);
      if (index < 0) return null;
      const previous = registry.submissions[index];
      const now = new Date().toISOString();
      const changed = {
        ...previous,
        status: nextStatus,
        updatedAt: now,
        history: [...(Array.isArray(previous.history) ? previous.history : []), {
          status: nextStatus,
          at: now,
          actor: "agent-novatech"
        }]
      };
      registry.submissions[index] = changed;
      await writeRegistry(registry);
      return changed;
    });
    if (!updated) return res.status(404).json({ error: "Dossier introuvable." });
    return res.json({ submission: updated });
  } catch (error) {
    if (error.status) return errorJson(res, error);
    return res.status(502).json({ error: error.message || "Le statut n'a pas pu être enregistré dans le Drive." });
  }
});

app.get("/api/admin/submissions/:id/proof", requireAdmin, async (req, res) => {
  try {
    const registry = await readRegistry();
    const item = registry.submissions.find(submission => submission.id === req.params.id);
    if (!item) return res.status(404).json({ error: "Dossier introuvable." });
    const result = await downloadProjectFile(item.proofFileId);
    const buffer = result.buffer;
    const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    const mimeType = allowedMimeTypes.has(item.proofMimeType) ? item.proofMimeType : "application/octet-stream";
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    const filename = String(item.proofFileName || "preuve-paiement").replace(/[\r\n"]/g, "_");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", disposition + "; filename*=UTF-8''" + encodeURIComponent(filename));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(buffer);
  } catch (error) {
    if (error.status) return errorJson(res, error);
    return res.status(502).json({ error: "Le fichier de preuve n'a pas pu être récupéré du Drive." });
  }
});

app.post("/api/submissions", rateLimit({ maximum: 6, windowMs: 10 * 60 * 1000 }), upload.single("proof"), async (req, res) => {
  if (!configurationReady()) return res.status(503).json({ error: "Le portail n'est pas encore relié à la ressource API NOVATECH." });
  if (!req.file) return res.status(400).json({ error: "Ajoutez le reçu ou la preuve de paiement (PDF, JPG ou PNG)." });
  if (!validFileSignature(req.file)) {
    return res.status(415).json({ error: "Le contenu du fichier ne correspond pas à un PDF, JPG ou PNG valide." });
  }

  const payment = {
    fullName: textField(req.body.fullName, 140),
    registrationNumber: textField(req.body.registrationNumber, 80),
    phone: textField(req.body.phone, 40),
    email: textField(req.body.email, 160).toLowerCase(),
    centre: textField(req.body.centre, 120),
    program: textField(req.body.program, 140),
    amount: Number(req.body.amount),
    paymentMethod: textField(req.body.paymentMethod, 50),
    transactionReference: textField(req.body.transactionReference, 100),
    paymentDate: textField(req.body.paymentDate, 30)
  };
  if (!payment.fullName || !payment.registrationNumber || !payment.phone || !payment.centre ||
      !payment.program || !Number.isInteger(payment.amount) || payment.amount <= 0 ||
      !payment.paymentMethod || !payment.transactionReference || !payment.paymentDate) {
    return res.status(400).json({ error: "Complétez les champs obligatoires avec des informations valides." });
  }
  if (payment.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.email)) {
    return res.status(400).json({ error: "L'adresse e-mail n'est pas valide." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.paymentDate) ||
      !Number.isFinite(Date.parse(payment.paymentDate)) ||
      Date.parse(payment.paymentDate) > Date.now() + 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "La date du paiement est invalide." });
  }

  try {
    const created = await withRegistryLock(async () => {
      const registry = await readRegistry();
      const duplicate = registry.submissions.find(item =>
        String(item.payment?.registrationNumber || "").toLowerCase() === payment.registrationNumber.toLowerCase() &&
        String(item.payment?.transactionReference || "").toLowerCase() === payment.transactionReference.toLowerCase()
      );
      if (duplicate) {
        throw new ApiError(409, { error: {
          code: "DUPLICATE_PAYMENT_REFERENCE",
          message: "Cette référence de transaction a déjà été transmise pour ce matricule. Vérifiez le dossier " + duplicate.id + " auprès de votre centre NOVATECH."
        }});
      }
      const id = submissionReference();
      const extension = fileExtension(req.file.originalname);
      const proofName = "NOVATECH_DEMO_PREUVE_" + id + "." + extension;
      const proof = await uploadProjectFile(req.file.buffer, proofName, req.file.mimetype);
      const now = new Date().toISOString();
      const record = {
        id,
        createdAt: now,
        updatedAt: now,
        status: "received",
        payment,
        proofFileId: proof.id,
        proofFileName: proofName,
        proofFileSize: req.file.size,
        proofMimeType: req.file.mimetype,
        history: [{ status: "received", at: now, actor: "stagiaire" }]
      };
      registry.submissions.push(record);
      await writeRegistry(registry);
      return record;
    });
    return res.status(201).json({
      success: true,
      reference: created.id,
      message: DEMO_MODE ? "Votre preuve de test a été reçue. Elle reste temporaire dans la démonstration." : "Votre preuve de paiement a été reçue et déposée dans le Drive NOVATECH.",
      status: created.status
    });
  } catch (error) {
    if (error.status) return errorJson(res, error);
    console.error("[NOVATECH submission]", error.message);
    return res.status(502).json({ error: error.message || "La preuve n'a pas pu être enregistrée." });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Le fichier dépasse la limite de 4 Mo du portail." });
  if (error?.message === "FORMAT_NOT_ALLOWED") return res.status(415).json({ error: "Format refusé. Utilisez un fichier PDF, JPG ou PNG." });
  console.error("[NOVATECH portal]", error?.message || "Erreur inconnue");
  return res.status(500).json({ error: "Une erreur interne est survenue. Réessayez ou contactez l'NOVATECH." });
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log("API NOVATECH DEMO démarrée sur le port " + port + " (demoMode=" + DEMO_MODE + ")");
});
