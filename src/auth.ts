// Portal sessions: a signed cookie, HMAC-SHA256. No server-side session store.
// The signing secret is the COOKIE_SECRET Worker secret when one is set. When it is not, the
// Worker generates a random secret once and keeps it in KV, so sign-in works on a fresh deploy
// with nothing to configure. Either way the secret lives in Cloudflare, never in the code.
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

const KV_SECRET_KEY = "norvane:cookie-secret";
let cachedKey: { secret: string; key: CryptoKey } | undefined;

async function signingSecret(env: Env): Promise<string> {
  if (env.COOKIE_SECRET) return env.COOKIE_SECRET;
  const stored = await env.OAUTH_KV.get(KV_SECRET_KEY);
  if (stored) return stored;
  const generated = b64url(crypto.getRandomValues(new Uint8Array(48)));
  await env.OAUTH_KV.put(KV_SECRET_KEY, generated);
  // Read back, so two Workers starting at the same moment settle on the same secret.
  return (await env.OAUTH_KV.get(KV_SECRET_KEY)) ?? generated;
}

async function key(env: Env): Promise<CryptoKey> {
  if (cachedKey && (!env.COOKIE_SECRET || cachedKey.secret === env.COOKIE_SECRET)) return cachedKey.key;
  const secret = await signingSecret(env);
  const imported = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  cachedKey = { secret, key: imported };
  return imported;
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
