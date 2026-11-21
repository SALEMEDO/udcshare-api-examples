(() => {
  const api = window.NOVATECH_API_BASE;
  if (!api) return;
  const $ = (root, selector) => root.querySelector(selector);
  function visitorKey() {
    const key = "novatech_demo_visitor_v1";
    try {
      let value = localStorage.getItem(key);
      if (!value) {
        value = window.crypto?.randomUUID?.() || ("nv-" + Date.now() + "-" + Math.random().toString(36).slice(2));
        localStorage.setItem(key, value);
      }
      return value;
    } catch {
      return window.crypto?.randomUUID?.() || ("nv-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    }
  }
  async function call(path, options = {}) {
    const response = await fetch(api + path, {
      ...options, credentials: "include",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "Compteurs indisponibles.");
    return data;
  }
  function paint(root, stats) {
    const views = $(root, "[data-views]");
    const likes = $(root, "[data-likes]");
    const button = $(root, "[data-like-toggle]");
    const login = $(root, "[data-like-login]");
    if (views) views.textContent = Number(stats.views || 0).toLocaleString("fr-FR") + " vues";
    if (likes) likes.textContent = Number(stats.likes || 0).toLocaleString("fr-FR") + " J'aime";
    if (button) {
      button.hidden = !stats.can_like;
      button.disabled = false;
      button.setAttribute("aria-pressed", String(Boolean(stats.liked)));
      button.textContent = stats.liked ? "♥ Aimé" : "♡ J'aime";
    }
    if (login) login.hidden = Boolean(stats.can_like);
  }
  document.querySelectorAll("[data-demo-engagement]").forEach(async root => {
    const slug = root.dataset.demoSlug;
    if (!slug) return;
    try {
      const stats = await call("/api/demos/" + encodeURIComponent(slug) + "/view", {
        method: "POST", body: JSON.stringify({ visitor_key: visitorKey() })
      });
      paint(root, stats);
    } catch {
      const views = $(root, "[data-views]");
      const likes = $(root, "[data-likes]");
      if (views) views.textContent = "Vues indisponibles";
      if (likes) likes.textContent = "J'aime indisponibles";
    }
    const button = $(root, "[data-like-toggle]");
    if (button) button.addEventListener("click", async () => {
      const liked = button.getAttribute("aria-pressed") !== "true";
      button.disabled = true;
      try {
        const stats = await call("/api/demos/" + encodeURIComponent(slug) + "/like", {
          method: "POST", body: JSON.stringify({ liked })
        });
        paint(root, stats);
      } catch (error) {
        button.disabled = false;
        button.title = error.message;
      }
    });
  });
})();