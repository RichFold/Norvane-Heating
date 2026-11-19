// Rate limits, counted exactly in a small Durable Object per IP address and route group.
// (The Workers Rate Limiting binding was tried first: in production it is only approximate and
// let most of a burst through, so it could not be relied on for sign-in attempts or usage caps.)
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { NOTICE } from "./types";

const WINDOW_MS = 60_000;

/** Requests allowed per minute, per IP address. */
export const LIMITS = {
  /** MCP requests to /mcp and /mcp/pro, and WebMCP tool calls to /api/tools. */
  mcp: 60,
  /** Sign-in attempts on the portal form and the OAuth verification form. */
  login: 5,
  /** OAuth client registration, authorisation page and token endpoint. */
  oauth: 20,
} as const;

/**
 * One instance per IP address and limit. The count lives in memory only: an instance stays loaded
 * while requests keep arriving, and once it has been idle long enough to be unloaded the window
 * has passed anyway. Nothing is written to storage, so a check costs one Durable Object request.
 */
export class RateGuard extends DurableObject {
  private start = 0;
  private count = 0;

  attempt(limit: number): boolean {
    const now = Date.now();
    if (now - this.start >= WINDOW_MS) {
      this.start = now;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= limit;
  }
}

export const clientIp = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "local";

export async function allowed(env: Env, request: Request, bucket: keyof typeof LIMITS): Promise<boolean> {
  try {
    return await env.RATE_GUARD.getByName(`${bucket}:${clientIp(request)}`).attempt(LIMITS[bucket]);
  } catch (error) {
    console.error("Rate guard unavailable", error);
    return true; // Never take the demo down because the limiter is unavailable.
  }
}

export function tooManyRequests(what: string): Response {
  return Response.json(
    { error: "rate_limited", message: `Too many ${what}. Wait a minute and try again.`, notice: NOTICE },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}
