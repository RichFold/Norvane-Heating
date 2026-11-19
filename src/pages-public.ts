// Public door: crawlable pages written for homeowners.
import { boilers, byModel, faults, findBoiler, guides, installers, postcodeArea, warranty, type Boiler } from "./data";
import { boilerArt, cardHead, html, list, page, raw, specTable, type Raw } from "./html";
import { tools } from "./tools";
import type { EngineerProps, Env } from "./types";
import { ENGINEER_POINTER } from "./types";

export interface Ctx {
  env: Env;
  url: URL;
  session: EngineerProps | null;
}

const base = (c: Ctx) => ({ env: c.env, session: c.session, path: c.url.pathname });

const boilerCard = (b: Boiler): Raw => html`<li class="card">
${cardHead(b.name.slice(0, 3), b.fullName)}
<p><span class="tag">${b.typeLabel}</span> <span class="tag ember">${b.warrantyYears}-year warranty</span></p>
<p>${b.summary}</p>
<p class="muted">Best for ${b.suitableFor.bedrooms} bedrooms, ${b.suitableFor.bathrooms} bathroom(s). ${b.priceBand}.</p>
<p><a href="/boilers/${b.id}">See the ${b.name}</a></p>
</li>`;

export function home(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Quietly efficient boilers for British homes",
    description: "Norvane Heating makes combi, system, regular and hybrid boilers. Browse the range, read your user guide or look up a fault code.",
    body: html`
<section class="hero">
<h1>Warm homes, without the drama.</h1>
<p>Six boilers, from a compact combi for a flat to a hybrid heat pump system for a family home. Every one comes with a long warranty and a user guide you can actually follow.</p>
<div class="actions"><a class="btn" href="/boilers">See the range</a><a class="btn ghost" href="/fault-codes">Look up a fault code</a></div>
</section>
<h2>Popular boilers</h2>
<ul class="grid">${boilers.filter((b) => ["c30", "s25", "h30"].includes(b.id)).map(boilerCard)}</ul>
<h2>Help for homeowners</h2>
<ul class="grid">
<li class="card">${cardHead("1", "User guides")}<p>How to use the controls, top up the pressure and reset your boiler.</p><p><a href="/guides">Find your user guide</a></p></li>
<li class="card">${cardHead("2", "Fault codes")}<p>What the code on your display means, and the one safe thing to try.</p><p><a href="/fault-codes">Look up a code</a></p></li>
<li class="card">${cardHead("3", "Find an installer")}<p>Norvane Approved Installers near you, for fitting, servicing and repairs.</p><p><a href="/find-an-installer">Search by postcode</a></p></li>
<li class="card">${cardHead("4", "Warranty")}<p>Up to 12 years of cover. See what keeps it valid and how to claim.</p><p><a href="/warranty">Read the warranty terms</a></p></li>
</ul>
<h2>For heating engineers</h2>
<div class="card">${cardHead("NV", "Norvane engineer portal", 3, true)}
<p>Installation and servicing manuals, full fault diagnostics, parts lists, service checklists and technical bulletins for Norvane Registered Engineers.</p>
<p><a class="btn teal" href="/portal">Go to the engineer portal</a></p></div>`,
  });
}

export function range(c: Ctx): Response {
  const type = c.url.searchParams.get("type") ?? "";
  const shown = boilers.filter((b) => !type || b.type === type);
  return page({
    ...base(c),
    title: "Boiler range",
    description: "The Norvane boiler range: C24, C30 and C35 combi boilers, the S25 system boiler, the R18 regular boiler and the H30 Hybrid heat pump system.",
    body: html`
<h1>The Norvane range</h1>
<p class="lede">Three combis, a system boiler, a regular boiler and a hybrid heat pump system. All A-rated, all built around the same quiet, reliable core.</p>
<p>${[["", "All"], ["combi", "Combi"], ["system", "System"], ["regular", "Regular"], ["hybrid", "Hybrid"]].map(
      ([value, label]) => html`<a class="tag${type === value ? " ember" : ""}" href="/boilers${value ? `?type=${value}` : ""}">${label}</a> `,
    )}</p>
<ul class="grid">${shown.map(boilerCard)}</ul>
<h2>Compare at a glance</h2>
<div class="table-scroll"><table>
<thead><tr><th scope="col">Model</th><th scope="col">Type</th><th scope="col">Heating</th><th scope="col">Hot water</th><th scope="col">Size (H × W × D)</th><th scope="col">Warranty</th></tr></thead>
<tbody>${boilers.map(
      (b) => html`<tr><td><a href="/boilers/${b.id}">${b.name}</a></td><td>${b.typeLabel}</td><td>${b.output.centralHeatingKw} kW</td>
<td>${b.output.hotWaterFlowRateLpm ? `${b.output.hotWaterFlowRateLpm} l/min` : "Via cylinder"}</td>
<td>${b.dimensions.heightMm} × ${b.dimensions.widthMm} × ${b.dimensions.depthMm} mm</td><td>${b.warrantyYears} years</td></tr>`,
    )}</tbody></table></div>`,
  });
}

