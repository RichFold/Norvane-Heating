// Norvane Heating: one Worker, three doors for AI agents.
//   1. Website        public pages + /portal (signed cookie session)
//   2. Remote MCP     /mcp (public) + /mcp/pro (OAuth, engineer verification)
//   3. WebMCP         tools registered in the browser by /webmcp.js, calling /api/tools
import { OAuthProvider, type OAuthResourceContext } from "@cloudflare/workers-oauth-provider";
import { env as bindings } from "cloudflare:workers";
import { isActiveEngineer } from "./data";
import { allowed, clientIp, tooManyRequests } from "./limits";
import { engineerMcp } from "./mcp";
import { site } from "./site";
import type { EngineerProps, Env } from "./types";
import { NOTICE } from "./types";

const publicUrl = ((bindings as unknown as Env).PUBLIC_URL || "http://localhost:8787").replace(/\/+$/, "");

const provider = new OAuthProvider<Env>({
  // Door 2b: everything under /mcp/pro needs a valid access token. The provider answers
  // unauthenticated requests with 401 and a WWW-Authenticate header pointing at the metadata.
  apiRoute: "/mcp/pro",
  apiHandler: {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
      // A registration that lapses or is suspended after the token was issued loses access straight away.
      const { props } = ctx as unknown as OAuthResourceContext<EngineerProps>;
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
  resourceMetadata: { resource: `${publicUrl}/mcp/pro`, resource_name: "Norvane Heating engineer connector" },
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    // Rate limits for the routes the OAuth provider answers itself, so the public URL cannot run up usage.
    if (pathname === "/mcp/pro" && !(await allowed(env.MCP_LIMITER, `pro:${clientIp(request)}`))) {
      return tooManyRequests("MCP requests");
    }
    if ((pathname.startsWith("/oauth/") || pathname === "/authorize") && !(await allowed(env.OAUTH_LIMITER, `oauth:${clientIp(request)}`))) {
      return tooManyRequests("authorisation requests");
    }
    // Some clients look for the protected resource metadata at the root well-known path first.
    if (pathname === "/.well-known/oauth-protected-resource") {
      return provider.fetch(new Request(new URL("/.well-known/oauth-protected-resource/mcp/pro", request.url), request), env, ctx);
    }
    return provider.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
