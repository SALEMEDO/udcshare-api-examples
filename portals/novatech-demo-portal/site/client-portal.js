// Cloudflare Pages deployment commit; GitHub Actions intentionally skipped for this change.
(() => {
  const API = window.NOVATECH_API_BASE;
  const $ = id => document.getElementById(id);
  let overview = null;

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options, credentials: "include",
      headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || data?.message || "Une erreur est survenue.");
      error.status = response.status;
      error.code = data?.error?.code;
      throw error;
    }
    return data;
  }
  function showMessage(id, text, error = false) {
    const node = $(id); node.textContent = text; node.classList.remove("hidden", "error");
    if (error) node.classList.add("error");
  }
  function bytes(value) {
    const n = Number(value || 0);
    if (!n) return "0 o";
    const units = ["o","Ko","Mo","Go","To"];
    const index = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
    return (n / Math.pow(1024, index)).toFixed(index ? 1 : 0) + " " + units[index];
  }
  let activePreviewUrl = "";
  function filePreviewUrl(file) {
    const id = file?.file_id || file?.id;
    return id ? String(id) : "";
  }
  async function openFilePreview(file) {
    const id = filePreviewUrl(file);
    if (!id) {
      showMessage("pageMessage", "Aperçu indisponible : identifiant du fichier introuvable.", true);
      return;
    }
    const dialog = $("filePreviewModal");
    const frame = $("filePreviewFrame");
    $("filePreviewTitle").textContent = file.name || file.filename || "Aperçu du fichier";
    frame.src = "about:blank";
    if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = "";
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    else dialog.setAttribute("open", "");
    try {
      const response = await fetch(API + "/api/client-demo/files/" + encodeURIComponent(id) + "/preview", {
        method: "GET", credentials: "include", cache: "no-store"
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error?.message || error?.message || "Le fichier n'a pas pu être récupéré.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Le fichier récupéré est vide.");
      activePreviewUrl = URL.createObjectURL(blob);
      frame.src = activePreviewUrl;
    } catch (error) {
      dialog.close?.();
      showMessage("pageMessage", "Aperçu impossible : " + error.message, true);
    }
  }
  function renderFiles(payload) {
    const files = Array.isArray(payload?.files) ? payload.files : (Array.isArray(payload) ? payload : []);
    const host = $("fileList"); host.replaceChildren();
    if (!files.length) {
      const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "Aucun fichier dans votre espace pour le moment.";
      host.append(empty); return;
    }
    files.forEach(file => {
      const row = document.createElement("div"); row.className = "file-row";
      const previewUrl = filePreviewUrl(file);
      const fileName = file.name || file.filename || "Fichier sans nom";
      if (previewUrl) {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "file-preview-thumb";
        thumb.textContent = "↗";
        thumb.setAttribute("aria-label", "Prévisualiser " + fileName);
        thumb.title = "Afficher l'aperçu UDCShare";
        thumb.addEventListener("click", () => openFilePreview(file));
        row.append(thumb);
      }
      const main = document.createElement("div"); main.className = "file-main";
      const name = document.createElement("strong"); name.textContent = fileName;
      const meta = document.createElement("small"); meta.textContent = bytes(file.size || file.filesize) + " · " + (file.created_at ? new Date(file.created_at).toLocaleString("fr-FR") : "Date inconnue");
      main.append(name, meta); row.append(main);
      const actions = document.createElement("div"); actions.className = "file-actions";
      if (previewUrl) {
        const preview = document.createElement("button");
        preview.className = "file-preview-btn"; preview.type = "button"; preview.textContent = "Aperçu ↗";
        preview.addEventListener("click", () => openFilePreview(file));
        actions.append(preview);
      }
      if (file.id) {
        const remove = document.createElement("button"); remove.className = "btn small ghost"; remove.type = "button"; remove.textContent = "Supprimer";
        remove.addEventListener("click", async () => {
          if (!confirm("Supprimer définitivement ce fichier de votre espace UDCShare ?")) return;
          remove.disabled = true;
          try { await request("/api/client-demo/files/" + encodeURIComponent(file.id), { method: "DELETE" }); await loadOverview(); }
          catch (error) { showMessage("pageMessage", error.message, true); remove.disabled = false; }
        });
        actions.append(remove);
      }
      row.append(actions); host.append(row);
    });
  }
  function renderOverview(data) {
    overview = data;
    const account = data.account || {};
    const stats = data.stats || {};
    const fileData = data.files || {};
    const files = Array.isArray(fileData.files) ? fileData.files : (Array.isArray(fileData) ? fileData : []);
    $("planValue").textContent = String(account.plan || "—").toUpperCase();
    $("filesValue").textContent = String(stats.total_files ?? fileData.total ?? files.length ?? "—");
    $("storageValue").textContent = stats.total_storage_bytes != null ? bytes(stats.total_storage_bytes) : (stats.total_storage_gb != null ? Number(stats.total_storage_gb).toFixed(2) + " Go" : "—");
    $("accountTitle").textContent = account.full_name || account.email || "Vue d'ensemble";
    const drive = data.status?.google_drive || {};
    const usage = data.usage || {};
    $("accountMeta").textContent = drive.message || (usage.quota ? "Quota API : " + usage.quota.used + " / " + usage.quota.limit : "Données privées lues depuis votre ressource API UDCShare.");
    $("connectionLabel").textContent = data.connection?.label || "API connectée";
    renderFiles(fileData);
  }
  async function loadOverview() {
    $("refreshBtn").disabled = true;
    try {
      const data = await request("/api/client-demo/overview");
      renderOverview(data);
      $("clientArea").classList.remove("hidden");
      $("pageMessage").classList.add("hidden");
    } catch (error) {
      if (error.status === 409 || error.code === "API_CONNECTION_REQUIRED") {
        showMessage("pageMessage", "Aucune clé API UDCShare n'est encore connectée à votre compte NOVATECH. Ouvrez le Playground, enregistrez votre clé API, puis revenez ici.");
      } else {
        showMessage("pageMessage", error.message, true);
      }
      $("clientArea").classList.remove("hidden");
      $("fileList").textContent = "Les fichiers seront affichés après connexion à l'API.";
    } finally { $("refreshBtn").disabled = false; }
  }
  $("clientLogoutBtn").addEventListener("click", async () => {
    const button = $("clientLogoutBtn");
    button.disabled = true;
    button.textContent = "Déconnexion…";
    try {
      await request("/api/auth/logout", { method: "POST" });
      window.location.replace("/app.html");
    } catch (error) {
      showMessage("pageMessage", "Impossible de terminer la déconnexion : " + error.message, true);
      button.disabled = false;
      button.textContent = "Se déconnecter";
    }
  });
  $("refreshBtn").addEventListener("click", loadOverview);
  $("closeFilePreview").addEventListener("click", () => {
    $("filePreviewModal").close?.();
    $("filePreviewFrame").src = "about:blank";
    if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = "";
  });
  $("filePreviewModal").addEventListener("click", event => {
    if (event.target === $("filePreviewModal")) {
      $("filePreviewModal").close?.();
      $("filePreviewFrame").src = "about:blank";
    }
  });
  $("filePreviewModal").addEventListener("close", () => {
    $("filePreviewFrame").src = "about:blank";
  });
  $("uploadForm").addEventListener("submit", async event => {
    event.preventDefault();
    const file = $("fileInput").files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showMessage("uploadMessage", "Cette démonstration accepte les fichiers de 50 Mo maximum.", true); return;
    }
    const form = new FormData(); form.append("file", file);
    $("uploadBtn").disabled = true; $("uploadBtn").textContent = "Envoi en cours…";
    try {
      const result = await request("/api/client-demo/upload", { method: "POST", body: form });
      showMessage("uploadMessage", "Fichier envoyé avec succès. " + (result.data?.file?.name || result.data?.filename || file.name));
      $("uploadForm").reset();
      await loadOverview();
    } catch (error) { showMessage("uploadMessage", error.message, true); }
    finally { $("uploadBtn").disabled = false; $("uploadBtn").textContent = "Envoyer le fichier →"; }
  });

  (async () => {
    try {
      const auth = await request("/api/auth/me");
      if (!auth.authenticated) throw new Error("AUTH_REQUIRED");
      $("clientArea").classList.remove("hidden");
      $("clientLogoutBtn").classList.remove("hidden");
      await loadOverview();
    } catch {
      $("loginRequired").classList.remove("hidden");
    }
  })();
})();