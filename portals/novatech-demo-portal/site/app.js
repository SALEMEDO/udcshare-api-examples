(() => {
  const API = window.NOVATECH_API_BASE;
  const $ = (id) => document.getElementById(id);
  let mode = "login";
  let pendingConfirmationEmail = "";
  let currentUser = null;
  let selectedConnection = null;
  let connections = [];

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      credentials: "include",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || data?.message || "Une erreur est survenue.");
    return data;
  }
  function message(id, text, error = false) {
    const node = $(id);
    node.textContent = text;
    node.classList.remove("hidden", "error");
    if (error) node.classList.add("error");
  }
  function hideMessage(id) { $(id).classList.add("hidden"); }
  function setMode(next) {
    mode = next;
    $("loginTab").classList.toggle("active", mode === "login");
    $("signupTab").classList.toggle("active", mode === "signup");
    $("nameField").classList.toggle("hidden", mode !== "signup");
    $("confirmPasswordField").classList.toggle("hidden", mode !== "signup");
    $("confirmPassword").disabled = mode !== "signup";
    if (mode !== "signup") $("confirmPassword").value = "";
    if (mode === "signup") $("resendConfirmation").classList.add("hidden");
    $("authSubmit").innerHTML = mode === "login" ? "Se connecter <span>→</span>" : "Créer mon espace <span>→</span>";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("password").minLength = mode === "login" ? 1 : 10;
    hideMessage("authMessage");
  }
  function showWorkspace(user) {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      window.location.replace(next);
      return;
    }
    currentUser = user;
    $("authView").classList.add("hidden");
    $("workspace").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("userEmail").textContent = user.email || "";
    $("userLabel").textContent = (user.name || user.email?.split("@")[0] || "développeur").split(" ")[0];
    loadConnections();
    loadHistory();
  }
  function showAuth() {
    currentUser = null;
    $("authView").classList.remove("hidden");
    $("workspace").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
  }
  $("loginTab").addEventListener("click", () => setMode("login"));
  $("signupTab").addEventListener("click", () => setMode("signup"));
  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage("authMessage");
    const enteredPassword = $("password").value;
    if (mode === "signup") {
      if (enteredPassword !== $("confirmPassword").value) {
        message("authMessage", "Les deux mots de passe ne correspondent pas.", true);
        return;
      }
      if (!/[a-z]/.test(enteredPassword) || !/[A-Z]/.test(enteredPassword) || !/[0-9]/.test(enteredPassword) || !/[^A-Za-z0-9]/.test(enteredPassword)) {
        message("authMessage", "Le mot de passe doit contenir une minuscule, une majuscule, un chiffre et un symbole.", true);
        return;
      }
    }
    $("authSubmit").disabled = true;
    try {
      const payload = { email: $("email").value.trim(), password: enteredPassword };
      if (mode === "signup") {
        payload.display_name = $("displayName").value.trim();
        const result = await request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
        if (result.authenticated) {
          showWorkspace({ email: payload.email, name: payload.display_name });
        } else {
          pendingConfirmationEmail = payload.email;
          setMode("login");
          $("email").value = payload.email;
          message("authMessage", result.message || "Vérifiez votre e-mail. Si vous avez déjà un compte NOVATECH ou UDCShare, essayez plutôt de vous connecter.");
          $("resendConfirmation").classList.remove("hidden");
        }
      } else {
        const result = await request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
        showWorkspace(result.user);
      }
    } catch (error) {
      message("authMessage", error.message, true);
    } finally { $("authSubmit").disabled = false; }
  });
  $("resendConfirmation").addEventListener("click", async () => {
    const email = $("email").value.trim() || pendingConfirmationEmail;
    if (!email) {
      message("authMessage", "Saisissez d'abord votre adresse e-mail.", true);
      return;
    }
    const button = $("resendConfirmation");
    button.disabled = true;
    button.textContent = "Envoi en cours…";
    try {
      const result = await request("/api/auth/resend-confirmation", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      message("authMessage", result.message || "Si cette adresse attend une confirmation, un nouvel e-mail vient d'être demandé.");
    } catch (error) {
      message("authMessage", error.message, true);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "Renvoyer l'e-mail de confirmation";
      }, 30000);
    }
  });

  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const field = $(button.dataset.togglePassword);
      const visible = field.type === "password";
      field.type = visible ? "text" : "password";
      button.textContent = visible ? "Masquer" : "Afficher";
      button.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
      button.setAttribute("aria-pressed", String(visible));
    });
  });

  $("logoutBtn").addEventListener("click", async () => {
    try { await request("/api/auth/logout", { method: "POST" }); } catch {}
    connections = []; selectedConnection = null; showAuth();
  });

  async function loadConnections() {
    try {
      const result = await request("/api/connections");
      connections = result.connections || [];
      if (!connections.some(item => item.id === selectedConnection)) selectedConnection = connections[0]?.id || null;
      renderConnections();
    } catch (error) { message("connectionMessage", error.message, true); }
  }
  function renderConnections() {
    const host = $("connectionsList");
    host.replaceChildren();
    const item = connections[0];
    if (!item) {
      host.innerHTML = '<div class="empty-state">Aucune configuration globale. Enregistrez votre API une seule fois pour toutes les démonstrations.</div>';
      document.querySelectorAll(".demo-card").forEach(button => button.disabled = true);
      return;
    }
    selectedConnection = item.id;
    document.querySelectorAll(".demo-card").forEach(button => button.disabled = false);
    const row = document.createElement("div");
    row.className = "connection-item selected";
    const info = document.createElement("div");
    const name = document.createElement("div"); name.className = "connection-name"; name.textContent = "Configuration API globale · " + item.label;
    const meta = document.createElement("div"); meta.className = "connection-meta"; meta.textContent = item.api_base_url + " · API client ID " + item.project_id;
    const state = document.createElement("span"); state.className = "status-pill " + (item.last_status === "connected" ? "ok" : item.last_status === "invalid_key" || item.last_status === "error" ? "bad" : "");
    state.textContent = item.last_status === "connected" ? "Connectée" : item.last_status === "invalid_key" ? "Clé invalide" : item.last_status === "error" ? "Erreur" : "À vérifier";
    const note = document.createElement("small"); note.textContent = "Cette configuration est partagée par toutes vos démonstrations NOVATECH.";
    info.append(name, meta, state, note);
    row.append(info); host.append(row);
  }
  $("connectionForm").addEventListener("submit", async (event) => {
    event.preventDefault(); hideMessage("connectionMessage");
    $("saveConnection").disabled = true;
    try {
      const payload = {
        label: $("connectionLabel").value.trim(),
        api_base_url: $("apiBase").value.trim(),
        project_id: $("projectId").value.trim(),
        api_key: $("apiKey").value.trim()
      };
      const result = await request("/api/connections", { method: "POST", body: JSON.stringify(payload) });
      $("apiKey").value = "";
      $("connectionForm").reset();
      $("connectionLabel").value = "Configuration globale UDCShare";
      $("apiBase").value = "https://www.udcshare.com/api/v1";
      message("connectionMessage", result.message);
      await loadConnections();
      selectedConnection = result.connection.id;
      renderConnections();
      await runTest("status");
    } catch (error) { message("connectionMessage", error.message, true); }
    finally { $("saveConnection").disabled = false; }
  });
  $("reloadConnections").addEventListener("click", loadConnections);

  async function runTest(endpoint) {
    if (!selectedConnection) { message("testMessage", "Sélectionnez d'abord une configuration API.", true); return; }
    const labels = { status: "État du projet", files: "Mes fichiers", usage: "Consommation API" };
    document.querySelectorAll(".demo-card").forEach(button => button.disabled = true);
    hideMessage("testMessage"); $("resultPanel").classList.add("hidden");
    try {
      const result = await request("/api/connections/" + encodeURIComponent(selectedConnection) + "/test/" + endpoint, { method: "POST", body: "{}" });
      $("resultTitle").textContent = labels[endpoint] + " · " + result.duration_ms + " ms";
      $("resultStatus").textContent = "HTTP " + result.status + " · Succès";
      $("resultStatus").className = "status-pill ok";
      $("resultBody").textContent = JSON.stringify(result.data, null, 2);
      $("resultPanel").classList.remove("hidden");
      message("testMessage", "Test réussi. Le résultat a été ajouté à votre historique.");
    } catch (error) {
      $("resultTitle").textContent = labels[endpoint] || "Résultat du test";
      $("resultStatus").textContent = "Échec";
      $("resultStatus").className = "status-pill bad";
      $("resultBody").textContent = error.message;
      $("resultPanel").classList.remove("hidden");
      message("testMessage", error.message, true);
    } finally {
      document.querySelectorAll(".demo-card").forEach(button => button.disabled = false);
      await loadConnections(); await loadHistory();
    }
  }
  document.querySelectorAll(".demo-card").forEach(button => button.addEventListener("click", () => runTest(button.dataset.endpoint)));

  async function loadHistory() {
    try {
      const result = await request("/api/history");
      const host = $("historyList"); host.replaceChildren();
      if (!(result.history || []).length) { host.innerHTML = '<div class="empty-state">Aucun test enregistré pour le moment.</div>'; return; }
      result.history.forEach(item => {
        const row = document.createElement("div"); row.className = "history-row";
        const main = document.createElement("div");
        const title = document.createElement("b"); title.textContent = item.endpoint_label;
        const date = document.createElement("small"); date.textContent = new Date(item.created_at).toLocaleString();
        main.append(title, date);
        const state = document.createElement("span"); state.className = "status-pill " + (item.success ? "ok" : "bad"); state.textContent = item.success ? "Réussi" : (item.error_code || "Échec");
        const duration = document.createElement("span"); duration.className = "duration"; duration.textContent = item.duration_ms == null ? "—" : item.duration_ms + " ms";
        row.append(main, state, duration); host.append(row);
      });
    } catch (error) { $("historyList").textContent = error.message; }
  }
  $("reloadHistory").addEventListener("click", loadHistory);

  (async () => {
    try {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const authError = fragment.get("error_description") || fragment.get("error");
      if (accessToken || refreshToken || authError) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        if (authError) throw new Error("Confirmation impossible : " + authError.replace(/\\+/g, " "));
        const callback = await request("/api/auth/callback", {
          method: "POST",
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
        });
        if (callback.authenticated) {
          showWorkspace(callback.user);
          message("authMessage", "Adresse e-mail confirmée. Bienvenue dans NOVATECH.");
          return;
        }
      }
      const cfg = await request("/api/config");
      if (!cfg.authReady || !cfg.credentialVaultReady) {
        message("authMessage", "Le service est en cours de configuration. Réessayez dans quelques instants.", true);
        return;
      }
      const result = await request("/api/auth/me");
      if (result.authenticated) showWorkspace(result.user);
    } catch { /* visiteur non connecté */ }
  })();
})();