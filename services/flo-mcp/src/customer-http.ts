import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { CustomerAuthError, type CustomerWebsiteIdentity } from "@flo/agent";
import { z } from "zod";
import { createCustomerMcpServer, type CustomerRepairService } from "./customer-tools.js";

const sessionCookie = "__Host-flo-session";
const stateCookie = "__Host-flo-lwa-state";
const cookie = (name: string, value: string, age: number, sameSite = "Strict") => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=${age}`;
const readCookie = (request: Request, name: string): string => {
  const entries = (request.headers.get("cookie") ?? "").split(/[;,]/).map(item => item.trim()).filter(item => item.startsWith(`${name}=`));
  return entries.length === 1 ? entries[0]!.slice(name.length + 1) : "";
};
const readBody = async (request: Request): Promise<unknown> => {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new SyntaxError("Invalid content type");
  const body = await request.text();
  if (Buffer.byteLength(body) > 2048) throw new SyntaxError("Request too large");
  return JSON.parse(body) as unknown;
};
const securityHeaders = {
  "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
export interface CustomerHttpOptions { auth?: CustomerWebsiteIdentity; experience: CustomerRepairService; assets?: URL }

/** Shared HTTP implementation: Node and API Gateway use this exact route/auth boundary. */
export const createCustomerHttp = (options: CustomerHttpOptions) => {
  const json = (status: number, body: unknown, headers?: HeadersInit) => Response.json(body, { status, ...(headers ? { headers } : {}) });
  const handle = async (request: Request, sourceIp: string): Promise<Response> => {
    const url = new URL(request.url); const auth = options.auth;
    if (request.method === "POST" && (!auth || request.headers.get("origin") !== auth.config.publicOrigin)) return json(403, { error: "Request origin is not allowed." });
    if (request.method === "GET" && ["/", "/signin.js", "/signin.css", "/privacy", "/terms"].includes(url.pathname)) {
      const file = url.pathname === "/" ? "signin.html" : url.pathname === "/privacy" ? "privacy.html" : url.pathname === "/terms" ? "terms.html" : url.pathname.slice(1);
      const content = await readFile(new URL(file, options.assets ?? new URL("../public/", import.meta.url)), "utf8");
      return new Response(content, { headers: { "Content-Type": file.endsWith("html") ? "text/html; charset=utf-8" : file.endsWith("js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" } });
    }
    if (["/mcp", "/alexa/mcp", "/customer/mcp"].includes(url.pathname)) return json(401, { error: "Official Alexa+ user and service authorization is not configured. Website sign-in does not enable this route." });
    if (!auth) return json(503, { code: "SIGN_IN_UNAVAILABLE", error: "Login with Amazon is not configured. No customer access is enabled." });
    if (url.pathname === "/auth/lwa/start" && request.method === "POST") {
      z.object({ consent: z.literal(true) }).strict().parse(await readBody(request));
      if (!isIP(sourceIp)) throw new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
      const login = await auth.begin(sourceIp, readCookie(request, stateCookie));
      return json(200, { authorizationUrl: login.authorizationUrl }, { "Set-Cookie": cookie(stateCookie, login.browserNonce, 300, "Lax") });
    }
    if (url.pathname === "/auth/lwa/callback" && request.method === "GET") {
      const state = url.searchParams.getAll("state"); const code = url.searchParams.getAll("code");
      if (state.length !== 1 || code.length !== 1 || url.searchParams.has("error")) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
      const session = await auth.finish(state[0]!, readCookie(request, stateCookie), code[0]!);
      try { await auth.logout(readCookie(request, sessionCookie)); }
      catch (error) { await auth.logout(session); throw error; }
      const headers = new Headers({ Location: "/" });
      headers.append("Set-Cookie", cookie(stateCookie, "", 0, "Lax")); headers.append("Set-Cookie", cookie(sessionCookie, session, 900));
      return new Response(null, { status: 303, headers });
    }
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      await auth.logout(readCookie(request, sessionCookie));
      const headers = new Headers();
      headers.append("Set-Cookie", cookie(sessionCookie, "", 0)); headers.append("Set-Cookie", cookie(stateCookie, "", 0, "Lax"));
      return json(200, { signedIn: false }, headers);
    }
    const session = readCookie(request, sessionCookie);
    if (url.pathname === "/auth/session" && request.method === "GET") { await auth.principal(session); return json(200, { signedIn: true, linked: true }); }
    if (url.pathname === "/website/mcp" && request.method === "POST") {
      const bearer = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] ?? "";
      const principal = await auth.principal(bearer);
      const revalidate = async () => {
        const current = await auth.principal(bearer);
        if (current.subject !== principal.subject || current.customerId !== principal.customerId) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
      };
      const handler = createMcpHandler(() => createCustomerMcpServer(options.experience, principal, revalidate), { legacy: "stateless" });
      try {
        const response = await handler.fetch(request);
        return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
      } finally { await handler.close(); }
    }
    if (url.pathname === "/api/customer/command" && request.method === "POST") {
      const principal = await auth.principal(session);
      const { command } = z.object({ command: z.string().trim().min(1).max(300) }).strict().parse(await readBody(request));
      if (/\b(approve|confirm|pay|buy|order|cancel|change|book|reschedule)\b/i.test(command)) return json(200, { voice: "Repair and estimate review only. Nothing has been changed.", tools: [], data: null });
      const numbers = [...command.matchAll(/\b\d{4,10}\b/g)].map(match => match[0]);
      if (new Set(numbers).size > 1) return json(200, { voice: "Which repair number would you like to review?", tools: [], data: null });
      if (!/\b(repair|repairs|estimate|status|cost|total|price|vehicle|ford)\b/i.test(command)) return json(200, { voice: "Try show my repairs, status of repair 1842, or review estimate 1842.", tools: [], data: null });
      const name = numbers[0] === undefined ? "list_my_repairs" : /estimate|cost|total|price/i.test(command) ? "get_my_estimate" : "get_my_repair";
      const client = new Client({ name: "flo-customer-website", version: "0.4.0" }, { versionNegotiation: { mode: "legacy" } });
      try {
        // Real SDK Streamable HTTP requests, without a listener or an untrusted Host.
        await client.connect(new StreamableHTTPClientTransport(new URL(`${auth.config.publicOrigin}/website/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${session}`, Origin: auth.config.publicOrigin } },
          fetch: async (input, init) => {
            const internal = new Request(input, init);
            if (new URL(internal.url).href !== `${auth.config.publicOrigin}/website/mcp`) throw new Error("Invalid internal MCP target");
            return handle(internal, sourceIp);
          }
        }));
        const result = await client.callTool({ name, arguments: numbers[0] === undefined ? {} : { repairNumber: numbers[0] } });
        const current = await auth.principal(session);
        if (current.subject !== principal.subject || current.customerId !== principal.customerId) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
        return json(200, { ok: !result.isError, voice: result.content.filter(item => item.type === "text").map(item => item.text).join(" "), tools: [name], data: result.isError ? null : result.structuredContent });
      } finally { await client.close().catch(() => undefined); }
    }
    return json(404, { error: "Not found" });
  };
  return async (request: Request, sourceIp: string): Promise<Response> => {
    let response: Response;
    try { response = await handle(request, sourceIp); }
    catch (error) {
      response = error instanceof CustomerAuthError
        ? json(error.status, { code: error.code, error: error.message }, error.status === 429 ? { "Retry-After": "300" } : undefined)
        : json(error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503, { error: "The request could not be completed. No customer access has been granted." });
    }
    for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
    return response;
  };
};
