(() => {
  const API = window.NOVATECH_API_BASE;
  const $ = (id) => document.getElementById(id);
  let mode = "login";
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
    $("authSubmit").innerHTML = mode === "login" ? "Se connecter <span>→</span>" : "Créer mon espace <span>→</span>";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("password").minLength = mode === "login" ? 1 : 10;
    hideMessage("authMessage");
  }
  function showWorkspace(user) {
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
    $("authSubmit").disabled = true;
    try {
      const payload = { email: $("email").value.trim(), password: $("password").value };
      if (mode === "signup") {
        payload.display_name = $("displayName").value.trim();
        const result = await request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
        if (result.authenticated) {
          showWorkspace({ email: payload.email, name: payload.display_name });
        } else {
          setMode("login");
          $("email").value = payload.email;
          message("authMessage", result.message || "Vérifiez votre e-mail pour confirmer votre compte.");
        }
      } else {
        const result = await request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
        showWorkspace(result.user);
      }
    } catch (error) {
      message("authMessage", error.message, true);
    } finally { $("authSubmit").disabled = false; }
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
    if (!connections.length) {
      host.innerHTML = '<div class="empty-state">Aucune configuration. Ajoutez votre API dans le formulaire.</div>';
      document.querySelectorAll(".demo-card").forEach(button => button.disabled = true);
      return;
    }
    document.querySelectorAll(".demo-card").forEach(button => button.disabled = false);
    host.replaceChildren();
    connections.forEach(item => {
      const row = document.createElement("div");
      row.className = "connection-item" + (item.id === selectedConnection ? " selected" : "");
      const info = document.createElement("div");
      const name = document.createElement("div"); name.className = "connection-name"; name.textContent = item.label;
      const meta = document.createElement("div"); meta.className = "connection-meta"; meta.textContent = item.api_base_url + " · Projet " + item.project_id;
      const state = document.createElement("span"); state.className = "status-pill " + (item.last_status === "connected" ? "ok" : item.last_status === "invalid_key" ? "bad" : "");
      state.textContent = item.last_status === "connected" ? "Connecté" : item.last_status === "invalid_key" ? "Clé invalide" : "À tester";
      info.append(name, meta, state);
      const actions = document.createElement("div"); actions.className = "connection-actions";
      const choose = document.createElement("button"); choose.className = "btn small"; choose.type = "button"; choose.textContent = item.id === selectedConnection ? "Sélectionnée" : "Choisir";
      choose.addEventListener("click", () => { selectedConnection = item.id; renderConnections(); });
      const del = document.createElement("button"); del.className = "btn small ghost"; del.type = "button"; del.textContent = "Supprimer";
      del.addEventListener("click", async () => {
        if (!confirm("Supprimer cette configuration API et sa clé chiffrée ?")) return;
        try { await request("/api/connections/" + encodeURIComponent(item.id), { method: "DELETE" }); if (selectedConnection === item.id) selectedConnection = null; await loadConnections(); }
        catch (error) { message("connectionMessage", error.message, true); }
      });
      actions.append(choose, del); row.append(info, actions); host.append(row);
    });
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
      $("connectionLabel").value = "Mon projet UDCShare";
      $("apiBase").value = "https://udcshare.com/api/v1";
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