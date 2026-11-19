// Engineer portal: the gated door on the website. Every page here is noindex and needs a session.
import { boilers, bulletins, byModel, checklists, faults, findBoiler, manuals, normaliseCode, partsFor } from "./data";
import { cardHead, html, list, page, raw, specTable, type Raw } from "./html";
import type { Ctx } from "./pages-public";

const base = (c: Ctx) => ({ env: c.env, session: c.session, path: c.url.pathname, noindex: true, portal: true });
const crumbs = (...parts: (string | Raw)[]) =>
  html`<p class="crumbs"><a href="/portal">Engineer portal</a>${parts.map((p) => html` / ${p}`)}</p>`;
const modelLinks = (prefix: string) =>
  html`<ul class="grid">${boilers.map((b) => html`<li class="card">${cardHead(b.name.slice(0, 3), b.fullName, 3, true)}<p>${b.typeLabel}</p><p><a href="${prefix}/${b.id}">Open</a></p></li>`)}</ul>`;

export function loginPage(c: Ctx, opts: { error?: string; next?: string; regNumber?: string; status?: number } = {}): Response {
  return page({
    ...base(c),
    title: "Engineer portal sign-in",
    description: "Sign in to the Norvane engineer portal.",
    status: opts.status,
    body: html`
<h1>Engineer portal</h1>
<p class="lede">For Norvane Registered Engineers. Sign in with your registration number and surname.</p>
${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
<form class="stack card" method="post" action="/portal/login">
<input type="hidden" name="next" value="${opts.next ?? "/portal"}">
<label>Registration number<input type="text" name="regNumber" value="${opts.regNumber ?? ""}" placeholder="NV-000000" autocomplete="off" required></label>
<label>Surname<input type="text" name="surname" autocomplete="family-name" required></label>
<button class="btn teal" type="submit">Sign in</button>
</form>
<p class="muted">This is a demo. Test credentials are on the <a href="/demo">demo page</a>.</p>`,
  });
}

export function dashboard(c: Ctx): Response {
  const cards: [string, string, string, string][] = [
    ["M", "Installation and servicing manuals", "Siting, flue, gas, commissioning and parameters.", "/portal/manuals"],
    ["F", "Fault diagnostics", "Diagnostic sequences, readings and likely parts for every code.", "/portal/faults"],
    ["P", "Parts", "Part numbers and trade prices by model.", "/portal/parts"],
    ["S", "Service checklists", "The annual service, step by step.", "/portal/checklists"],
    ["B", "Technical bulletins", `${bulletins.length} current bulletins.`, "/portal/bulletins"],
  ];
  return page({
    ...base(c),
    title: "Engineer portal",
    description: "Norvane engineer portal.",
    body: html`<h1>Engineer portal</h1>
<p class="lede">Welcome back, ${c.session!.name}. Everything here is for registered engineers only.</p>
<ul class="grid">${cards.map(([icon, title, text, href]) => html`<li class="card">${cardHead(icon, title, 2, true)}<p>${text}</p><p><a href="${href}">Open</a></p></li>`)}</ul>
<div class="callout teal">Using an AI assistant on site? The same content is available through the Norvane engineer connector at <code>${c.env.PUBLIC_URL}/mcp/pro</code>, and to in-browser agents on this site through WebMCP while you are signed in.</div>`,
  });
}

export function manualsIndex(c: Ctx): Response {
  return page({ ...base(c), title: "Installation and servicing manuals", description: "Manuals.", body: html`${crumbs("Manuals")}<h1>Installation and servicing manuals</h1>${modelLinks("/portal/manuals")}` });
}

