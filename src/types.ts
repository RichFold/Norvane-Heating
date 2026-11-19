import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  MCP_LIMITER: RateLimit;
  LOGIN_GUARD: DurableObjectNamespace<import("./limits").LoginGuard>;
  OAUTH_LIMITER: RateLimit;
  COOKIE_SECRET: string;
  PUBLIC_URL: string;
  WEBMCP_OT_TOKEN?: string;
}

/** What is stored with an OAuth grant and with a portal session. */
export interface EngineerProps {
  regNumber: string;
  name: string;
}

export const NOTICE = "Fictional demo data. Not for real gas work.";
export const ENGINEER_POINTER =
  "Registered engineers can get the full diagnostic through the Norvane engineer connector or portal.";
