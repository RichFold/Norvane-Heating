// The default handler: the website, the public /mcp endpoint, the WebMCP tool API and /authorize.
import { clearSessionCookie, getSession, sessionCookie } from "./auth";
import { recordCall } from "./analytics";
import { authorize } from "./authorize";
import { analyticsPage } from "./pages-analytics";
import { boilers, LookupError, verifyEngineer } from "./data";
import { allowed, tooManyRequests } from "./limits";
import { publicMcp } from "./mcp";
import * as pub from "./pages-public";
import * as portal from "./pages-portal";
import { runTool, toolManifest, tools } from "./tools";
import type { Env } from "./types";
import { NOTICE } from "./types";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const sameOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
};

const safeNext = (next: string | null) => (next && /^\/portal(\/[\w\-/?=&]*)?$/.test(next) ? next : "/portal");

export async function site(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const method = request.method;

  // Door 2a: the public MCP endpoint. No sign-in, homeowner tools only.
  if (path === "/mcp") {
    if (!(await allowed(env, request, "mcp"))) return tooManyRequests("MCP requests");
    return publicMcp(request, env, ctx);
  }

  // Door 2b's sign-in: the engineer verification page.
  if (path === "/authorize") return authorize(request, env);

  const session = await getSession(request, env);
  const c: pub.Ctx = { env, url, session };

  // Door 3: the WebMCP script calls these. Same data, same tool code, gated by the session cookie.
  if (path === "/api/tools" && method === "GET") {
    return json({ engineer: Boolean(session), tools: toolManifest(Boolean(session)), notice: NOTICE });
  }
  if (path.startsWith("/api/tools/") && method === "POST") {
    if (!sameOrigin(request, url)) return json({ error: "forbidden", message: "Cross-origin calls are not allowed.", notice: NOTICE }, 403);
    if (!(await allowed(env, request, "mcp"))) return tooManyRequests("tool calls");
    const tool = tools.find((t) => t.name === path.slice("/api/tools/".length));
    if (!tool) return json({ error: "not_found", message: "Unknown tool.", notice: NOTICE }, 404);
    if (tool.tier === "engineer" && !session) {
      return json({ error: "unauthorised", message: "Sign in to the engineer portal to use this tool.", notice: NOTICE }, 401);
    }
    const door = session ? "webmcp-engineer" : "webmcp-public";
    const args = await request.json().catch(() => ({}));
    try {
      const result = runTool(tool, args);
      await recordCall(env, door, tool, args, true);
      return json(result);
    } catch (error) {
      if (error instanceof LookupError) await recordCall(env, door, tool, args, false);
      if (error instanceof LookupError) return json({ error: "invalid_request", message: error.message, notice: NOTICE }, 400);
      throw error;
    }
  }

  // Portal sign-in and sign-out.
  if (path === "/portal/login") {
    if (method === "POST") {
      if (!sameOrigin(request, url)) return new Response("Forbidden", { status: 403 });
      const form = await request.formData();
      const regNumber = String(form.get("regNumber") ?? "");
      const next = safeNext(String(form.get("next") ?? ""));
      if (!(await allowed(env, request, "login"))) {
        return portal.loginPage(c, { error: "Too many sign-in attempts. Wait a minute and try again.", next, regNumber, status: 429 });
      }
      const result = verifyEngineer(regNumber, String(form.get("surname") ?? ""));
      if (!result.ok) return portal.loginPage(c, { error: result.message, next, regNumber, status: result.reason === "no_match" ? 401 : 403 });
      const cookie = await sessionCookie(env, {
        regNumber: result.engineer.regNumber,
        name: `${result.engineer.firstName} ${result.engineer.surname}`,
      });
      return new Response(null, { status: 303, headers: { Location: next, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
    }
    if (session) return Response.redirect(new URL(safeNext(url.searchParams.get("next")), url).toString(), 302);
    return portal.loginPage(c, { next: safeNext(url.searchParams.get("next")) });
  }
  if (path === "/portal/logout" && method === "POST") {
    if (!sameOrigin(request, url)) return new Response("Forbidden", { status: 403 });
    return new Response(null, { status: 303, headers: { Location: "/portal/login", "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  }

  if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  // Door 1, gated half: the engineer portal. No session means a redirect to sign-in.
  if (path === "/portal" || path.startsWith("/portal/")) {
    if (!session) {
      const next = encodeURIComponent(path + url.search);
      return new Response(null, { status: 302, headers: { Location: `/portal/login?next=${next}`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }
    const [, , section, id] = path.split("/");
    const response =
      !section ? portal.dashboard(c)
      : section === "manuals" ? (id ? portal.manualPage(c, id) : portal.manualsIndex(c))
      : section === "faults" ? (id ? portal.faultPage(c, id) : portal.faultsIndex(c))
      : section === "parts" ? (id ? portal.partsPage(c, id) : portal.partsIndex(c))
      : section === "checklists" ? (id ? portal.checklistPage(c, id) : portal.checklistsIndex(c))
      : section === "bulletins" ? (id ? portal.bulletinPage(c, id) : portal.bulletinsIndex(c))
      : null;
    return response ?? pub.notFound(c);
  }

  // Door 1, public half: crawlable pages.
  if (path === "/") return pub.home(c);
  if (path === "/boilers") return pub.range(c);
  if (path === "/guides") return pub.guidesIndex(c);
  if (path === "/fault-codes") return pub.faultCodes(c);
  if (path === "/find-an-installer") return pub.findInstaller(c);
  if (path === "/warranty") return pub.warrantyPage(c);
  if (path === "/demo") return pub.demoPage(c);
  if (path === "/demo/analytics") return analyticsPage(c);
  const [, section, id, extra] = path.split("/");
  if (!extra && id) {
    const response = section === "boilers" ? pub.boilerPage(c, id) : section === "guides" ? pub.guidePage(c, id) : null;
    if (response) return response;
  }
  if (path === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /portal\nDisallow: /api/\nDisallow: /authorize\nDisallow: /oauth/\n\nSitemap: ${env.PUBLIC_URL}/sitemap.xml\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (path === "/sitemap.xml") {
    const paths = ["/", "/boilers", "/guides", "/fault-codes", "/find-an-installer", "/warranty", "/demo", ...boilers.flatMap((b) => [`/boilers/${b.id}`, `/guides/${b.id}`])];
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `<url><loc>${env.PUBLIC_URL}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }
  return pub.notFound(c);
}