export function manualPage(c: Ctx, id: string): Response | null {
  const b = findBoiler(id);
  if (!b || b.id !== id) return null;
  const m = byModel(manuals, b.id);
  const lengths = b.flue.maxLengthsM;
  const t = m.flueTerminalPositionsMm;
  return page({
    ...base(c),
    title: m.title,
    description: m.title,
    body: html`${crumbs(html`<a href="/portal/manuals">Manuals</a>`, b.name)}
<h1>${m.title}</h1><p class="muted">Document ${m.documentNumber}, revised ${m.revised}.</p>
<h2>Technical data</h2>
${specTable([
  ["Heat output", `${b.output.minimumKw} to ${b.output.centralHeatingKw} kW (${b.output.modulationRatio})`],
  ["Hot water output", b.output.hotWaterKw ? `${b.output.hotWaterKw} kW, ${b.output.hotWaterFlowRateLpm} l/min at 35 °C rise` : b.output.hotWaterNote],
  ["Gas connection", `${b.gas.connectionMm} mm`],
  ["Inlet pressure (G20)", `${b.gas.nominalInletPressureMbar} mbar nominal, ${b.gas.minimumWorkingInletPressureMbar} mbar minimum working`],
  ["Maximum gas rate", `${b.gas.maxGasRateM3h} m³/h`],
  ["Flue options", b.flue.options.join("; ")],
  ["Maximum flue lengths", `Horizontal 60/100: ${lengths.horizontal60_100} m. Vertical 60/100: ${lengths.vertical60_100} m. Concentric 80/125: ${lengths.concentric80_125} m. ${b.flue.bendAllowance}`],
  ["Clearances", `Above ${b.clearancesMm.above} mm, below ${b.clearancesMm.below} mm, sides ${b.clearancesMm.sides} mm, front ${b.clearancesMm.front} mm (${b.clearancesMm.frontInCupboard} mm in a cupboard)`],
  ["Condensate", `${b.condensate.connectionMm} mm connection, up to ${b.condensate.maxRateLph} l/h. ${b.condensate.siphon}. ${b.condensate.note}`],
  ["System pressure", `Minimum ${b.water.systemPressureBar.min} bar, cold fill ${b.water.systemPressureBar.normalCold}, maximum ${b.water.systemPressureBar.max} bar`],
  ["Electrical", `${b.electrical.supply}, ${b.electrical.maxPowerW} W maximum, ${b.electrical.ipRating}`],
  ["Dimensions and weight", `${b.dimensions.heightMm} × ${b.dimensions.widthMm} × ${b.dimensions.depthMm} mm, ${b.weightKg} kg`],
])}
<h2>Siting</h2>${list(m.siting)}
<h2>Flue terminal positions (minimum, mm)</h2>
${specTable([["Below an opening window", t.belowOpeningWindow], ["Below a gutter", t.belowGutter], ["From an internal corner", t.fromInternalCorner], ["Above ground", t.aboveGround], ["Facing a surface", t.facingSurface], ["Facing another terminal", t.facingTerminal], ["From an opening in a carport", t.fromOpeningInCarport]])}
<h2>Gas supply</h2><p>${m.gasSupply.note} Typical pipe size: ${m.gasSupply.typicalPipeSize}.</p>
<h2>System requirements</h2>${list(m.systemRequirements)}
<h2>Commissioning</h2>${list(m.commissioning, true)}
<h2>Combustion settings</h2>
${specTable([["CO2 at maximum rate (G20)", `${m.combustionSettings.co2MaxRatePercent}%`], ["CO2 at minimum rate (G20)", `${m.combustionSettings.co2MinRatePercent}%`], ["CO/CO2 ratio", `Below ${m.combustionSettings.coCo2RatioMax}`], ["CO2 at maximum rate (LPG)", `${m.combustionSettings.lpgCo2MaxRatePercent}%`]])}
<h2>Key parameters</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Code</th><th scope="col">Parameter</th><th scope="col">Range</th></tr></thead><tbody>
${m.keyParameters.map((p) => html`<tr><td><code>${p.code}</code></td><td>${p.name}</td><td>${p.range}</td></tr>`)}</tbody></table></div>
<p><a href="/portal/parts/${b.id}">Parts for the ${b.name}</a> · <a href="/portal/checklists/${b.id}">Service checklist</a></p>`,
  });
}

export function faultsIndex(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Fault diagnostics",
    description: "Fault diagnostics.",
    body: html`${crumbs("Fault diagnostics")}<h1>Fault diagnostics</h1>
<div class="table-scroll"><table><thead><tr><th scope="col">Code</th><th scope="col">Fault</th><th scope="col">Effect</th><th scope="col">Models</th></tr></thead><tbody>
${faults.map((f) => html`<tr><td><a href="/portal/faults/${f.code}"><strong>${f.code}</strong></a></td><td>${f.title}</td><td>${f.severity}</td><td>${f.appliesTo.map((id) => findBoiler(id)!.name).join(", ")}</td></tr>`)}
</tbody></table></div>`,
  });
}

