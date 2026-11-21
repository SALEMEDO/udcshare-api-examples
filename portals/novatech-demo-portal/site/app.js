(() => {
  "use strict";

  const API = window.NOVATECH_API_BASE || "https://novatech-demo-api.onrender.com";
  const $ = id => document.getElementById(id);
  let submissions = [];
  let driveState = { connected: false };

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = { error: raw || "Réponse illisible du serveur." }; }
    if (!response.ok) {
      const error = new Error(data?.error?.message || data?.error || data?.message || "La demande n'a pas abouti.");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function notice(element, message, type = "info") {
    element.textContent = message;
    element.className = "notice " + type;
    element.classList.remove("hidden");
  }

  function hide(element) {
    element.classList.add("hidden");
    element.textContent = "";
  }

  function switchView(view) {
    $("publicView").classList.toggle("hidden", view !== "public");
    $("adminView").classList.toggle("hidden", view !== "admin");
    if (view === "admin") checkAdminSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshDriveStatus() {
    const portal = $("portalStatus");
    $("submitButton").disabled = true;
    portal.textContent = "Vérification du service";
    portal.className = "pill pending";
    try {
      const result = await request("/api/drive/status");
      driveState = { connected: Boolean(result.connected) };
      if (driveState.connected) {
        portal.textContent = result.demoMode ? "Mode démo actif" : "Service disponible";
        portal.className = "pill online";
        $("submitButton").disabled = false;
      } else {
        portal.textContent = "Dépôt temporairement indisponible";
        portal.className = "pill offline";
      }
    } catch {
      driveState = { connected: false };
      portal.textContent = "Service momentanément indisponible";
      portal.className = "pill offline";
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatAmount(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " CDF";
  }

  function statusLabel(status) {
    return status === "verified" ? "Vérifié" : status === "rejected" ? "Rejeté" : "À traiter";
  }

  $("adminNav").addEventListener("click", () => switchView("admin"));
  $("backToPortal").addEventListener("click", () => switchView("public"));

  $("proof").addEventListener("change", () => {
    const file = $("proof").files[0];
    if (!file) {
      $("fileHint").textContent = "PDF, JPG ou PNG · 4 Mo maximum";
      return;
    }
    const size = (file.size / 1024 / 1024).toFixed(2) + " Mo";
    $("fileHint").textContent = file.name + " · " + size;
  });

  $("submissionForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("submissionMessage");
    const file = $("proof").files[0];
    if (!file) return notice(message, "Sélectionnez le reçu de paiement.", "error");
    if (file.size > 4 * 1024 * 1024) return notice(message, "Le fichier dépasse la limite de 4 Mo.", "error");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      return notice(message, "Formats acceptés : PDF, JPG ou PNG.", "error");
    }
    if (!$("accuracy").checked) return notice(message, "Confirmez l'exactitude des informations avant l'envoi.", "error");

    const data = new FormData(form);
    const submit = $("submitButton");
    submit.disabled = true;
    submit.textContent = "Envoi en cours…";
    hide(message);
    $("confirmation").classList.add("hidden");
    try {
      const result = await request("/api/submissions", { method: "POST", body: data });
      $("confirmationReference").textContent = result.reference;
      $("confirmation").classList.remove("hidden");
      notice(message, result.message || "Votre preuve a été reçue.", "success");
      form.reset();
      $("fileHint").textContent = "PDF, JPG ou PNG · 4 Mo maximum";
      await refreshDriveStatus();
      $("confirmation").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      notice(message, error.message, "error");
      await refreshDriveStatus();
    } finally {
      submit.textContent = "Envoyer ma preuve de paiement";
      submit.disabled = !driveState.connected;
    }
  });

  async function loadDriveManagementLink() {
    const link = $("driveManageAdmin");
    const note = $("driveManageMessage");
    if (!link) return;
    try {
      const result = await request("/api/admin/drive/manage-url");
      const parsed = new URL(result.url);
      if (parsed.protocol !== "https:" || parsed.hostname !== "udcshare.com" ||
          !/^\/developers\/projects\/[a-f0-9-]{36}$/.test(parsed.pathname)) {
        throw new Error("Adresse du projet non reconnue.");
      }
      link.href = parsed.toString();
      link.removeAttribute("aria-disabled");
      note.textContent = "Lien vérifié. Si le projet n'apparaît pas, reconnectez-vous dans UDCShare avec le compte qui possède le projet NOVATECH.";
    } catch {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
      note.textContent = "Impossible de charger le lien protégé. Actualisez l'espace agents.";
    }
  }

  async function checkAdminSession() {
    $("adminLogin").classList.remove("hidden");
    $("adminBoard").classList.add("hidden");
    try {
      await request("/api/admin/session");
      $("adminLogin").classList.add("hidden");
      $("adminBoard").classList.remove("hidden");
      await loadDriveManagementLink();
      await loadSubmissions();
      await loadApiStatus();
      await loadApiUsage();
    } catch {
      // Aucune session agent active : afficher le formulaire de connexion.
    }
  }

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("loginMessage");
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    hide(message);
    try {
      await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: $("adminPassword").value })
      });
      $("adminPassword").value = "";
      $("adminLogin").classList.add("hidden");
      $("adminBoard").classList.remove("hidden");
      await loadDriveManagementLink();
      await loadSubmissions();
      await loadApiStatus();
      await loadApiUsage();
    } catch (error) {
      notice(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("logoutButton").addEventListener("click", async () => {
    try { await request("/api/admin/logout", { method: "POST" }); } catch {}
    $("adminBoard").classList.add("hidden");
    $("adminLogin").classList.remove("hidden");
    switchView("admin");
  });

  async function loadApiStatus() {
    const button = $("refreshApiStatus"), pill = $("apiStatusPill");
    const message = $("apiStatusMessage"), code = $("apiStatusCode"), reconnect = $("apiStatusReconnect");
    if (button) button.disabled = true;
    pill.textContent = "Vérification en cours"; pill.className = "pill pending";
    reconnect.classList.add("hidden"); reconnect.removeAttribute("href"); code.classList.add("hidden"); $("apiStatusDriveMode")?.classList.add("hidden");
    $("apiStatusDriveActions")?.classList.add("hidden");
    try {
      const data = await request("/api/admin/api-status");
      const api = data.api || {}, drive = data.google_drive || {}, state = data.overall_status || "degraded";
      const demo = api.code === "NOVATECH_DEMO_MODE";
      const operational = demo || (state === "operational" && api.status === "active" && ["connected", "not_required", "per_user"].includes(drive.status));
      pill.textContent = demo ? "Démonstration simulée" : operational ? "API opérationnelle" : state === "degraded" ? "Vérification momentanément indisponible" : state === "blocked" ? "Accès API bloqué" : "Action requise";
      pill.className = "pill " + (operational ? "online" : state === "degraded" ? "pending" : "offline");
      message.textContent = [api.message, drive.message].filter(Boolean).join(" ");
      message.className = "notice " + (operational ? "success" : state === "degraded" ? "info" : "error");
      code.textContent = "Code diagnostic : " + (drive.code || api.code || state); code.classList.remove("hidden");
      if (["reauthorization_required", "not_connected"].includes(drive.status) && drive.connect?.mode === "company" && drive.connect.url) {
        reconnect.href = drive.connect.url;
        reconnect.textContent = drive.status === "reauthorization_required" ? "Réautoriser le Google Drive du projet" : "Connecter le Google Drive du projet";
        reconnect.classList.remove("hidden");
      }
      const modeBox = $("apiStatusDriveMode");
      if (modeBox) {
        const modes = { company: "Drive entreprise : un seul compte Google partagé par le projet", individual: "Drive individuel : chaque utilisateur connecte son propre Google Drive" };
        const statuses = { connected: "connecté et autorisation vérifiée", reauthorization_required: "réautorisation Google nécessaire", not_connected: "non connecté", temporarily_unavailable: "contrôle momentanément indisponible", per_user: "connexion propre à chaque utilisateur", not_required: "non requis" };
        const parts = [];
        if (modes[drive.mode]) parts.push(modes[drive.mode]);
        if (statuses[drive.status]) parts.push("État : " + statuses[drive.status]);
        if (drive.account_email) parts.push("Compte connecté : " + drive.account_email);
        modeBox.textContent = parts.join(" · ");
        modeBox.classList.toggle("hidden", parts.length === 0);
      }
      $("apiStatusDriveActions")?.classList.toggle("hidden", !(drive.mode === "company" && drive.status === "connected"));
      $("apiStatusChecked").textContent = "Dernier contrôle : " + formatDate(data.checked_at);
    } catch (error) {
      pill.textContent = "Diagnostic indisponible"; pill.className = "pill offline";
      message.className = "notice error"; message.textContent = error.message || "Impossible de lire le diagnostic API.";
      code.textContent = "Le serveur NOVATECH n’a pas pu retourner l’état de l’intégration."; code.classList.remove("hidden");
    } finally { if (button) button.disabled = false; }
  }

  async function loadApiUsage() {
    const button = $("refreshApiUsage");
    const message = $("apiUsageMessage");
    if (button) button.disabled = true;
    try {
      const data = await request("/api/admin/api-usage");
      const quota = data.quota || {};
      const requests = data.requests || {};
      const used = Number(quota.used || 0);
      const limit = Number(quota.limit || 0);
      const remaining = Number(quota.remaining ?? Math.max(0, limit - used));
      const percent = Math.max(0, Math.min(100, Number(quota.percent || 0)));
      $("apiUsageFiles").textContent = limit > 0 ? used.toLocaleString("fr-FR") + " / " + limit.toLocaleString("fr-FR") : used.toLocaleString("fr-FR");
      $("apiUsagePlan").textContent = "Forfait " + (data.plan?.name || data.plan?.id || "actif") + " · " + remaining.toLocaleString("fr-FR") + " restant(s)";
      $("apiUsageUploads").textContent = Number(data.uploads?.successful || 0).toLocaleString("fr-FR");
      $("apiUsageUploadsFailed").textContent = Number(data.uploads?.failed || 0).toLocaleString("fr-FR");
      $("apiUsageRequests").textContent = Number(requests.total || 0).toLocaleString("fr-FR");
      $("apiUsageSuccess").textContent = Number(requests.successful || 0).toLocaleString("fr-FR");
      $("apiUsageErrors").textContent = Number(requests.failed || 0).toLocaleString("fr-FR");
      $("apiUsageRate").textContent = Number(requests.last_minute || 0) + " / " + Number(requests.per_minute_limit || 0);
      $("apiUsagePercent").textContent = percent + " % du quota utilisé";
      $("apiUsageReset").textContent = formatDate(quota.reset_at);
      $("apiUsageBar").style.width = percent + "%";
      $("apiUsageProgress").setAttribute("aria-valuenow", String(percent));
      $("apiUsageProgress").classList.toggle("is-warning", quota.level === "warning");
      $("apiUsageProgress").classList.toggle("is-blocked", quota.level === "blocked");
      message.className = "notice " + (quota.level === "blocked" ? "error" : quota.level === "warning" ? "info" : "success");
      message.textContent = quota.message || "Consommation API actualisée.";
      if (quota.level === "blocked") message.textContent += " Attendez la réinitialisation ou contactez UDCShare pour passer à un forfait supérieur.";
    } catch (error) {
      message.className = "notice error";
      message.textContent = error.message || "Impossible de charger la consommation API.";
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadSubmissions() {
    const note = $("registryNote");
    note.textContent = "Lecture du registre de démonstration…";
    $("refreshSubmissions").disabled = true;
    try {
      const result = await request("/api/admin/submissions");
      submissions = Array.isArray(result.submissions) ? result.submissions : [];
      $("totalCount").textContent = result.total ?? submissions.length;
      $("receivedCount").textContent = result.counts?.received ?? 0;
      $("verifiedCount").textContent = result.counts?.verified ?? 0;
      $("rejectedCount").textContent = result.counts?.rejected ?? 0;
      note.textContent = "Registre de démonstration · version " + (result.registryVersion || 0);
      hide($("adminMessage"));
      renderSubmissions();
    } catch (error) {
      notice($("adminMessage"), error.message, "error");
      $("submissionRows").innerHTML = '<tr><td colspan="6" class="empty">Impossible de charger les dossiers depuis le Drive.</td></tr>';
    } finally {
      $("refreshSubmissions").disabled = false;
    }
  }

  function renderSubmissions() {
    const query = $("searchSubmissions").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const rows = submissions.filter(item => {
      const p = item.payment || {};
      const searchable = [item.id, p.fullName, p.registrationNumber, p.phone, p.transactionReference, p.program, p.centre]
        .filter(Boolean).join(" ").toLowerCase();
      return (!query || searchable.includes(query)) && (!status || item.status === status);
    });
    const body = $("submissionRows");
    body.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "empty";
      td.textContent = submissions.length ? "Aucun dossier ne correspond aux filtres." : "Aucune preuve de paiement enregistrée pour le moment.";
      tr.append(td);
      body.append(tr);
      return;
    }
    rows.forEach(item => {
      const p = item.payment || {};
      const tr = document.createElement("tr");
      const applicant = document.createElement("td");
      const name = document.createElement("b");
      name.textContent = p.fullName || "Stagiaire";
      const ref = document.createElement("small");
      ref.textContent = (p.registrationNumber || "Sans matricule") + " · " + item.id;
      applicant.append(name, ref);

      const training = document.createElement("td");
      const program = document.createElement("b");
      program.textContent = p.program || "—";
      const centre = document.createElement("small");
      centre.textContent = p.centre || "—";
      training.append(program, centre);

      const payment = document.createElement("td");
      const amount = document.createElement("b");
      amount.textContent = formatAmount(p.amount);
      const transaction = document.createElement("small");
      transaction.textContent = (p.paymentMethod || "—") + " · " + (p.transactionReference || "—");
      payment.append(amount, transaction);

      const date = document.createElement("td");
      date.textContent = formatDate(item.createdAt);

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "status " + (item.status || "received");
      badge.textContent = statusLabel(item.status);
      statusCell.append(badge);

      const actions = document.createElement("td");
      const actionWrap = document.createElement("div");
      actionWrap.className = "row-actions";
      const proofUrl = API + "/api/admin/submissions/" + encodeURIComponent(item.id) + "/proof";
      const preview = document.createElement("a");
      preview.className = "btn small secondary";
      preview.href = proofUrl;
      preview.textContent = "Aperçu";
      preview.setAttribute("aria-label", "Visualiser la preuve de " + (p.fullName || item.id));
      preview.addEventListener("click", event => {
        event.preventDefault();
        $("proofPreviewTitle").textContent = "Preuve de paiement — " + (p.fullName || item.id);
        $("proofPreviewFrame").src = proofUrl;
        $("proofPreviewDialog").showModal();
      });

      const download = document.createElement("a");
      download.className = "btn small ghost";
      download.href = proofUrl + "?download=1";
      download.textContent = "Télécharger";
      download.setAttribute("aria-label", "Télécharger la preuve de " + (p.fullName || item.id));
      const select = document.createElement("select");
      [["received","À traiter"],["verified","Vérifié"],["rejected","Rejeté"]].forEach(([value,label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      });
      select.value = item.status || "received";
      select.setAttribute("aria-label", "Modifier le statut de " + (p.fullName || item.id));
      select.addEventListener("change", () => updateStatus(item.id, select.value));
      actionWrap.append(preview, download, select);
      actions.append(actionWrap);
      tr.append(applicant, training, payment, date, statusCell, actions);
      body.append(tr);
    });
  }

  async function updateStatus(id, status) {
    try {
      await request("/api/admin/submissions/" + encodeURIComponent(id) + "/status", {
        method: "POST",
        body: JSON.stringify({ status })
      });
      await loadSubmissions();
      await loadApiUsage();
    } catch (error) {
      notice($("adminMessage"), error.message, "error");
    }
  }

  $("closeProofPreview").addEventListener("click", () => {
    $("proofPreviewDialog").close();
    $("proofPreviewFrame").src = "about:blank";
  });
  $("proofPreviewDialog").addEventListener("click", event => {
    if (event.target === $("proofPreviewDialog")) {
      $("proofPreviewDialog").close();
      $("proofPreviewFrame").src = "about:blank";
    }
  });

  $("searchSubmissions").addEventListener("input", renderSubmissions);
  $("statusFilter").addEventListener("change", renderSubmissions);
  $("refreshSubmissions").addEventListener("click", loadSubmissions);
  $("refreshApiStatus").addEventListener("click", loadApiStatus);

  $("disconnectDrive")?.addEventListener("click", async () => {
    if (!window.confirm("Déconnecter le Drive entreprise ? Réversible : aucun fichier n'est supprimé, et le propriétaire pourra reconnecter le même compte sans nouveau consentement Google.")) return;
    $("disconnectDrive").disabled = true;
    try {
      await request("/api/admin/drive/disconnect", { method: "POST" });
      await loadApiStatus();
    } catch (error) {
      notice($("apiStatusMessage"), error.message || "La déconnexion du Drive a échoué.", "error");
    } finally {
      $("disconnectDrive").disabled = false;
    }
  });

  $("revokeDrive")?.addEventListener("click", async () => {
    if (!window.confirm("Révoquer complètement l'autorisation Google ? Aucun fichier n'est supprimé, mais une nouvelle autorisation Google complète (faite par le propriétaire du projet dans UDCShare) sera nécessaire pour reconnecter.")) return;
    $("revokeDrive").disabled = true;
    try {
      await request("/api/admin/drive/revoke", { method: "POST" });
      await loadApiStatus();
    } catch (error) {
      notice($("apiStatusMessage"), error.message || "La révocation de l'autorisation Google a échoué.", "error");
    } finally {
      $("revokeDrive").disabled = false;
    }
  });
  $("refreshApiUsage").addEventListener("click", loadApiUsage);

  refreshDriveStatus();
})();