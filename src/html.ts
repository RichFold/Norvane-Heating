// Server-rendered HTML: no framework, one inlined stylesheet, one small deferred script for WebMCP.
import type { EngineerProps, Env } from "./types";
import { NOTICE } from "./types";

export const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Marks a string as already-safe HTML. Everything else passed to html`` is escaped. */
export class Raw {
  constructor(public value: string) {}
  toString() {
    return this.value;
  }
}
export const raw = (value: string) => new Raw(value);

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.value : esc(x))).join("");
      else if (v instanceof Raw) out += v.value;
      else if (v !== false && v !== null && v !== undefined) out += esc(v);
    }
  });
  return new Raw(out);
}

const CSS = `
:root{--ink:#14202b;--muted:#51606d;--navy:#10283b;--ember:#c2410c;--ember-dark:#9a3412;--cream:#faf7f2;--card:#fff;--line:#e4ddd2;--teal:#0f5c5c;--teal-soft:#e3f1ef;--warn:#fff4e5;--radius:14px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--cream)}
a{color:var(--ember-dark)}
a:hover{color:var(--ember)}
h1,h2,h3{line-height:1.2;margin:0 0 .5em;color:var(--navy);letter-spacing:-.01em}
h1{font-size:clamp(1.9rem,5vw,2.9rem)}
h2{font-size:1.45rem;margin-top:2em}
h3{font-size:1.1rem}
p{margin:0 0 1em}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.notice{background:var(--navy);color:#f5e9dc;font-size:.82rem;text-align:center;padding:6px 12px}
.site-header{background:var(--card);border-bottom:1px solid var(--line)}
.site-header .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.2rem;color:var(--navy);text-decoration:none}
.brand svg{flex:none}
nav.main{display:flex;flex-wrap:wrap;gap:4px 18px;margin-left:auto;font-size:.95rem}
nav.main a{color:var(--ink);text-decoration:none;padding:6px 0}
nav.main a:hover,nav.main a[aria-current]{color:var(--ember-dark);text-decoration:underline;text-underline-offset:6px}
nav.main a.portal-link{color:var(--teal);font-weight:600}
main{padding:36px 0 72px;flex:1}
.hero{background:linear-gradient(135deg,#10283b,#1d4560);color:#fff;border-radius:var(--radius);padding:clamp(28px,6vw,60px);margin-bottom:36px}
.hero h1{color:#fff;max-width:17ch}
.hero p{max-width:56ch;color:#dbe7ef;font-size:1.1rem}
.btn{display:inline-block;background:var(--ember);color:#fff;border:0;border-radius:999px;padding:11px 22px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--ember-dark);color:#fff}
.btn.ghost{background:transparent;color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.6)}
.btn.teal{background:var(--teal)}
.btn.plain{background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1px var(--line)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));padding:0;margin:0;list-style:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:22px}
.card p:last-child,.card ul:last-child,.card ol:last-child{margin-bottom:0}
.card-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.card-head h2,.card-head h3{margin:0}
.icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:#fbe9df;color:var(--ember-dark);font-weight:700}
.icon.teal{background:var(--teal-soft);color:var(--teal)}
.tag{display:inline-block;font-size:.78rem;font-weight:600;border-radius:999px;padding:2px 10px;background:#eef2f5;color:var(--navy)}
.tag.teal{background:var(--teal-soft);color:var(--teal)}
.tag.ember{background:#fbe9df;color:var(--ember-dark)}
.muted{color:var(--muted)}
.lede{font-size:1.15rem;color:var(--muted);max-width:62ch}
.crumbs{font-size:.88rem;color:var(--muted);margin-bottom:14px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;font-size:.95rem}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child>*{border-bottom:0}
th{width:42%;font-weight:600;color:var(--navy);background:#fdfbf8}
thead th{width:auto;background:var(--navy);color:#fff}
.table-scroll{overflow-x:auto}
.split{display:grid;gap:28px;grid-template-columns:minmax(0,1fr)}
@media(min-width:820px){.split{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}}
.callout{background:var(--warn);border-left:4px solid var(--ember);border-radius:8px;padding:14px 18px;margin:18px 0}
.callout.teal{background:var(--teal-soft);border-color:var(--teal)}
.portal-bar{background:var(--teal);color:#fff;font-size:.92rem}
.portal-bar .wrap{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding-top:8px;padding-bottom:8px}
.portal-bar a{color:#fff}
.portal-bar form{margin-left:auto}
.portal-bar button{background:transparent;border:1px solid rgba(255,255,255,.7);color:#fff;border-radius:999px;padding:3px 14px;font:inherit;cursor:pointer}
form.stack{display:grid;gap:14px;max-width:420px}
label{font-weight:600;display:grid;gap:6px}
input[type=text],select{font:inherit;padding:10px 12px;border:1px solid #b9b1a4;border-radius:8px;background:#fff;color:var(--ink);width:100%}
.inline-form{display:flex;flex-wrap:wrap;gap:10px;align-items:end}
.inline-form label{flex:1 1 200px}
.error{background:#fdecec;border-left:4px solid #b42318;border-radius:8px;padding:12px 16px;color:#7a1810}
.fault{scroll-margin-top:16px}
.fault + .fault{margin-top:18px}
.doors{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))}
code,kbd{font:.88em ui-monospace,SFMono-Regular,Menlo,monospace;background:#efe9df;border-radius:5px;padding:1px 6px;overflow-wrap:anywhere}
pre{background:var(--navy);color:#e8f0f5;border-radius:10px;padding:14px 16px;overflow-x:auto;font:.86rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
pre code{background:none;padding:0;color:inherit}
ol,ul{padding-left:1.3em;margin:0 0 1em}
li{margin-bottom:.35em}
.boiler-art{background:linear-gradient(160deg,#eef2f5,#fff);border:1px solid var(--line);border-radius:var(--radius);display:flex;justify-content:center;padding:24px}
.site-footer{background:var(--navy);color:#cfdbe4;font-size:.92rem;padding:32px 0}
.site-footer a{color:#fff}
.site-footer .wrap{display:flex;flex-wrap:wrap;gap:10px 32px;justify-content:space-between}
#webmcp-badge{position:fixed;right:14px;bottom:14px;z-index:50;font:600 .8rem/1 system-ui,sans-serif;background:var(--navy);color:#fff;border:0;border-radius:999px;padding:9px 14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
#webmcp-badge[data-state=active]{background:#14633a}
#webmcp-badge[data-state=unavailable]{background:#5b6570}
#webmcp-panel{position:fixed;right:14px;bottom:56px;z-index:50;width:min(340px,calc(100vw - 28px));max-height:60vh;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:.86rem}
#webmcp-panel h2{font-size:.95rem;margin:0 0 8px}
#webmcp-panel ul{list-style:none;padding:0;margin:0 0 8px}
#webmcp-panel li{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #f0ebe3}
#webmcp-panel[hidden]{display:none}
`;

