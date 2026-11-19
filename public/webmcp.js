// WebMCP door. Registers the site's tools with the browser so an in-browser agent can call them.
// Public tools are registered on every page. Engineer tools are only offered by /api/tools when the
// portal session cookie is present, and they are unregistered on sign-out. No OAuth: the browser
// session is the gate.
(() => {
  // The API lives on document.modelContext; navigator.modelContext was the earlier location.
  const mc = document.modelContext ?? navigator.modelContext;
  const registered = []; // { name, tier, controller }
  let offered = [];

  const badge = document.createElement("button");
  badge.id = "webmcp-badge";
  badge.type = "button";
  badge.setAttribute("aria-expanded", "false");
  badge.setAttribute("aria-controls", "webmcp-panel");
  const panel = document.createElement("div");
  panel.id = "webmcp-panel";
  panel.hidden = true;

  function render() {
    const active = Boolean(mc) && registered.length > 0;
    badge.dataset.state = active ? "active" : mc ? "idle" : "unavailable";
    badge.textContent = mc
      ? `WebMCP: active (${registered.length} tool${registered.length === 1 ? "" : "s"})`
      : "WebMCP: not available in this browser";
    const shown = mc ? registered : offered;
    const heading = mc ? "Tools registered on this page" : "Tools this page would register";
    const rows = shown.map((t) => `<li><code>${t.name}</code><span>${t.tier}</span></li>`).join("");
    const hint = mc
      ? "Engineer tools appear after signing in to the portal and disappear on sign-out."
      : "Use Chrome with chrome://flags/#enable-webmcp-testing switched on.";
    panel.innerHTML = `<h2>${heading}</h2><ul>${rows || "<li>None</li>"}</ul><p>${hint}</p><p>Fictional demo data. Not for real gas work.</p>`;
  }

  async function callTool(name, input) {
    // Same-origin fetch: the portal session cookie travels with it, so engineer tools need no token.
    const response = await fetch(`/api/tools/${name}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Tool call failed (${response.status})`);
    return result;
  }

  async function register(tool) {
    const controller = new AbortController();
    const definition = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
      execute: (input) => callTool(tool.name, input),
    };
    try {
      await mc.registerTool(definition, { signal: controller.signal });
      registered.push({ name: tool.name, tier: tool.tier, controller });
    } catch (error) {
      console.warn(`WebMCP: could not register ${tool.name}`, error);
    }
  }

  function unregisterEngineerTools() {
    for (let i = registered.length - 1; i >= 0; i--) {
      if (registered[i].tier === "engineer") {
        registered[i].controller.abort(); // Aborting the signal unregisters the tool.
        registered.splice(i, 1);
      }
    }
    render();
  }

  async function start() {
    document.body.append(panel, badge);
    render();
    badge.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      badge.setAttribute("aria-expanded", String(!panel.hidden));
    });
    document.querySelectorAll("form[data-logout]").forEach((form) => form.addEventListener("submit", unregisterEngineerTools));
    try {
      const response = await fetch("/api/tools", { credentials: "same-origin" });
      offered = (await response.json()).tools;
    } catch (error) {
      console.warn("WebMCP: could not load the tool list", error);
    }
    if (mc) for (const tool of offered) await register(tool);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
