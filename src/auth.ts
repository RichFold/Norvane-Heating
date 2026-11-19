// Portal sessions: a signed cookie, HMAC-SHA256 with COOKIE_SECRET. No server-side session store.
import { isActiveEngineer } from "./data";
import type { EngineerProps, Env } from "./types";

const COOKIE = "__Host-norvane_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours
const encoder = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function key(env: Env): Promise<CryptoKey> {
  if (!env.COOKIE_SECRET) throw new Error("COOKIE_SECRET is not set. Run: npx wrangler secret put COOKIE_SECRET");
  return crypto.subtle.importKey("raw", encoder.encode(env.COOKIE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sessionCookie(env: Env, engineer: EngineerProps): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify({ ...engineer, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  const signature = b64url(await crypto.subtle.sign("HMAC", await key(env), encoder.encode(payload)));
  return `${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** The signed-in engineer, or null. A lapsed or suspended registration ends the session. */
export async function getSession(request: Request, env: Env): Promise<EngineerProps | null> {
  const cookie = (request.headers.get("Cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const [payload, signature] = cookie.slice(COOKIE.length + 1).split(".");
  if (!payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await key(env), fromB64url(signature), encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    if (!isActiveEngineer(data.regNumber)) return null;
    return { regNumber: data.regNumber, name: data.name };
  } catch {
    return null;
  }
}