export function faultPage(c: Ctx, codeInput: string): Response | null {
  const f = faults.find((x) => x.code === normaliseCode(codeInput));
  if (!f) return null;
  const selected = findBoiler(c.url.searchParams.get("model") ?? "");
  const models = f.appliesTo.map((id) => findBoiler(id)!);
  return page({
    ...base(c),
    title: `${f.code} ${f.title}: engineer diagnostic`,
    description: f.title,
    body: html`${crumbs(html`<a href="/portal/faults">Fault diagnostics</a>`, f.code)}
<h1>${f.code}: ${f.title}</h1><p class="muted">${f.severity}. Applies to: ${models.map((b) => b.name).join(", ")}.</p>
<h2>Diagnostic sequence</h2>${list(f.engineer.diagnosticSequence, true)}
<h2>Readings to take</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Measurement</th><th scope="col">Expected</th></tr></thead><tbody>
${f.engineer.readings.map((r) => html`<tr><td>${r.measurement}</td><td>${r.expected}</td></tr>`)}</tbody></table></div>
<h2>Likely parts</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Part</th>${models.map((b) => html`<th scope="col">${b.name}</th>`)}</tr></thead><tbody>
${f.engineer.likelyPartKeys.map((key) => {
  const description = models.map((b) => partsFor(b.id).find((p) => p.key === key)).find(Boolean)?.description ?? key;
  return html`<tr><td>${description}</td>${models.map((b) => {
    const part = partsFor(b.id).find((p) => p.key === key);
    return html`<td${selected?.id === b.id ? raw(' style="background:#e3f1ef"') : ""}>${part ? html`<code>${part.partNumber}</code>` : "Not fitted"}</td>`;
  })}</tr>`;
})}</tbody></table></div>
<h2>Model-specific notes</h2>
${f.engineer.modelNotes.length ? specTable(f.engineer.modelNotes.map((n) => [findBoiler(n.model)!.name, n.note] as [string, string])) : html`<p>None.</p>`}
<h2>What the homeowner sees</h2><p class="muted">${f.homeowner.whatItMeans} ${f.homeowner.safeThingToTry}</p>`,
  });
}

export function partsIndex(c: Ctx): Response {
  return page({ ...base(c), title: "Parts", description: "Parts.", body: html`${crumbs("Parts")}<h1>Parts by model</h1>${modelLinks("/portal/parts")}` });
}

export function partsPage(c: Ctx, id: string): Response | null {
  const b = findBoiler(id);
  if (!b || b.id !== id) return null;
  return page({
    ...base(c),
    title: `${b.fullName} parts list`,
    description: "Parts list.",
    body: html`${crumbs(html`<a href="/portal/parts">Parts</a>`, b.name)}<h1>${b.fullName} parts</h1>
<div class="table-scroll"><table><thead><tr><th scope="col">Part number</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Trade price</th></tr></thead><tbody>
${partsFor(b.id).map((p) => html`<tr><td><code>${p.partNumber}</code></td><td>${p.description}</td><td>${p.category}</td><td>£${p.tradePriceGbp}</td></tr>`)}</tbody></table></div>`,
  });
}

export function checklistsIndex(c: Ctx): Response {
  return page({ ...base(c), title: "Service checklists", description: "Service checklists.", body: html`${crumbs("Service checklists")}<h1>Service checklists</h1>${modelLinks("/portal/checklists")}` });
}

export function checklistPage(c: Ctx, id: string): Response | null {
  const b = findBoiler(id);
  if (!b || b.id !== id) return null;
  const k = byModel(checklists, b.id);
  return page({
    ...base(c),
    title: k.title,
    description: k.title,
    body: html`${crumbs(html`<a href="/portal/checklists">Service checklists</a>`, b.name)}<h1>${k.title}</h1>
<p class="muted">Every ${k.intervalMonths} months. About ${k.estimatedMinutes} minutes. Service kit <code>${k.serviceKitPartNumber}</code>.</p>
${k.sections.map((s) => html`<h2>${s.section}</h2><ol start="${s.tasks[0].step}">${s.tasks.map((t) => html`<li>${t.task}</li>`)}</ol>`)}`,
  });
}

export function bulletinsIndex(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Technical bulletins",
    description: "Technical bulletins.",
    body: html`${crumbs("Technical bulletins")}<h1>Technical bulletins</h1>
<ul class="grid">${bulletins.map((t) => html`<li class="card">${cardHead("TB", t.title, 2, true)}<p><span class="tag teal">${t.id}</span> <span class="tag">${t.severity}</span></p>
<p>${t.summary}</p><p class="muted">${t.date}. Affects: ${t.affectedModels.map((id) => findBoiler(id)!.name).join(", ")}.</p><p><a href="/portal/bulletins/${t.id}">Read ${t.id}</a></p></li>`)}</ul>`,
  });
}

export function bulletinPage(c: Ctx, id: string): Response | null {
  const t = bulletins.find((x) => x.id === id.toUpperCase());
  if (!t) return null;
  return page({
    ...base(c),
    title: `${t.id}: ${t.title}`,
    description: t.title,
    body: html`${crumbs(html`<a href="/portal/bulletins">Technical bulletins</a>`, t.id)}<h1>${t.title}</h1>
<p><span class="tag teal">${t.id}</span> <span class="tag">${t.severity}</span> <span class="muted">${t.date}</span></p>
${specTable([["Affected models", t.affectedModels.map((id) => findBoiler(id)!.name).join(", ")], ["Serial range", t.affectedSerialRange], ["Parts required", t.partsRequired]])}
<h2>Summary</h2><p>${t.summary}</p><h2>Detail</h2><p>${t.detail}</p><h2>Action</h2>${list(t.action, true)}`,
  });
}