const LOGO = `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#10283b"/><path d="M16 5c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-3-1-6 0-9z" fill="#f97316"/></svg>`;

export function boilerArt(label: string, hybrid = false): Raw {
  return raw(`<svg width="190" height="250" viewBox="0 0 190 250" role="img" aria-label="Illustration of the Norvane ${esc(label)}">
<rect x="25" y="10" width="140" height="200" rx="12" fill="#fff" stroke="#10283b" stroke-width="3"/>
<rect x="45" y="150" width="100" height="38" rx="6" fill="#10283b"/>
<rect x="55" y="159" width="40" height="20" rx="3" fill="#f97316"/>
<circle cx="112" cy="169" r="7" fill="#fff"/><circle cx="132" cy="169" r="7" fill="#fff"/>
<text x="95" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#10283b">NORVANE</text>
<text x="95" y="84" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#c2410c">${esc(label.split(" ")[0])}</text>
${hybrid ? `<text x="95" y="104" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#0f5c5c">+ heat pump</text>` : ""}
<path d="M55 210v28M80 210v28M110 210v28M135 210v28" stroke="#8a97a3" stroke-width="5" stroke-linecap="round"/>
</svg>`);
}

interface PageOptions {
  title: string;
  description: string;
  path: string;
  body: Raw;
  env: Env;
  session: EngineerProps | null;
  noindex?: boolean;
  jsonLd?: unknown;
  status?: number;
  headers?: HeadersInit;
  portal?: boolean;
}

const NAV: [string, string][] = [
  ["/boilers", "Boilers"],
  ["/guides", "User guides"],
  ["/fault-codes", "Fault codes"],
  ["/find-an-installer", "Find an installer"],
  ["/warranty", "Warranty"],
  ["/demo", "About this demo"],
];

export function page(o: PageOptions): Response {
  const canonical = `${o.env.PUBLIC_URL}${o.path}`;
  const current = (href: string) => (o.path === href || o.path.startsWith(`${href}/`) ? raw(' aria-current="page"') : "");
  const doc = html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${o.title} | Norvane Heating</title>
<meta name="description" content="${o.description}">
${o.noindex ? raw('<meta name="robots" content="noindex,nofollow">') : html`<link rel="canonical" href="${canonical}">`}
${o.env.WEBMCP_OT_TOKEN ? html`<meta http-equiv="origin-trial" content="${o.env.WEBMCP_OT_TOKEN}">` : ""}
<meta name="theme-color" content="#10283b">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${raw(CSS)}</style>
${o.jsonLd ? raw(`<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, "\\u003c")}</script>`) : ""}
<script src="/webmcp.js" defer></script>
</head>
<body data-engineer="${o.session ? "true" : "false"}">
<div class="notice" role="note">${NOTICE}</div>
<header class="site-header"><div class="wrap">
<a class="brand" href="/">${raw(LOGO)}<span>Norvane Heating</span></a>
<nav class="main" aria-label="Main">
${NAV.map(([href, label]) => html`<a href="${href}"${current(href)}>${label}</a>`)}
<a class="portal-link" href="/portal"${current("/portal")}>Engineer portal</a>
</nav>
</div></header>
${
  o.session
    ? html`<div class="portal-bar"><div class="wrap"><span>Signed in as <strong>${o.session.name}</strong> (${o.session.regNumber})</span>
