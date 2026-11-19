// The OAuth authorisation page for /mcp/pro. There is no third-party identity provider:
// this page IS the verification screen. It checks a registration number and surname against
// the register, then completes the OAuth flow with props { regNumber, name }.
import { AuthorizationError, type AuthRequest, type ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { getSession } from "./auth";
import { normaliseRegNumber, verifyEngineer } from "./data";
import { html, page } from "./html";
import { loginAllowed } from "./limits";
import type { EngineerProps, Env } from "./types";

// The verification form posts back to this page, then the browser is redirected to the client.
// form-action is left open because that final redirect goes to the client's own callback URL.
const CSP = "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'";

function screen(
  env: Env,
  request: Request,
  opts: { details: ConsentDescription; handle: string; session: EngineerProps | null; error?: string; regNumber?: string; headers?: Headers; status?: number },
): Response {
  const { details, handle, session } = opts;
  const url = new URL(request.url);
  const headers = new Headers(opts.headers);
  headers.set("Content-Security-Policy", CSP);
  const action = `${url.pathname}${url.search}`;
  return page({
    env,
    session: null,
    path: "/authorize",
    noindex: true,
    status: opts.status,
    headers,
    title: "Verify you're a registered heating engineer",
    description: "Verification for the Norvane engineer connector.",
    body: html`
<h1>Verify you're a registered heating engineer</h1>
<p class="lede"><strong>${details.clientName}</strong> is asking for access to Norvane engineer content: fault diagnostics, installation data, parts, service checklists and technical bulletins.</p>
<div class="callout teal">
${details.clientDomain ? html`Published by <strong>${details.clientDomain}</strong>. ` : html`This app registered itself, so its name is not verified. `}
Access will be sent to <strong>${details.redirectHost}</strong>.
${details.redirectIsLoopback ? html`<br><strong>This sends access to an app on your computer.</strong> Continue only if you just started connecting from it.` : ""}
</div>
${opts.error ? html`<p class="error" role="alert">${opts.error}</p>` : ""}
${
  session
    ? html`<form class="stack card" method="post" action="${action}">
<input type="hidden" name="handle" value="${handle}">
<p>You are signed in to the engineer portal as <strong>${session.name}</strong> (${session.regNumber}).</p>
<button class="btn teal" type="submit" name="decision" value="continue">Continue as ${session.name}</button>
<button class="btn plain" type="submit" name="decision" value="deny">Cancel</button>
</form>`
    : html`<form class="stack card" method="post" action="${action}">
<input type="hidden" name="handle" value="${handle}">
<label>Registration number<input type="text" name="regNumber" value="${opts.regNumber ?? ""}" placeholder="NV-000000" autocomplete="off"></label>
<label>Surname<input type="text" name="surname" autocomplete="family-name"></label>
<button class="btn teal" type="submit" name="decision" value="verify">Verify and connect</button>
<button class="btn plain" type="submit" name="decision" value="deny">Cancel</button>
</form>
<p class="muted">We check these against the Norvane Registered Engineer scheme. This is a demo: test credentials are on the <a href="/demo">demo page</a>.</p>`
}`,
  });
}

function problem(env: Env, message: string, status = 400): Response {
  return page({
    env,
    session: null,
    path: "/authorize",
    noindex: true,
    status,
    title: "We couldn't complete that",
    description: "Authorisation problem.",
    body: html`<h1>We couldn't complete that</h1><p class="error" role="alert">${message}</p><p>Go back to your AI assistant and start connecting again.</p>`,
  });
}

export async function authorize(request: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  try {
    const session = await getSession(request, env);

    if (request.method === "GET") {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return screen(env, request, { details, handle: consent.handle, session, headers: consent.headers });
    }

    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });

    const form = await request.formData();
    const handle = String(form.get("handle") ?? "");
    const decision = String(form.get("decision") ?? "");

    if (decision === "deny") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }

    let engineer: EngineerProps | null = null;
    if (decision === "continue" && session) {
      engineer = session;
    } else {
      const regNumber = String(form.get("regNumber") ?? "");
      const surname = String(form.get("surname") ?? "");
      // The original request is still in the query string, so the page can be shown again after a failed attempt.
      const retry = async (error: string, status: number) => {
        const authRequest: AuthRequest = await oauth.parseAuthRequest(new Request(request.url, { headers: request.headers }));
        const details = await oauth.describeConsent(authRequest);
        return screen(env, request, { details, handle, session: null, error, regNumber, status });
      };
      if (!(await loginAllowed(env, request, regNumber))) {
        return retry("Too many attempts. Wait a minute and try again.", 429);
      }
      const result = verifyEngineer(regNumber, surname);
      if (!result.ok) return retry(result.message, result.reason === "no_match" ? 401 : 403);
      engineer = { regNumber: result.engineer.regNumber, name: `${result.engineer.firstName} ${result.engineer.surname}` };
    }

    const approved = await oauth.approveConsent(request, handle);
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request, // From storage, not from the form.
      userId: normaliseRegNumber(engineer.regNumber),
      metadata: { name: engineer.name },
      scope: approved.request.scope,
      props: engineer,
    });
    approved.headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Only redirect when the library has validated the client and its redirect URI.
      if (error.redirectTo) return Response.redirect(error.redirectTo, 302);
      return problem(env, "This connection request is not valid or has expired.");
    }
    throw error;
  }
}
