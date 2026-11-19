// Rate limits, using the Workers Rate Limiting binding. Counters live at the edge: no KV writes, no cost per check.
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

/** Login attempts are limited per IP address and per registration number, so neither can be used to brute-force the register. */
export async function loginAllowed(env: Env, request: Request, regNumber: string): Promise<boolean> {
  const byIp = await allowed(env.LOGIN_LIMITER, `ip:${clientIp(request)}`);
  const byNumber = await allowed(env.LOGIN_LIMITER, `reg:${regNumber.replace(/[^0-9]/g, "").slice(0, 12)}`);
  return byIp && byNumber;
}