<a href="/portal">Portal home</a>
<form method="post" action="/portal/logout" data-logout><button type="submit">Sign out</button></form></div></div>`
    : ""
}
<main><div class="wrap">${o.body}</div></main>
<footer class="site-footer"><div class="wrap">
<div><strong>${NOTICE}</strong><br>Norvane Heating is not a real company. Nothing here is technical guidance.</div>
<div><a href="https://www.folddigital.com">A reference demo by Fold Digital</a><br><a href="/demo">How this demo works</a></div>
</div></footer>
</body>
</html>`;
  const headers = new Headers(o.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
  }
  if (o.noindex || o.portal) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Cache-Control", "no-store");
  } else if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-cache");
  }
  return new Response(doc.value, { status: o.status ?? 200, headers });
}

export const specTable = (rows: [string, unknown][]): Raw =>
  html`<div class="table-scroll"><table><tbody>${rows.map(([k, v]) => html`<tr><th scope="row">${k}</th><td>${v}</td></tr>`)}</tbody></table></div>`;

export const list = (items: unknown[], ordered = false): Raw =>
  ordered ? html`<ol>${items.map((i) => html`<li>${i}</li>`)}</ol>` : html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;

export const cardHead = (icon: string, heading: string, level: 2 | 3 = 3, teal = false): Raw =>
  html`<div class="card-head"><span class="icon${teal ? " teal" : ""}" aria-hidden="true">${icon}</span>${raw(`<h${level}>${esc(heading)}</h${level}>`)}</div>`;
