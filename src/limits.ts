// Rate limits. Usage caps use the Workers Rate Limiting binding (approximate, no cost per check).
// Sign-in attempts use a Durable Object counter (exact).
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { NOTICE } from "./types";

export const clientIp = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "local";

export async function allowed(limiter: RateLimit, key: string): Promise<boolean> {
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true; // Never take the demo down because the limiter is unavailable.
  }
}

export function tooManyRequests(what: string): Response {
  return Response.json(
    { error: "rate_limited", message: `Too many ${what}. Wait a minute and try again.`, notice: NOTICE },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

/**
 * A strict counter for sign-in attempts. The Rate Limiting binding is fast and free but only
 * approximate, which is fine for capping usage and not good enough to stop someone guessing
 * registration numbers. One small Durable Object per IP address counts exactly.
 */
export class LoginGuard extends DurableObject {
  attempt(): boolean {
    const now = Date.now();
    const state = this.ctx.storage.kv.get<{ start: number; count: number }>("window");
    const current = state && now - state.start < LOGIN_WINDOW_MS ? state : { start: now, count: 0 };
    current.count += 1;
    this.ctx.storage.kv.put("window", current);
    return current.count <= LOGIN_LIMIT;
  }
}

/** Five sign-in attempts a minute per IP address, on both the portal form and the OAuth verification form. */
export async function loginAllowed(env: Env, request: Request): Promise<boolean> {
  try {
    return await env.LOGIN_GUARD.getByName(`ip:${clientIp(request)}`).attempt();
  } catch (error) {
    console.error("Login guard unavailable", error);
    return true;
  }
}