export function boilerPage(c: Ctx, id: string): Response | null {
  const b = findBoiler(id);
  if (!b || b.id !== id) return null;
  const url = `${c.env.PUBLIC_URL}/boilers/${b.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: b.fullName,
    description: b.summary,
    sku: `NV-${b.id.toUpperCase()}`,
    category: b.typeLabel,
    url,
    brand: { "@type": "Brand", name: "Norvane Heating" },
    offers: { "@type": "AggregateOffer", priceCurrency: "GBP", lowPrice: b.priceFromGbp, highPrice: b.priceToGbp, availability: "https://schema.org/InStock" },
    weight: { "@type": "QuantitativeValue", value: b.weightKg, unitCode: "KGM" },
    height: { "@type": "QuantitativeValue", value: b.dimensions.heightMm, unitCode: "MMT" },
    width: { "@type": "QuantitativeValue", value: b.dimensions.widthMm, unitCode: "MMT" },
    depth: { "@type": "QuantitativeValue", value: b.dimensions.depthMm, unitCode: "MMT" },
    additionalProperty: [
      ["Central heating output", `${b.output.centralHeatingKw} kW`],
      ["Hot water output", b.output.hotWaterKw ? `${b.output.hotWaterKw} kW` : "Via cylinder"],
      ["ErP heating rating", b.efficiency.erpHeating],
      ["Seasonal space heating efficiency", `${b.efficiency.seasonalSpaceHeatingPercent}%`],
      ["Warranty", `${b.warrantyYears} years`],
      ["Disclaimer", "Fictional demo data. Not for real gas work."],
    ].map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
  };
  const hp = b.heatPump as Record<string, any> | undefined;
  return page({
    ...base(c),
    title: `${b.fullName} ${b.typeLabel.toLowerCase()}`,
    description: `${b.fullName}: ${b.summary}`,
    jsonLd,
    body: html`
<p class="crumbs"><a href="/boilers">Boilers</a> / ${b.name}</p>
<div class="split">
<div>
<h1>${b.fullName}</h1>
<p><span class="tag">${b.typeLabel}</span> <span class="tag ember">${b.warrantyYears}-year warranty</span> <span class="tag">ErP ${b.efficiency.erpHeating}</span></p>
<p class="lede">${b.summary}</p>
<p><strong>${b.priceBand}</strong></p>
<p>Best for ${b.suitableFor.bedrooms} bedrooms and ${b.suitableFor.bathrooms} bathroom(s).</p>
<div class="actions"><a class="btn" href="/find-an-installer">Find an installer</a><a class="btn plain" href="/guides/${b.id}">Read the user guide</a></div>
</div>
<div class="boiler-art">${boilerArt(b.name, b.type === "hybrid")}</div>
</div>
<h2>Specification</h2>
${specTable([
  ["Central heating output", `${b.output.minimumKw} to ${b.output.centralHeatingKw} kW (modulation ${b.output.modulationRatio})`],
  ["Hot water", b.output.hotWaterKw ? `${b.output.hotWaterKw} kW, ${b.output.hotWaterFlowRateLpm} litres per minute at a 35 °C rise` : b.output.hotWaterNote],
  ["Efficiency", `${b.efficiency.seasonalSpaceHeatingPercent}% seasonal space heating. ErP heating ${b.efficiency.erpHeating}, hot water ${b.efficiency.erpHotWater}`],
  ["Sound power", `${b.efficiency.soundPowerDb} dB(A)`],
  ["Dimensions (H × W × D)", `${b.dimensions.heightMm} × ${b.dimensions.widthMm} × ${b.dimensions.depthMm} mm`],
  ["Weight", `${b.weightKg} kg`],
  ["Fuel", b.fuel],
  ["Flue options", b.flue.options.join("; ")],
  ["Clearances", `Above ${b.clearancesMm.above} mm, below ${b.clearancesMm.below} mm, sides ${b.clearancesMm.sides} mm, front ${b.clearancesMm.front} mm (${b.clearancesMm.frontInCupboard} mm to a cupboard door)`],
  ["Warranty", `${b.warrantyYears} years, with an annual service`],
])}
${
  hp
    ? html`<h2>Heat pump unit</h2>${specTable([
        ["Heat pump output", `${hp.outputKw} kW`],
        ["Seasonal performance (SCOP)", hp.scop],
        ["Refrigerant", hp.refrigerant],
        ["Outdoor unit size (H × W × D)", `${hp.outdoorUnitDimensionsMm.heightMm} × ${hp.outdoorUnitDimensionsMm.widthMm} × ${hp.outdoorUnitDimensionsMm.depthMm} mm`],
        ["Outdoor unit sound power", `${hp.soundPowerDb} dB(A)`],
        ["Works in outdoor temperatures of", `${hp.operatingRangeC} °C`],
      ])}`
    : ""
}
<p class="muted">Installation data such as gas pressures, flue lengths and commissioning settings is in the installation and servicing manual, which is available to registered engineers in the <a href="/portal">engineer portal</a>.</p>`,
  });
}

export function guidesIndex(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Homeowner user guides",
    description: "User guides for every Norvane boiler: controls, topping up pressure, resetting, frost protection and annual servicing.",
    body: html`<h1>User guides</h1>
<p class="lede">Pick your boiler. The model name is printed on the front of the drop-down flap.</p>
<ul class="grid">${boilers.map(
      (b) => html`<li class="card">${cardHead(b.name.slice(0, 3), `${b.fullName} user guide`)}<p>${b.typeLabel}</p><p><a href="/guides/${b.id}">Open the ${b.name} guide</a></p></li>`,
    )}</ul>`,
  });
}

export function guidePage(c: Ctx, id: string): Response | null {
  const b = findBoiler(id);
  if (!b || b.id !== id) return null;
  const g = byModel(guides, b.id);
  return page({
    ...base(c),
    title: g.title,
    description: `How to use your ${b.fullName}: controls, topping up the pressure, resetting, frost protection and the annual service.`,
    body: html`
<p class="crumbs"><a href="/guides">User guides</a> / ${b.name}</p>
<h1>${g.title}</h1>
<p class="lede">Everything here is safe for you to do yourself. Nothing in this guide needs the boiler case to be opened.</p>
<div class="callout"><strong>If you smell gas:</strong> leave the property and call the National Gas Emergency Service on 0800 111 999.</div>
<h2>Controls</h2><p>${g.controls.summary}</p>
${specTable(g.controls.items.map((i) => [i.control, i.description] as [string, string]))}
<h2>Topping up the pressure</h2><p><strong>Normal range:</strong> ${g.toppingUpPressure.normalRange}</p>
${list(g.toppingUpPressure.steps, true)}<div class="callout">${g.toppingUpPressure.warning}</div>
<h2>Resetting the boiler</h2>${list(g.reset.steps, true)}<p>${g.reset.limit}</p><div class="callout">${g.reset.warning}</div>
<h2>Frost protection</h2><p>${g.frostProtection.summary}</p>${list(g.frostProtection.details)}
<h2>Annual service</h2><p>${g.annualService.summary}</p>${list(g.annualService.whatToExpect)}
<h2>Everyday tips</h2>${list(g.dailyUseTips)}
<p>Seeing a code on the display? <a href="/fault-codes?model=${b.id}">Look up ${b.name} fault codes</a>.</p>`,
  });
}

export function faultCodes(c: Ctx): Response {
  const model = findBoiler(c.url.searchParams.get("model") ?? "");
  const shown = faults.filter((f) => !model || f.appliesTo.includes(model.id));
  return page({
    ...base(c),
    title: "Boiler fault codes explained",
    description: "What Norvane boiler fault codes mean, the one safe thing to try, and when to call a registered engineer. Covers F01 to F61.",
    body: html`
<h1>Fault codes</h1>
<p class="lede">Find the code on your boiler's display. Each one tells you what it means, the one safe thing to try, and when to call an engineer.</p>
<form class="inline-form" method="get" action="/fault-codes"><label>Show codes for my boiler
<select name="model"><option value="">All models</option>${boilers.map((b) => html`<option value="${b.id}"${model?.id === b.id ? raw(" selected") : ""}>${b.fullName}</option>`)}</select></label>
<button class="btn" type="submit">Show</button></form>
<div class="callout"><strong>If you smell gas:</strong> do not reset the boiler. Leave the property and call the National Gas Emergency Service on 0800 111 999.</div>
${shown.map(
  (f) => html`<section class="card fault" id="${f.code}">
${cardHead(f.code, f.title, 2)}
<p class="muted">${f.severity}. Applies to: ${f.appliesTo.map((id) => findBoiler(id)!.name).join(", ")}.</p>
<h3>What it means</h3><p>${f.homeowner.whatItMeans}</p>
<h3>The one safe thing to try</h3><p>${f.homeowner.safeThingToTry}</p>
<h3>When to call an engineer</h3><p>${f.homeowner.whenToCallAnEngineer}</p>
</section>`,
)}
<p class="muted">${ENGINEER_POINTER} <a href="/portal">Engineer portal</a>.</p>`,
  });
}

export function findInstaller(c: Ctx): Response {
  const query = c.url.searchParams.get("postcode") ?? "";
  const area = query ? postcodeArea(query) : undefined;
  const matches = area ? installers.filter((i) => i.postcodeAreas.includes(area)) : [];
  const card = (i: (typeof installers)[number]) => html`<li class="card">${cardHead(i.town.slice(0, 2).toUpperCase(), i.name)}
<p>${i.town}. Rated ${i.rating} out of 5.</p><p><a href="tel:${i.phone.replace(/\s/g, "")}">${i.phone}</a></p>
<p class="muted">Fits: ${i.installs.join(", ")}. Covers: ${i.postcodeAreas.join(", ")}.</p></li>`;
  return page({
    ...base(c),
    path: "/find-an-installer",
    title: "Find a Norvane Approved Installer",
    description: "Search for a Norvane Approved Installer by postcode. Approved installers add 2 years to your boiler warranty.",
    body: html`
<h1>Find an installer</h1>
<p class="lede">Norvane Approved Installers fit, service and repair our boilers, and add 2 years to your warranty.</p>
<form class="inline-form" method="get" action="/find-an-installer"><label>Your postcode
<input type="text" name="postcode" value="${query}" autocomplete="postal-code" placeholder="For example LS6 2AB" required></label>
<button class="btn" type="submit">Search</button></form>
${
  query
    ? !area
      ? html`<p class="error" role="alert">That does not look like a UK postcode. Try something like LS6 2AB.</p>`
      : matches.length
        ? html`<h2>Installers covering ${area}</h2><ul class="grid">${matches.map(card)}</ul>`
        : html`<div class="callout">No approved installer covers ${area} yet. Call us on ${warranty.helpline} and we will find the nearest one.</div>`
    : ""
}
<h2>All approved installers</h2><ul class="grid">${installers.map(card)}</ul>`,
  });
}

export function warrantyPage(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Boiler warranty",
    description: "Norvane boiler warranties run from 7 to 12 years. See what is covered, what keeps the warranty valid and how to make a claim.",
    body: html`
<h1>Warranty</h1>
<p class="lede">Every Norvane boiler has a parts and labour warranty. ${warranty.extendedWarranty}</p>
<div class="table-scroll"><table><thead><tr><th scope="col">Model</th><th scope="col">Type</th><th scope="col">Standard warranty</th></tr></thead>
<tbody>${boilers.map((b) => html`<tr><td><a href="/boilers/${b.id}">${b.fullName}</a></td><td>${b.typeLabel}</td><td>${b.warrantyYears} years</td></tr>`)}</tbody></table></div>
<h2>Keeping your warranty valid</h2><p>${warranty.registration}</p>${list(warranty.conditions)}
<h2>What is covered</h2>${list(warranty.covered)}
<h2>What is not covered</h2>${list(warranty.notCovered)}
<h2>How to claim</h2><p>${warranty.howToClaim}</p>`,
  });
}

export function demoPage(c: Ctx): Response {
  const origin = c.env.PUBLIC_URL;
  const names = (tier: string) => list(tools.filter((t) => t.tier === tier).map((t) => html`<code>${t.name}</code>`));
  return page({
    ...base(c),
    title: "How this demo works",
    description: "A reference demo by Fold Digital: one set of gated professional content served to AI agents through a website, a remote MCP server and WebMCP.",
    body: html`
<h1>One set of content, three doors for AI agents</h1>
<p class="lede">Norvane Heating is a fictional boiler maker. This site shows how a brand with gated professional content can serve AI agents: the same question gets a homeowner answer or an engineer answer, depending on which door the agent comes through and whether it has passed the gate.</p>
<div class="doors">
<section class="card">${cardHead("1", "The website", 2)}
<p><strong>Who uses it:</strong> people, search crawlers, and agents that browse.</p>
<p><strong>Public:</strong> range, product pages with Schema.org data, user guides, fault codes, installers, warranty.</p>
<p><strong>Gated:</strong> the <a href="/portal">engineer portal</a>. Sign in with a registration number and surname. Portal pages are <code>noindex</code>.</p></section>
<section class="card">${cardHead("2", "Remote MCP", 2)}
<p><strong>Who uses it:</strong> assistants such as Claude, through a connector.</p>
<p><strong>Public:</strong> <code>${origin}/mcp</code><br>No sign-in. Homeowner tools only.</p>
<p><strong>Gated:</strong> <code>${origin}/mcp/pro</code><br>OAuth. The sign-in screen is the engineer verification page. Adds the engineer tools.</p></section>
<section class="card">${cardHead("3", "WebMCP", 2)}
<p><strong>Who uses it:</strong> an agent inside the visitor's own browser.</p>
<p><strong>Public:</strong> homeowner tools are registered on every page.</p>
<p><strong>Gated:</strong> engineer tools are registered after portal sign-in and removed on sign-out. The browser session is the gate, so there is no OAuth at all.</p>
<p>The badge in the bottom corner shows what is registered right now.</p></section>
</div>
<h2>What each side of the gate can see</h2>
<div class="doors">
<section class="card">${cardHead("H", "Homeowner tools (public)")}${names("public")}</section>
<section class="card">${cardHead("E", "Engineer tools (gated)", 3, true)}${names("engineer")}</section>
</div>
<h2>Test credentials</h2>
<p>The register is the made-up “Norvane Registered Engineer” scheme. Use these on the portal sign-in page and on the connector verification page.</p>
<div class="table-scroll"><table><thead><tr><th scope="col">Registration number</th><th scope="col">Surname</th><th scope="col">Result</th></tr></thead><tbody>
<tr><td><code>NV-204817</code></td><td>Okafor</td><td>Active: access granted</td></tr>
<tr><td><code>NV-318642</code></td><td>Hartley</td><td>Active: access granted</td></tr>
<tr><td><code>NV-185309</code></td><td>Whitlock</td><td>Lapsed: refused</td></tr>
<tr><td><code>NV-296754</code></td><td>Devlin</td><td>Suspended: refused</td></tr>
</tbody></table></div>
<h2>Try it</h2>
<ol>
<li><strong>Public connector.</strong> Add <code>${origin}/mcp</code> to Claude as a custom connector and ask: “My Norvane C30 shows F28. What does it mean and how do I fix the gas valve?” You get the homeowner answer and a pointer to engineers.</li>
<li><strong>Engineer connector.</strong> Add <code>${origin}/mcp/pro</code>. The verification page opens. Enter the test credentials and ask the same question. You get the full diagnostic, with readings and part numbers.</li>
<li><strong>WebMCP.</strong> In Chrome, switch on <code>chrome://flags/#enable-webmcp-testing</code> and open this site. The badge shows the public tools. Sign in to the portal and the engineer tools appear. Ask the browser agent the same question.</li>
</ol>
<h2>How the demo maps to regulated sectors</h2>
<div class="table-scroll"><table><thead><tr><th scope="col">Pharma</th><th scope="col">This demo</th></tr></thead><tbody>
<tr><td>Patient information leaflet</td><td>Homeowner user guide</td></tr>
<tr><td>Prescribing information</td><td>Installation and servicing manual</td></tr>
<tr><td>Field safety notices</td><td>Technical bulletins</td></tr>
<tr><td>Professional verification</td><td>Registered engineer number check</td></tr>
</tbody></table></div>
<p class="muted">Built by <a href="https://www.folddigital.com">Fold Digital</a>. Source code is public under the MIT licence.</p>`,
  });
}

export function notFound(c: Ctx): Response {
  return page({
    ...base(c),
    title: "Page not found",
    description: "That page does not exist.",
    noindex: true,
    status: 404,
    body: html`<h1>Page not found</h1><p>That page does not exist. Try the <a href="/boilers">boiler range</a> or the <a href="/fault-codes">fault codes</a>.</p>`,
  });
}
