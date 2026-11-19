// Norvane Heating: one Worker, three doors for AI agents.
//   1. Website        public pages + /portal (signed cookie session)
//   2. Remote MCP     /mcp (public) + /mcp/pro (OAuth, engineer verification)
//   3. WebMCP         tools registered in the browser by /webmcp.js, calling /api/tools
import { OAuthProvider, type OAuthResourceContext } from "@cloudflare/workers-oauth-provider";
import { isActiveEngineer } from "./data";
import { allowed, tooManyRequests } from "./limits";

export { RateGuard } from "./limits";
export { ToolLog } from "./analytics";
import { engineerMcp } from "./mcp";
import { site } from "./site";
import type { EngineerProps, Env } from "./types";
import { NOTICE } from "./types";

type Props = OAuthResourceContext<EngineerProps>;

/**
 * The OAuth provider is built once per public origin, because every token is bound to the exact
 * URL clients connect to (origin + "/mcp/pro"). Using the origin of the request means the same
 * code works on localhost, workers.dev and a custom domain with nothing to configure.
 */
const providers = new Map<string, OAuthProvider<Env>>();

function providerFor(origin: string): OAuthProvider<Env> {
  let provider = providers.get(origin);
  if (!provider) {
    provider = new OAuthProvider<Env>({
      // Door 2b: everything under /mcp/pro needs a valid access token. The provider answers
      // unauthenticated requests with 401 and a WWW-Authenticate header pointing at the metadata.
      apiRoute: "/mcp/pro",
      apiHandler: {
        fetch(request: Request, env: Env, ctx: ExecutionContext) {
          // A registration that lapses or is suspended after the token was issued loses access straight away.
          const { props } = ctx as unknown as Props;
          if (!isActiveEngineer(props.regNumber)) {
            return Response.json({ error: "forbidden", message: "This engineer registration is no longer active.", notice: NOTICE }, { status: 403 });
          }
          return engineerMcp(request, env, ctx);
        },
      },
      // Everything else: the website, the public /mcp endpoint and the /authorize verification page.
      defaultHandler: { fetch: site as unknown as ExportedHandlerFetchHandler<Env> },
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      // Dynamic Client Registration for clients such as Claude; Client ID Metadata Documents for newer clients.
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: ["engineer"],
      // The URL MCP clients connect to. Every token is bound to it.
      resourceMetadata: { resource: `${origin}/mcp/pro`, resource_name: "Norvane Heating engineer connector" },
    });
    providers.set(origin, provider);
  }
  return provider;
}

export default {
  async fetch(request: Request, bindings: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // www redirects to the apex domain, so there is one canonical origin for pages and OAuth.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    const { pathname, origin } = url;
    // PUBLIC_URL is optional: set it only to force a canonical origin.
    const publicUrl = (bindings.PUBLIC_URL || origin).replace(/\/+$/, "");
    const env: Env = { ...bindings, PUBLIC_URL: publicUrl };
    const provider = providerFor(publicUrl);
    // Rate limits for the routes the OAuth provider answers itself, so the public URL cannot run up usage.
    if (pathname === "/mcp/pro" && !(await allowed(env, request, "mcp"))) {
      return tooManyRequests("MCP requests");
    }
    if ((pathname.startsWith("/oauth/") || pathname === "/authorize") && !(await allowed(env, request, "oauth"))) {
      return tooManyRequests("authorisation requests");
    }
    // Some clients look for the protected resource metadata at the root well-known path first.
    if (pathname === "/.well-known/oauth-protected-resource") {
      return provider.fetch(new Request(new URL("/.well-known/oauth-protected-resource/mcp/pro", request.url), request), env, ctx);
    }
    return provider.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
