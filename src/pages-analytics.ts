// /demo/analytics: what agents asked, and through which door.
import { DOORS, getSummary, type Door } from "./analytics";
import { cardHead, html, page, raw } from "./html";
import type { Ctx } from "./pages-public";
import { tools } from "./tools";

const DOOR_KEYS = Object.keys(DOORS) as Door[];
const time = (ts: number) => new Date(ts).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export async function analyticsPage(c: Ctx): Promise<Response> {
  const s = await getSummary(c.env);
  const doorCount = (door: Door) => s.byDoor.find((d) => d.door === door)?.calls ?? 0;
  const gated = doorCount("mcp-engineer") + doorCount("webmcp-engineer");
  const perTool = tools.map((t) => {
    const cells = DOOR_KEYS.map((door) => s.byTool.filter((r) => r.tool === t.name && r.door === door).reduce((n, r) => n + r.calls, 0));
    return { tool: t, cells, total: cells.reduce((a, b) => a + b, 0) };
  });
  const maxTool = Math.max(1, ...perTool.map((r) => r.total));

  return page({
    env: c.env,
    session: c.session,
    path: c.url.pathname,
    noindex: true,
    title: "Tool-call analytics",
    description: "Which tools AI agents called on the Norvane demo, and through which door.",
    body: html`
<p class="crumbs"><a href="/demo">About this demo</a> / Analytics</p>
<h1>What agents asked, and through which door</h1>
<p class="lede">Every tool call made through MCP or WebMCP is counted here. It is the view a brand team would use to see what agents want, and how much of it sits behind the gate.</p>
<p class="muted">Recorded per call: the door, the tool, the boiler model and the fault code. Nothing else: no IP address, no engineer identity, no postcode. Kept for 90 days.</p>
${
  s.total === 0
    ? html`<div class="callout">No tool calls recorded yet. Connect an agent to <code>${c.env.PUBLIC_URL}/mcp</code>, or use the site in a WebMCP browser, and refresh.</div>`
    : html`
<ul class="grid">
<li class="card">${cardHead("Σ", "All tool calls")}<p class="stat">${s.total.toLocaleString("en-GB")}</p><p class="muted">${s.last24h.toLocaleString("en-GB")} in the last 24 hours. Since ${time(s.since!)}.</p></li>
<li class="card">${cardHead("G", "Through the gate", 3, true)}<p class="stat">${Math.round((gated / s.total) * 100)}%</p><p class="muted">${gated.toLocaleString("en-GB")} calls came from verified engineers.</p></li>
</ul>
<h2>Calls by door</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Door</th><th scope="col">Gate</th><th scope="col">Calls</th><th scope="col">Share</th></tr></thead><tbody>
${DOOR_KEYS.map((door) => html`<tr><td>${DOORS[door]}</td><td>${door.endsWith("engineer") ? "Verified engineer" : "Open"}</td><td>${doorCount(door).toLocaleString("en-GB")}</td><td>${Math.round((doorCount(door) / s.total) * 100)}%</td></tr>`)}
</tbody></table></div>
<h2>Calls by tool</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Tool</th><th scope="col">Level</th>${DOOR_KEYS.map((d) => html`<th scope="col">${DOORS[d]}</th>`)}<th scope="col">Total</th></tr></thead><tbody>
${perTool.map(
  (r) => html`<tr><td><code>${r.tool.name}</code></td><td><span class="tag${r.tool.tier === "engineer" ? " teal" : ""}">${r.tool.tier === "engineer" ? "Engineer" : "Homeowner"}</span></td>
${r.cells.map((n) => html`<td>${n || raw('<span class="muted">0</span>')}</td>`)}
<td><span class="bar-cell"><span class="bar" style="width:${Math.round((r.total / maxTool) * 100)}%"></span><span>${r.total}</span></span></td></tr>`,
)}
</tbody></table></div>
<h2>Fault codes asked about</h2>
<p class="muted">The same code, asked at two levels. This is the gap between what the public wants to know and what professionals need.</p>
${
  s.byCode.length
    ? html`<div class="table-scroll"><table><thead><tr><th scope="col">Code</th><th scope="col">Homeowner lookups</th><th scope="col">Engineer diagnostics</th></tr></thead><tbody>
${s.byCode.map((r) => html`<tr><td><strong>${r.code}</strong></td><td>${r.homeowner}</td><td>${r.engineer}</td></tr>`)}</tbody></table></div>`
    : html`<p>No fault code calls yet.</p>`
}
<h2>Models asked about</h2>
${
  s.byModel.length
    ? html`<div class="table-scroll"><table><thead><tr><th scope="col">Model</th><th scope="col">Calls</th></tr></thead><tbody>
${s.byModel.map((r) => html`<tr><td>${r.model}</td><td>${r.calls}</td></tr>`)}</tbody></table></div>`
    : html`<p>No model-specific calls yet.</p>`
}
<h2>Latest calls</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Time</th><th scope="col">Door</th><th scope="col">Tool</th><th scope="col">Model</th><th scope="col">Code</th><th scope="col">Result</th></tr></thead><tbody>
${s.recent.map((r) => html`<tr><td>${time(r.ts)}</td><td>${DOORS[r.door] ?? r.door}</td><td><code>${r.tool}</code></td><td>${r.model || "–"}</td><td>${r.code || "–"}</td><td>${r.ok ? "Answered" : "Not found"}</td></tr>`)}
</tbody></table></div>`
}`,
  });
}
